/**
 * Lofi internet radio — the one opt-in, network-dependent feature. It never
 * autoplays and is never cached by the service worker (cross-origin).
 *
 * Stream URLs move around, so stations are looked up when you press play
 * from the public Radio Browser directory (most-played working "lofi"
 * stations), with a few hand-picked fallbacks. If one fails, the next one
 * is tried.
 */

export type RadioStatus = 'idle' | 'connecting' | 'playing' | 'error'

export interface Station {
  name: string
  url: string
}

const FALLBACK_STATIONS: Station[] = [
  { name: 'laut.fm lofi', url: 'https://stream.laut.fm/lofi' },
  { name: 'Lofi Hip Hop Radio', url: 'https://stream.zeno.fm/0r0xa792kwzuv' },
  { name: 'SomaFM Groove Salad', url: 'https://ice2.somafm.com/groovesalad-128-mp3' },
]

const DIRECTORY =
  'https://de1.api.radio-browser.info/json/stations/bytag/lofi' +
  '?order=clickcount&reverse=true&hidebroken=true&limit=12'

interface DirectoryEntry {
  name: string
  url_resolved: string
  codec: string
  lastcheckok: number
}

async function lookupStations(): Promise<Station[]> {
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(DIRECTORY, { signal: ctrl.signal })
    clearTimeout(timeout)
    if (!res.ok) return []
    const list = (await res.json()) as DirectoryEntry[]
    return list
      .filter(
        (s) =>
          s.lastcheckok === 1 &&
          s.url_resolved.startsWith('https://') &&
          /mp3|aac/i.test(s.codec),
      )
      .slice(0, 5)
      .map((s) => ({ name: s.name.trim(), url: s.url_resolved }))
  } catch {
    return []
  }
}

type Listener = (status: RadioStatus, station: Station | null) => void

class RadioPlayer {
  private audio: HTMLAudioElement | null = null
  private stations: Station[] = []
  private index = 0
  /** Bumped on every tune/stop, so a stale failure (a failed stream fires
   *  both an error event and a rejected play()) is handled only once. */
  private attempt = 0
  private volume = 0.35
  private listeners = new Set<Listener>()
  status: RadioStatus = 'idle'
  station: Station | null = null

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(status: RadioStatus): void {
    this.status = status
    for (const fn of this.listeners) fn(status, this.station)
  }

  private element(): HTMLAudioElement {
    if (this.audio) return this.audio
    const a = new Audio()
    a.preload = 'none'
    a.volume = this.volume
    a.addEventListener('playing', () => {
      if (this.status === 'connecting' || this.status === 'playing') this.emit('playing')
    })
    a.addEventListener('waiting', () => {
      if (this.status === 'playing') this.emit('connecting')
    })
    a.addEventListener('error', () => this.fail(this.attempt))
    this.audio = a
    return a
  }

  /** Must be called from a user gesture (autoplay policy). */
  async play(): Promise<void> {
    this.element()
    this.station = null
    this.emit('connecting')
    if (this.stations.length === 0) {
      const found = await lookupStations()
      const seen = new Set(found.map((s) => s.url))
      this.stations = [...found, ...FALLBACK_STATIONS.filter((s) => !seen.has(s.url))]
      this.index = 0
    }
    if (this.status === 'idle') return // stopped while looking up
    this.tune()
  }

  private tune(): void {
    const a = this.element()
    const attempt = ++this.attempt
    if (this.index >= this.stations.length) {
      // Every station failed — most likely offline. Start over next time.
      this.station = null
      this.index = 0
      this.stations = []
      a.removeAttribute('src')
      this.emit('error')
      return
    }
    this.station = this.stations[this.index]
    this.emit('connecting')
    a.src = this.station.url
    a.play().catch(() => this.fail(attempt))
  }

  private fail(attempt: number): void {
    if (attempt !== this.attempt || this.status !== 'connecting') return
    this.index += 1
    this.tune()
  }

  /** Try a different station. */
  skip(): void {
    if (this.status !== 'playing' && this.status !== 'connecting') return
    if (this.stations.length === 0) return
    this.index = (this.index + 1) % this.stations.length
    this.tune()
  }

  stop(): void {
    this.attempt++
    this.emit('idle')
    if (!this.audio) return
    this.audio.pause()
    // Dropping the src closes the stream instead of buffering forever.
    this.audio.removeAttribute('src')
    this.audio.load()
  }

  setVolume(level: number): void {
    this.volume = level
    if (this.audio) this.audio.volume = level
  }
}

export const radio = new RadioPlayer()
