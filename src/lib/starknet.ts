import { RpcProvider, Contract, CallData, cairo } from 'starknet'
import { normalizeAddress } from './storage'
import type { LeaderboardEntry } from '../types'

// ── Cairo contract stub (deploy separately) ──────────────────────────────────
//
// #[starknet::interface]
// trait ITrustTheFloor<TContractState> {
//   fn submit_score(ref self: TContractState, deaths: felt252, level_reached: felt252);
//   fn get_leaderboard(self: @TContractState) -> Array<(ContractAddress, felt252, felt252)>;
//   fn get_player_score(self: @TContractState, address: ContractAddress) -> (felt252, felt252);
// }
//
// ─────────────────────────────────────────────────────────────────────────────

const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://api.cartridge.gg/x/starknet/mainnet'
const CONTRACT_ADDRESS = import.meta.env.VITE_LEADERBOARD_CONTRACT || '0x03cbbf5d478f747d480b6cb33c44ccbe1d5741966b141143018caa45dd3b39b7'

export const contractDeployed = Boolean(CONTRACT_ADDRESS && !CONTRACT_ADDRESS.startsWith('0x000000'))

export const provider = new RpcProvider({ nodeUrl: RPC_URL })

const CONTRACT_ABI = [
  {
    type: 'function',
    name: 'submit_score',
    inputs: [
      { name: 'deaths', type: 'core::felt252' },
      { name: 'level_reached', type: 'core::felt252' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'get_leaderboard',
    inputs: [],
    outputs: [{ type: 'core::array::Array::<(core::starknet::contract_address::ContractAddress, core::felt252, core::felt252)>' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_player_score',
    inputs: [{ name: 'address', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: '(core::felt252, core::felt252)' }],
    state_mutability: 'view',
  },
] as const

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, address: '0x04a3b1...f91b', name: 'floor_truther', deaths: 12,  level: 10 },
  { rank: 2, address: '0x0b22c4...44d2', name: 'spike_enjoyer', deaths: 31,  level: 10 },
  { rank: 3, address: '0x09ff71...1aa2', name: 'anon',          deaths: 47,  level: 10 },
  { rank: 4, address: '0x05121e...8bc0', name: 'trust_issues',  deaths: 89,  level: 10 },
  { rank: 5, address: '0x0c71ab...3ef4', name: 'gravity_what',  deaths: 156, level: 10 },
]

export async function fetchLeaderboard(
  nameResolver: (addr: string) => string | null
): Promise<LeaderboardEntry[]> {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.startsWith('0x000000')) {
    return MOCK_LEADERBOARD
  }
  try {
    const contract = new Contract(CONTRACT_ABI as any, CONTRACT_ADDRESS, provider)
    const raw = await contract.get_leaderboard()
    // raw is an array of [address, deaths, level_reached] tuples
    return (raw as any[])
      .map((entry: any) => {
        const addr = normalizeAddress(`0x${BigInt(entry[0]).toString(16)}`)
        return {
          rank: 0,
          address: addr,
          name: nameResolver(addr) ?? `0x${addr.slice(2, 8)}...`,
          deaths: Number(entry[1]),
          level: Number(entry[2]),
        }
      })
      .filter(e => e.level >= 10)           // only all-10-levels completers
      .sort((a, b) => a.deaths - b.deaths)  // fewest deaths = best rank
      .map((e, i) => ({ ...e, rank: i + 1 }))
  } catch {
    return MOCK_LEADERBOARD
  }
}

export async function submitScore(
  account: any,
  deaths: number,
  levelReached: number
): Promise<string> {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.startsWith('0x000000')) {
    throw new Error('Contract not deployed. Set VITE_LEADERBOARD_CONTRACT in .env')
  }

  console.log('[submitScore] contract:', CONTRACT_ADDRESS)
  console.log('[submitScore] args — deaths:', deaths, 'level_reached:', levelReached)

  try {
    // Use account.execute directly — avoids ABI double-encoding and works
    // reliably with Cartridge session keys (which validate call against policy).
    const result = await account.execute([{
      contractAddress: CONTRACT_ADDRESS,
      entrypoint: 'submit_score',
      calldata: [BigInt(deaths).toString(), BigInt(levelReached).toString()],
    }])

    const hash = (result as any).transaction_hash ?? (result as any).hash ?? ''
    console.log('[submitScore] tx hash:', hash)
    return hash
  } catch (e: any) {
    const msg: string = e?.message ?? String(e)
    console.error('[submitScore] error:', msg)

    // Detect stale/expired Cartridge session or policy mismatch
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
