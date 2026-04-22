import { useState, useCallback, useEffect } from 'react'
import { HomeScreen } from './components/HomeScreen'
import { WinScreen } from './components/WinScreen'
import { GameCanvas } from './components/GameCanvas'
import { useWallet } from './hooks/useWallet'
import { getUsername, setUsername, shortAddress } from './lib/storage'
import { UsernameModal } from './components/UsernameModal'
import type { Screen, WinResult } from './types'

export default function App() {
  const [screen, setScreen]     = useState<Screen>('home')
  const [winResult, setWinResult] = useState<WinResult | null>(null)
  const [gameKey, setGameKey]   = useState(0)
  const [showUsernameModal, setShowUsernameModal] = useState(false)

  const wallet = useWallet()

  // Show username modal whenever a wallet connects without a saved username
  useEffect(() => {
    if (wallet.connected && wallet.address && !getUsername(wallet.address)) {
      setShowUsernameModal(true)
    }
  }, [wallet.connected, wallet.address])

  function handleUsernameConfirm(name: string) {
    if (wallet.address) setUsername(wallet.address, name)
    setShowUsernameModal(false)
  }

  function handlePlay() {
    setGameKey(k => k + 1)
    setScreen('game')
  }

  function handleGameWon(deaths: number, timeMs: number) {
    setWinResult({ deaths, timeMs })
    setScreen('win')
  }

  function handlePlayAgain() {
    setGameKey(k => k + 1)
    setWinResult(null)
    setScreen('game')
  }

  function handleHome() {
    setScreen('home')
    setWinResult(null)
  }

  // Username shown top-right when in game
  const displayName = wallet.address
    ? (getUsername(wallet.address) ?? shortAddress(wallet.address))
    : null

  return (
    <>
      {showUsernameModal && wallet.address && !getUsername(wallet.address) && (
        <UsernameModal onConfirm={handleUsernameConfirm} />
      )}

      {screen === 'home' && (
        <HomeScreen
          wallet={wallet}
          onPlay={handlePlay}
        />
      )}

      {screen === 'game' && (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, background: '#1a1a2e' }}>
          {/* top bar */}
          <div style={{ width: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', marginBottom: 4 }}>
            <span style={{ fontFamily: 'Courier New, monospace', fontSize: 13, color: '#555580', letterSpacing: 2 }}>
              TRUST THE FLOOR
            </span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {displayName && (
                <span style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: '#666680' }}>
                  {displayName}
                </span>
              )}
              <button
                onClick={handleHome}
                style={{
                  background: 'transparent', border: '1px solid #2a2a4a', color: '#666680',
                  fontFamily: 'Courier New, monospace', fontSize: 11, padding: '5px 12px',
                  cursor: 'pointer', letterSpacing: 1
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = '#444466')}
                onMouseOut={e => (e.currentTarget.style.borderColor = '#2a2a4a')}
              >
                menu
              </button>
            </div>
          </div>

          <GameCanvas onGameWon={handleGameWon} gameKey={gameKey} />

          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#333355', marginTop: 10, letterSpacing: 1 }}>
            ← → move &nbsp;|&nbsp; space / ↑ jump
          </p>
        </div>
      )}

      {screen === 'win' && winResult && (
        <WinScreen
          result={winResult}
          wallet={wallet}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
        />
      )}
    </>
  )
}
