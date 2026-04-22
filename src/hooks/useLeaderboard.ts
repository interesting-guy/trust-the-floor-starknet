import { useState, useEffect, useCallback } from 'react'
import { fetchLeaderboard, submitScore, voyagerTxUrl } from '../lib/starknet'
import { getUsername } from '../lib/storage'
import type { LeaderboardEntry } from '../types'

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[]
  loading: boolean
  refresh: () => void
  submit: (account: any, deaths: number, level: number) => Promise<{ txHash: string; voyagerUrl: string }>
  submitting: boolean
  submitError: string | null
}

export function useLeaderboard(): UseLeaderboardReturn {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchLeaderboard(addr => getUsername(addr))
    setEntries(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const submit = useCallback(async (account: any, deaths: number, level: number) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const txHash = await submitScore(account, deaths, level)
      await new Promise(r => setTimeout(r, 4000)) // wait for tx to be indexed
      await load()
      return { txHash, voyagerUrl: voyagerTxUrl(txHash) }
    } catch (e: any) {
      const msg = e?.message ?? 'Transaction failed'
      setSubmitError(msg)
      throw new Error(msg)
    } finally {
      setSubmitting(false)
    }
  }, [load])

  return { entries, loading, refresh: load, submit, submitting, submitError }
}
