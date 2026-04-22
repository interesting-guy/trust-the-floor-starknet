const USERNAME_MAP_KEY = 'ttf_usernames' // { [address]: username }

export function getUsername(address: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(USERNAME_MAP_KEY) || '{}')
    return map[address.toLowerCase()] ?? null
  } catch {
    return null
  }
}

export function setUsername(address: string, name: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(USERNAME_MAP_KEY) || '{}')
    map[address.toLowerCase()] = name
    localStorage.setItem(USERNAME_MAP_KEY, JSON.stringify(map))
  } catch {}
}

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
