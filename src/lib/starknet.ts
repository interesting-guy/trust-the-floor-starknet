import { RpcProvider, Contract, CallData, shortString } from 'starknet'
import { normalizeAddress } from './storage'
import type { LeaderboardEntry } from '../types'

const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://api.cartridge.gg/x/starknet/mainnet'
const CONTRACT_ADDRESS = import.meta.env.VITE_LEADERBOARD_CONTRACT || '0x0149a9761026e5c940b5669b76057234a68ccff05151c7e4c301ff0675bf53c5'

export const contractDeployed = Boolean(CONTRACT_ADDRESS && !CONTRACT_ADDRESS.startsWith('0x000000'))

export const provider = new RpcProvider({ nodeUrl: RPC_URL })

const CONTRACT_ABI = [
  {
    type: 'function',
    name: 'submit_score',
    inputs: [
      { name: 'deaths', type: 'core::felt252' },
      { name: 'level_reached', type: 'core::felt252' },
      { name: 'username', type: 'core::felt252' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'get_leaderboard',
    inputs: [],
    outputs: [{ type: 'core::array::Array::<(core::starknet::contract_address::ContractAddress, core::felt252, core::felt252, core::felt252)>' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_player_score',
    inputs: [{ name: 'address', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: '(core::felt252, core::felt252, core::felt252)' }],
    state_mutability: 'view',
  },
] as const

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.startsWith('0x000000')) {
    return []
  }
  try {
    const contract = new Contract(CONTRACT_ABI as any, CONTRACT_ADDRESS, provider)
    const raw = await contract.get_leaderboard()
    return (raw as any[])
      .map((entry: any) => {
        const addr = normalizeAddress(`0x${BigInt(entry[0]).toString(16)}`)
        let name = `0x${addr.slice(2, 8)}...`
        try {
          const usernamefelt = BigInt(entry[3])
          if (usernamefelt !== 0n) {
            name = shortString.decodeShortString(`0x${usernamefelt.toString(16)}`)
          }
        } catch { /* keep default */ }
        return {
          rank: 0,
          address: addr,
          name,
          deaths: Number(entry[1]),
          level: Number(entry[2]),
        }
      })
      .filter(e => e.level >= 10)
      .sort((a, b) => a.deaths - b.deaths)
      .map((e, i) => ({ ...e, rank: i + 1 }))
  } catch (e) {
    console.error('[fetchLeaderboard] error:', e)
    return []
  }
}

export async function submitScore(
  account: any,
  deaths: number,
  levelReached: number,
  username: string
): Promise<string> {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.startsWith('0x000000')) {
    throw new Error('Contract not deployed.')
  }

  // Encode username as felt252 (max 31 ASCII chars)
  const trimmed = username.trim().slice(0, 31)
  const usernameFelt = trimmed
    ? BigInt(shortString.encodeShortString(trimmed)).toString()
    : '0'

  console.log('[submitScore] deaths:', deaths, 'level:', levelReached, 'username:', trimmed)

  try {
    const result = await account.execute([{
      contractAddress: CONTRACT_ADDRESS,
      entrypoint: 'submit_score',
      calldata: [
        BigInt(deaths).toString(),
        BigInt(levelReached).toString(),
        usernameFelt,
      ],
    }])

    const hash = (result as any).transaction_hash ?? (result as any).hash ?? ''
    console.log('[submitScore] tx hash:', hash)
    return hash
  } catch (e: any) {
    const msg: string = e?.message ?? String(e)
    console.error('[submitScore] error:', msg)
    if (/session|policy|unauthorized|not allowed|OutsideExecution|assertion|Invalid caller/i.test(msg)) {
      throw new Error('SESSION_EXPIRED')
    }
    throw new Error(msg || 'Transaction failed')
  }
}

export function voyagerTxUrl(txHash: string): string {
  return `https://voyager.online/tx/${txHash}`
}

export { CallData }
