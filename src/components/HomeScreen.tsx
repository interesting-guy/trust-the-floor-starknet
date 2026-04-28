import { useLeaderboard } from '../hooks/useLeaderboard'
import { getPlayerId, getStoredUsername, shortAddress, formatTimeMM_SS } from '../lib/storage'
import type { WalletState } from '../types'

interface Props {
  wallet: WalletState & { account: any; connectCartridge: () => Promise<void>; connectBrowser: () => Promise<void>; disconnect: () => void }
  onPlay: (level?: number) => void
  adminMode?: boolean
}

export function HomeScreen({ wallet, onPlay, adminMode }: Props) {
  const { entries, loading } = useLeaderboard()

  const myPlayerId = getPlayerId(wallet.address)
  const myName = getStoredUsername(myPlayerId)

  const displayName = myName ?? (wallet.address ? shortAddress(wallet.address) : null)

  return (
    <div className="screen" style={{ gap: 40, minHeight: '100vh', justifyContent: 'flex-start', paddingTop: 60 }}>

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
                <th>deaths</th>
                <th>time</th>
                <th>lvl</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const isMe = e.sessionId === myPlayerId
                const rowName = isMe ? (myName ?? e.name) : e.name
                return (
                  <tr key={e.rank}>
                    <td className={`rank-${e.rank}`} style={{ width: 32, fontWeight: 'bold' }}>
                      {e.rank}
                    </td>
                    <td style={{ color: isMe ? 'var(--accent)' : 'var(--text)' }}>
                      {rowName}
                      {e.verified && <span title="verified on-chain" style={{ marginLeft: 5, fontSize: 10, color: 'var(--muted)' }}>⛓</span>}
                    </td>
                    <td>{e.deaths}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTimeMM_SS(e.timeSeconds)}</td>
                    <td>{e.level}/15</td>
                  </tr>
                )
              })}
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
                beat the game → sign one transaction → score is on-chain forever
              </p>

              <button
                className="btn btn-primary"
                onClick={() => wallet.connectCartridge()}
                disabled={wallet.connecting}
                style={{ width: '100%' }}
              >
                {wallet.connecting ? 'connecting...' : '⚡ cartridge'}
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => wallet.connectBrowser()}
                disabled={wallet.connecting}
                style={{ width: '100%' }}
              >
                argent x / braavos
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
                {myName && wallet.address && (
                  <span style={{ color: 'var(--muted)', fontSize: 11, display: 'block', marginTop: 2 }}>
                    {shortAddress(wallet.address)}
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
            onClick={() => onPlay(1)}
            style={{ width: '100%', padding: '14px 22px', fontSize: 15, letterSpacing: 2 }}
          >
            play
          </button>

          {!wallet.connected && (
            <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
              connect wallet for<br />on-chain verified score ⛓
            </p>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--dim)', fontSize: 11, letterSpacing: 1 }}>
        ← → / A D move &nbsp;|&nbsp; space / ↑ / W jump &nbsp;|&nbsp; 15 levels
      </p>

      {adminMode && (
        <div className="card col gap-12" style={{ width: '100%', maxWidth: 860 }}>
          <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>
            ⚙ level select
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({length: 15}, (_, i) => i + 1).map(n => (
              <button
                key={n}
                className="btn btn-ghost"
                onClick={() => onPlay(n)}
                style={{ minWidth: 44, fontSize: 12, padding: '6px 10px' }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
