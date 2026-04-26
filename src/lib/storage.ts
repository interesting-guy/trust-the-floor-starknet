const USERNAME_MAP_KEY = 'ttf_usernames'

export function normalizeAddress(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '')
  return '0x' + hex.padStart(64, '0')
}

// ── Session / player identity ─────────────────────────────────────────────────

export function getSessionId(): string {
  try {
    let id = localStorage.getItem('ttf_session_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('ttf_session_id', id)
    }
    return id
  } catch {
    return 'fallback-' + Math.random().toString(36).slice(2)
  }
}

export function getPlayerId(walletAddress?: string | null): string {
  if (walletAddress) return normalizeAddress(walletAddress)
  return getSessionId()
}

// ── Per-player username (keyed by playerId) ───────────────────────────────────

export function getStoredUsername(playerId: string): string | null {
  try {
    return localStorage.getItem('ttf_username_' + playerId)
  } catch {
    return null
  }
}

export function storeUsername(playerId: string, name: string): void {
  try {
    localStorage.setItem('ttf_username_' + playerId, name)
  } catch {}
}

// ── Legacy wallet username map (kept for display fallback) ────────────────────

export function getUsername(address: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(USERNAME_MAP_KEY) || '{}')
    return map[normalizeAddress(address)] ?? null
  } catch {
    return null
  }
}

export function setUsername(address: string, name: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(USERNAME_MAP_KEY) || '{}')
    map[normalizeAddress(address)] = name
    localStorage.setItem(USERNAME_MAP_KEY, JSON.stringify(map))
  } catch {}
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function shortAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}m ${ss.toString().padStart(2, '0')}s`
}

export function formatTimeMM_SS(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
