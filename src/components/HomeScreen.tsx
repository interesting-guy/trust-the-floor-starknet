import { useState } from 'react'
import { UsernameModal } from './UsernameModal'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { getUsername, setUsername, shortAddress } from '../lib/storage'
import type { WalletState } from '../types'

interface Props {
  wallet: WalletState & { account: any; connectCartridge: () => Promise<void>; connectBrowser: () => Promise<void>; disconnect: () => void }
  onPlay: () => void
}

export function HomeScreen({ wallet, onPlay }: Props) {
  const { entries, loading } = useLeaderboard()
  const [showUsernameModal, setShowUsernameModal] = useState(false)

  // Check if connected wallet needs a username
  const username = wallet.address ? getUsername(wallet.address) : null

  function handleConnectCartridge() {
    wallet.connectCartridge().then(() => {
      // After connecting, check if we need a username
      if (wallet.address && !getUsername(wallet.address)) {
        setShowUsernameModal(true)
      }
    })
  }

  function handleConnectBrowser() {
    wallet.connectBrowser().then(() => {
      if (wallet.address && !getUsername(wallet.address)) {
        setShowUsernameModal(true)
      }
    })
  }

  function handleConnectCartridgeWithModal() {
    wallet.connectCartridge().then(() => {}).catch(() => {})
    // Show modal after connection resolves via useEffect-like pattern
    // We handle it differently — see useEffect below
  }

  function handleUsernameConfirm(name: string) {
    if (wallet.address) setUsername(wallet.address, name)
    setShowUsernameModal(false)
  }

  // Show modal when wallet just connected and has no username
  const needsUsername = wallet.connected && wallet.address && !getUsername(wallet.address) && showUsernameModal

  const displayName = wallet.address
    ? (getUsername(wallet.address) ?? shortAddress(wallet.address))
    : null

  return (
    <div className="screen" style={{ gap: 40, minHeight: '100vh', justifyContent: 'flex-start', paddingTop: 60 }}>

      {needsUsername && <UsernameModal onConfirm={handleUsernameConfirm} />}

      {/* ── header ─────────────────────────────── */}
      <div className="col gap-4" style={{ alignItems: 'center' }}>
        <h1 style={{ fontSize: 32, letterSpacing: 6, color: 'var(--text)' }}>
          TRUST THE FLOOR
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, letterSpacing: 2 }}>
          a game that lies to you
        </p>
      </div>

      {/* ── main content: leaderboard + wallet ── */}
      <div style={{ display: 'flex', gap: 32, width: '100%', maxWidth: 860, flexWrap: 'wrap', justifyContent: 'center' }}>

        {/* leaderboard */}
        <div className="card col gap-16" style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>
              leaderboard
            </span>
            {loading && <span style={{ fontSize: 11, color: 'var(--muted)' }}>loading...</span>}
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>name</th>
                <th>deaths ↑</th>
                <th>lvl</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.rank}>
                  <td className={`rank-${e.rank}`} style={{ width: 32, fontWeight: 'bold' }}>
                    {e.rank}
                  </td>
                  <td style={{ color: 'var(--text)' }}>{e.name}</td>
                  <td>{e.deaths}</td>
                  <td>{e.level}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* wallet + play */}
        <div className="col gap-16" style={{ flex: '0 0 240px' }}>

          {!wallet.connected ? (
            <div className="card col gap-12">
              <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>
                connect wallet
              </span>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                connect to submit scores to the on-chain leaderboard
              </p>

              <button
                className="btn btn-primary"
                onClick={handleConnectCartridge}
                disabled={wallet.connecting}
                style={{ width: '100%' }}
              >
                {wallet.connecting ? 'connecting...' : '⚡ cartridge'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <button
                className="btn btn-ghost"
                onClick={handleConnectBrowser}
                disabled={wallet.connecting}
                style={{ width: '100%' }}
              >
                argent / braavos
              </button>

              {wallet.error && (
                <p style={{ fontSize: 11, color: 'var(--red)', wordBreak: 'break-word' }}>
                  {wallet.error}
                </p>
              )}
            </div>
          ) : (
            <div className="card col gap-12">
              <div className="row gap-8">
                <span className="dot dot-green" />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {wallet.walletType}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>
                {displayName}
                {username && (
                  <span style={{ color: 'var(--muted)', fontSize: 11, display: 'block', marginTop: 2 }}>
                    {shortAddress(wallet.address!)}
                  </span>
                )}
              </div>
              <button className="btn btn-ghost" onClick={wallet.disconnect} style={{ fontSize: 11 }}>
                disconnect
              </button>
            </div>
          )}

          {/* play button */}
          <button
            className="btn btn-primary"
            onClick={onPlay}
            style={{ width: '100%', padding: '14px 22px', fontSize: 15, letterSpacing: 2 }}
          >
            play
          </button>

          {!wallet.connected && (
            <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
              play without wallet —<br />scores won't be saved
            </p>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--dim)', fontSize: 11, letterSpacing: 1 }}>
        ← → move &nbsp;|&nbsp; space / ↑ jump &nbsp;|&nbsp; 10 levels
      </p>
    </div>
  )
}
