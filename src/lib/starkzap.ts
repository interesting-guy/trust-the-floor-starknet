/**
 * Local StarkZap implementation.
 * Wraps @cartridge/controller (Cartridge) and window.starknet (Argent / Braavos).
 *
 * Matches the API the game calls:
 *   const sdk = new StarkZap({ network: 'sepolia' })
 *   const wallet = await sdk.connectCartridge({ policies: [...] })
 *   const wallet = await sdk.connectBrowser()
 *
 * Replace with the npm `starkzap` package when published.
 */

import { RpcProvider } from 'starknet'

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://api.cartridge.gg/x/starknet/mainnet',
  sepolia: 'https://api.cartridge.gg/x/starknet/sepolia',
}

export interface Policy {
  target: string
  method: string
}

export interface ConnectCartridgeOptions {
  policies?: Policy[]
}

export interface WalletConnection {
  address: string
  account: any          // starknet.js Account (or compatible)
  provider: RpcProvider
  type: 'cartridge' | 'argent' | 'braavos' | 'unknown'
}

export class StarkZap {
  private rpcUrl: string
  readonly provider: RpcProvider

  constructor({ network }: { network: string }) {
    this.rpcUrl = RPC_URLS[network] ?? `https://api.cartridge.gg/x/starknet/${network}`
    this.provider = new RpcProvider({ nodeUrl: this.rpcUrl })
  }

  // ── Cartridge wallet (@cartridge/controller v0.13+) ─────────────────────
  async connectCartridge({ policies = [] }: ConnectCartridgeOptions = {}): Promise<WalletConnection> {
    let Controller: any
    try {
      const mod = await import('@cartridge/controller')
      Controller = mod.default
    } catch {
      throw new Error('@cartridge/controller not installed. Run: npm install @cartridge/controller')
    }

    // Normalize addresses to full 66-char hex so Cartridge policy lookup matches exactly
    const norm = (addr: string) => '0x' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0')

    // Build session policies (call-policy shape expected by @cartridge/controller v0.13)
    const sessionPolicies = policies.length
      ? { contracts: Object.fromEntries(policies.map(p => [
          norm(p.target),
          { methods: [{ name: p.method, entrypoint: p.method }] },
        ]))
        }
      : undefined

    const controller = new Controller({
      rpcUrl: this.rpcUrl,
      feeSource: 'CREDITS',
      ...(sessionPolicies ? { policies: sessionPolicies } : {}),
    })

    const walletAccount = await controller.connect()
    if (!walletAccount) throw new Error('Cartridge connection cancelled')

    const address: string = walletAccount.address ?? ''

    return { address, account: walletAccount, provider: this.provider, type: 'cartridge' }
  }

  // ── Browser wallet (Argent X / Braavos) ────────────────────────────────
  async connectBrowser(): Promise<WalletConnection> {
    // @starknet-io/get-starknet-core provides wallet discovery utilities; actual enable
    // goes through the injected window.starknet* objects.
    const win = window as any

    // Prefer the wallet the user last connected (argentX or braavos)
    const starknet =
      win.starknet_argentX ??
      win.starknet_braavos ??
      win.starknet

    if (!starknet) {
      throw new Error('No Starknet wallet extension found. Install Argent X or Braavos.')
    }

    await starknet.enable({ starknetVersion: 'v5' })

    const address: string = starknet.selectedAddress ?? ''
    if (!address) throw new Error('Wallet connected but no address returned.')

    const type: 'argent' | 'braavos' =
      (starknet.id ?? '').toLowerCase().includes('braavos') ? 'braavos' : 'argent'

    return { address, account: starknet.account, provider: this.provider, type }
  }
}
