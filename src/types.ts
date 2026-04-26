export type Screen = 'home' | 'game' | 'win'

export interface LeaderboardEntry {
  rank: number
  address: string
  name: string
  deaths: number
  level: number
  verified?: boolean
}

export interface WinResult {
  deaths: number
  timeMs: number
}

export interface WalletState {
  address: string | null
  connected: boolean
  connecting: boolean
  error: string | null
  walletType: 'cartridge' | 'argent' | 'braavos' | null
}
