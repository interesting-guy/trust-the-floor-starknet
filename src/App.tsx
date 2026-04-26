import { useState, useCallback, useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { HomeScreen } from './components/HomeScreen'
import { WinScreen } from './components/WinScreen'
import { GameCanvas } from './components/GameCanvas'
import { useWallet } from './hooks/useWallet'
import { getPlayerId, getStoredUsername, storeUsername, shortAddress } from './lib/storage'
import { UsernameModal } from './components/UsernameModal'
import type { Screen, WinResult } from './types'

const params = new URLSearchParams(window.location.search)
const adminMode = params.has('admin') || params.has('level')
const urlLevel  = parseInt(params.get('level') || '1', 10)
const defaultStart = (urlLevel >= 1 && urlLevel <= 15) ? urlLevel : 1

export default function App() {
  const [screen, setScreen]     = useState<Screen>('home')
  const [winResult, setWinResult] = useState<WinResult | null>(null)
  const [gameKey, setGameKey]   = useState(0)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [startLevel, setStartLevel] = useState(defaultStart)

  const wallet = useWallet()

  // Cheat key: Ctrl+Shift+W on game screen instantly triggers win (for testing)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (screen === 'game' && e.ctrlKey && e.shiftKey && e.key === 'W') {
        handleGameWon(0, 12345)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen])

  // Show username modal for guests on first load if no name stored
  useEffect(() => {
    const guestId = getPlayerId(null)
    if (!getStoredUsername(guestId)) setShowUsernameModal(true)
  }, [])

  // Show username modal when a wallet connects without a saved username
  useEffect(() => {
    if (wallet.connected && wallet.address) {
      const walletId = getPlayerId(wallet.address)
      if (!getStoredUsername(walletId)) setShowUsernameModal(true)
    }
  }, [wallet.connected, wallet.address])

  function handleUsernameConfirm(name: string) {
    storeUsername(getPlayerId(wallet.address), name)
    setShowUsernameModal(false)
  }

  function handlePlay(level = 1) {
    setStartLevel(level)
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
  const playerId = getPlayerId(wallet.address)
  const storedName = getStoredUsername(playerId)
  const displayName = storedName ?? (wallet.address ? shortAddress(wallet.address) : null)

  return (
    <>
      <Analytics />
      {showUsernameModal && (
        <UsernameModal onConfirm={handleUsernameConfirm} />
      )}

      {screen === 'home' && (
        <HomeScreen
          wallet={wallet}
          onPlay={handlePlay}
          adminMode={adminMode}
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

          <GameCanvas onGameWon={handleGameWon} gameKey={gameKey} startLevel={startLevel} />

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
