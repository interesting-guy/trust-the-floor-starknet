import { useState } from 'react'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { formatTime } from '../lib/storage'
import { contractDeployed } from '../lib/starknet'
import type { WinResult, WalletState } from '../types'

interface Props {
  result: WinResult
  wallet: WalletState & { account: any }
  onPlayAgain: () => void
  onHome: () => void
}

export function WinScreen({ result, wallet, onPlayAgain, onHome }: Props) {
  const { submit, submitting, submitError } = useLeaderboard()
  const [txHash, setTxHash] = useState<string | null>(null)
  const [voyagerUrl, setVoyagerUrl] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!wallet.account) return
    setTxError(null)
    try {
      const { txHash: hash, voyagerUrl: url } = await submit(wallet.account, result.deaths, 10)
      setTxHash(hash)
      setVoyagerUrl(url)
    } catch (e: any) {
      setTxError(e?.message ?? 'Transaction failed')
    }
  }

  return (
    <div className="screen" style={{ gap: 32 }}>
      <div className="col gap-8" style={{ alignItems: 'center' }}>
        <h1 style={{ fontSize: 28, color: 'var(--accent)', letterSpacing: 3 }}>
          you actually beat it.
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>
          we're surprised too.
        </p>
      </div>

      {/* stats */}
      <div className="card row gap-0" style={{ gap: 0, overflow: 'hidden', borderColor: 'var(--border-hi)' }}>
        <div className="col gap-4" style={{ padding: '20px 32px', borderRight: '1px solid var(--border)', alignItems: 'center' }}>
          <span style={{ fontSize: 36, color: 'var(--red)', fontWeight: 'bold' }}>
            {result.deaths}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
            deaths
          </span>
        </div>
        <div className="col gap-4" style={{ padding: '20px 32px', alignItems: 'center' }}>
          <span style={{ fontSize: 36, color: 'var(--purple)', fontWeight: 'bold' }}>
            {formatTime(result.timeMs)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
            time
          </span>
        </div>
      </div>

      {/* submit score */}
      <div className="card col gap-16" style={{ width: '100%', maxWidth: 400 }}>
        {!txHash ? (
          <>
            {contractDeployed ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {wallet.connected
                    ? 'submit your score on-chain to the leaderboard'
                    : 'connect a wallet on the home screen to submit scores'}
                </p>

                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!wallet.connected || !wallet.account || submitting}
                  style={{ width: '100%' }}
                >
                  {submitting ? 'submitting...' : 'submit score'}
                </button>

                {(txError || submitError) && (
                  <p style={{ fontSize: 11, color: 'var(--red)', wordBreak: 'break-word' }}>
                    {txError || submitError}
                  </p>
                )}
              </>
            ) : (
              <div className="col gap-8">
                <div className="row gap-8">
                  <span className="dot dot-yellow" />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>on-chain leaderboard coming soon</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.6 }}>
                  deploy the Cairo contract and set <code style={{ color: 'var(--muted)' }}>VITE_LEADERBOARD_CONTRACT</code> in <code style={{ color: 'var(--muted)' }}>.env</code> to enable score submission.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="col gap-8">
            <div className="row gap-8">
              <span className="dot dot-green" />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>score submitted</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>tx hash</span>
            <code style={{ fontSize: 11, color: 'var(--muted)', wordBreak: 'break-all' }}>
              {txHash}
            </code>
            {voyagerUrl && (
              <a className="tx-link" href={voyagerUrl} target="_blank" rel="noopener noreferrer">
                view on voyager ↗
              </a>
            )}
          </div>
        )}
      </div>

      <div className="row gap-12">
        <button className="btn btn-primary" onClick={onPlayAgain}>
          play again
        </button>
        <button className="btn btn-ghost" onClick={onHome}>
          home
        </button>
      </div>
    </div>
  )
}
