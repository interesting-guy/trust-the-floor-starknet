import { useState, useEffect, useCallback } from 'react'
import { submitScoreToSupabase, fetchLeaderboardFromSupabase } from '../lib/supabase'
import { submitScore, voyagerTxUrl } from '../lib/starknet'
import type { LeaderboardEntry } from '../types'

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[]
  loading: boolean
  refresh: () => void
  submit: (
    username: string,
    deaths: number,
    level: number,
    account?: any,
    address?: string,
  ) => Promise<{ txHash?: string; voyagerUrl?: string }>
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
    try {
      const data = await fetchLeaderboardFromSupabase()
      setEntries(data)
    } catch (e) {
      console.error('[leaderboard] fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const submit = useCallback(async (
    username: string,
    deaths: number,
    level: number,
    account?: any,
    address?: string,
  ) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      let txHash: string | undefined
      let txUrl: string | undefined

      // wallet user — submit on-chain first, then to Supabase as verified
      if (account && address) {
        txHash = await submitScore(account, deaths, level, username)
        txUrl = voyagerTxUrl(txHash)
        await submitScoreToSupabase(username, deaths, level, address, true)
      } else {
        // no wallet — Supabase only
        await submitScoreToSupabase(username, deaths, level, undefined, false)
      }

      await new Promise(r => setTimeout(r, 2000))
      await load()
      return { txHash, voyagerUrl: txUrl }
    } catch (e: any) {
      const msg = e?.message ?? 'Submission failed'
      setSubmitError(msg)
      throw new Error(msg)
    } finally {
      setSubmitting(false)
    }
  }, [load])

  return { entries, loading, refresh: load, submit, submitting, submitError }
}
