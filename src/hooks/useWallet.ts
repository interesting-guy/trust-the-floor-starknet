import { useState, useCallback, useRef } from 'react'
import { StarkZap } from '../lib/starkzap'
import type { WalletState } from '../types'

const CONTRACT = import.meta.env.VITE_LEADERBOARD_CONTRACT || ''

const sdk = new StarkZap({ network: 'sepolia' })

interface UseWalletReturn extends WalletState {
  account: any | null
  connectCartridge: () => Promise<void>
  connectBrowser: () => Promise<void>
  disconnect: () => void
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    address: null,
    connected: false,
    connecting: false,
    error: null,
    walletType: null,
  })
  const accountRef = useRef<any>(null)

  const connectCartridge = useCallback(async () => {
    setState(s => ({ ...s, connecting: true, error: null }))
    try {
      const wallet = await sdk.connectCartridge({
        policies: CONTRACT && !CONTRACT.startsWith('0x000')
          ? [{ target: CONTRACT, method: 'submit_score' }]
          : [],
      })
      accountRef.current = wallet.account
      setState({
        address: wallet.address,
        connected: true,
        connecting: false,
        error: null,
        walletType: 'cartridge',
      })
    } catch (e: any) {
      setState(s => ({ ...s, connecting: false, error: e?.message ?? 'Connection failed' }))
    }
  }, [])

  const connectBrowser = useCallback(async () => {
    setState(s => ({ ...s, connecting: true, error: null }))
    try {
      const wallet = await sdk.connectBrowser()
      accountRef.current = wallet.account
      setState({
        address: wallet.address,
        connected: true,
        connecting: false,
        error: null,
        walletType: wallet.type === 'braavos' ? 'braavos' : 'argent',
      })
    } catch (e: any) {
      setState(s => ({ ...s, connecting: false, error: e?.message ?? 'Connection failed' }))
    }
  }, [])

  const disconnect = useCallback(() => {
    accountRef.current = null
    setState({ address: null, connected: false, connecting: false, error: null, walletType: null })
  }, [])

  return { ...state, account: accountRef.current, connectCartridge, connectBrowser, disconnect }
}
