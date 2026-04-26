import { createClient } from '@supabase/supabase-js'
import type { LeaderboardEntry } from '../types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qbmixbcrbyokvlbzsrcx.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibWl4YmNyYnlva3ZsYnpzcmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjMzNjMsImV4cCI6MjA5Mjc5OTM2M30.ABFdQoxX-fRASjTF14iL_F7MF-USJ6i-aZ7uB-ghwjw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function submitScoreToSupabase(
  playerId: string,
  username: string,
  deaths: number,
  timeSeconds: number,
  levelReached: number,
  isWalletVerified: boolean,
): Promise<void> {
  const { data: existing } = await supabase
    .from('scores')
    .select('best_deaths, best_time_seconds, total_plays')
    .eq('session_id', playerId)
    .single()

  const isNewRecord =
    !existing ||
    deaths < existing.best_deaths ||
    (deaths === existing.best_deaths && timeSeconds < existing.best_time_seconds)

  const { error } = await supabase.from('scores').upsert(
    {
      session_id: playerId,
      username,
      is_wallet_verified: isWalletVerified,
      best_deaths: isNewRecord ? deaths : existing!.best_deaths,
      best_time_seconds: isNewRecord ? timeSeconds : existing!.best_time_seconds,
      level_reached: levelReached,
      total_plays: (existing?.total_plays ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' },
  )

  if (error) throw new Error(error.message)
}

export async function fetchLeaderboardFromSupabase(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('session_id, username, is_wallet_verified, best_deaths, best_time_seconds, level_reached')
    .order('level_reached', { ascending: false })
    .order('best_deaths', { ascending: true })
    .order('best_time_seconds', { ascending: true })
    .limit(50)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    sessionId: row.session_id,
    name: row.username || 'anon',
    deaths: row.best_deaths,
    timeSeconds: row.best_time_seconds,
    level: row.level_reached,
    verified: row.is_wallet_verified ?? false,
  }))
}
