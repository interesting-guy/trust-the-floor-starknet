import { createClient } from '@supabase/supabase-js'
import type { LeaderboardEntry } from '../types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qbmixbcrbyokvlbzsrcx.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibWl4YmNyYnlva3ZsYnpzcmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjMzNjMsImV4cCI6MjA5Mjc5OTM2M30.ABFdQoxX-fRASjTF14iL_F7MF-USJ6i-aZ7uB-ghwjw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function submitScoreToSupabase(
  username: string,
  deaths: number,
  levelReached: number,
  address?: string,
  verified = false,
): Promise<void> {
  if (address) {
    const { error } = await supabase.from('scores').upsert(
      { username, deaths, level_reached: levelReached, address: address.toLowerCase(), verified },
      { onConflict: 'address' },
    )
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('scores')
      .insert({ username, deaths, level_reached: levelReached, verified: false })
    if (error) throw new Error(error.message)
  }
}

export async function fetchLeaderboardFromSupabase(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('id, username, address, deaths, level_reached, verified')
    .gte('level_reached', 10)
    .order('deaths', { ascending: true })
    .limit(100)

  if (error) throw new Error(error.message)

  // deduplicate by address — keep lowest deaths row per address
  const seen = new Map<string, typeof data[0]>()
  for (const row of data ?? []) {
    const key = row.address ? row.address.toLowerCase() : row.id
    const existing = seen.get(key)
    if (!existing || row.deaths < existing.deaths) seen.set(key, row)
  }

  return Array.from(seen.values())
    .sort((a, b) => a.deaths - b.deaths)
    .slice(0, 50)
    .map((row, i) => ({
      rank: i + 1,
      address: row.address ?? '',
      name: row.username || (row.address ? `0x${row.address.slice(2, 8)}...` : 'anon'),
      deaths: row.deaths,
      level: row.level_reached,
      verified: row.verified ?? false,
    }))
}
