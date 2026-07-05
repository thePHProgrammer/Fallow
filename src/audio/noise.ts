import type { NoiseKind } from '../store/settings'

/**
 * Procedural sound via the Web Audio API — no audio assets, no network.
 * Each sound is a looped buffer feeding its own GainNode, so channels mix
 * independently. The Web Audio clock is not throttled in background tabs,
 * so sound keeps playing while you work elsewhere.
 */

/** Loop length per sound. Textures with slow structure (waves) need a long
 *  loop before the repetition becomes audible. */
const KIND_SECONDS: Record<NoiseKind, number> = {
  white: 4,
  pink: 4,
  brown: 4,
  rain: 6,
  waves: 16,
}

/** Samples crossfaded from tail into head so every loop is seamless. */
const LOOP_FADE = 4096

type Filler = (data: Float32Array, sampleRate: number) => void

function fillWhite(data: Float32Array): void {
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
}

/** Paul Kellet's refined pink noise approximation (-3 dB/octave). */
function fillPink(data: Float32Array): void {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
}

/** Brown noise: leaky integration of white (-6 dB/octave). */
function fillBrown(data: Float32Array): void {
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.02 * w) / 1.02
    data[i] = last * 3.5
  }
}

/** Rain: steady high-passed hiss (the patter bed) plus sparse randomized
 *  droplet transients with fast exponential decay. */
function fillRain(data: Float32Array, sampleRate: number): void {
  let lp = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    lp += 0.12 * (w - lp)
    data[i] = (w - lp) * 0.16
  }
  const seconds = data.length / sampleRate
  const drops = Math.floor(seconds * 28)
  const dropLen = Math.floor(sampleRate * 0.012)
  for (let d = 0; d < drops; d++) {
    const pos = Math.floor(Math.random() * (data.length - dropLen))
    const amp = 0.06 + Math.random() * 0.22
    const tau = sampleRate * (0.0015 + Math.random() * 0.006)
    for (let t = 0; t < dropLen; t++) {
      data[pos + t] += (Math.random() * 2 - 1) * amp * Math.exp(-t / tau)
    }
  }
}

/** Waves: brown-noise rumble swelling on a slow envelope (two swells per
 *  loop, so the loop point lands mid-cycle and stays seamless) with white
 *  crest hiss that only appears near the top of each swell. */
function fillWaves(data: Float32Array, sampleRate: number): void {
  const cycles = 2
  const loopLen = sampleRate * KIND_SECONDS.waves
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const phase = (i / loopLen) * Math.PI * 2 * cycles
    const env = Math.pow(0.5 + 0.5 * Math.sin(phase), 1.6)
    const w = Math.random() * 2 - 1
    last = (last + 0.02 * w) / 1.02
    data[i] = last * 3.2 * (0.25 + 0.75 * env) + w * 0.06 * env * env * env
  }
}

const FILLERS: Record<NoiseKind, Filler> = {
  white: fillWhite,
  pink: fillPink,
  brown: fillBrown,
  rain: fillRain,
  waves: fillWaves,
}

/** Render one loop of a sound with LOOP_FADE extra samples generated past
 *  the end and crossfaded into the head, so the loop point never clicks. */
export function renderLoop(kind: NoiseKind, sampleRate: number): Float32Array {
  const len = sampleRate * KIND_SECONDS[kind]
  const temp = new Float32Array(len + LOOP_FADE)
  FILLERS[kind](temp, sampleRate)
  const out = temp.subarray(0, len)
  for (let k = 0; k < LOOP_FADE; k++) {
    const t = k / LOOP_FADE
    out[k] = out[k] * t + temp[len + k] * (1 - t)
  }
  return out
}

class NoiseEngine {
  private ctx: AudioContext | null = null
  private gains = new Map<NoiseKind, GainNode>()
  playing = false

  /** Must be called from a user gesture the first time (autoplay policy). */
  start(levels: Record<NoiseKind, number>): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      for (const kind of Object.keys(FILLERS) as NoiseKind[]) {
        const loop = renderLoop(kind, this.ctx.sampleRate)
        const buffer = this.ctx.createBuffer(1, loop.length, this.ctx.sampleRate)
        buffer.copyToChannel(loop, 0)
        const source = this.ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        const gain = this.ctx.createGain()
        gain.gain.value = 0
        source.connect(gain).connect(this.ctx.destination)
        source.start()
        this.gains.set(kind, gain)
      }
    }
    void this.ctx.resume()
    this.playing = true
    for (const [kind, gain] of this.gains) this.ramp(gain, levels[kind] ?? 0)
  }

  stop(): void {
    this.playing = false
    for (const gain of this.gains.values()) this.ramp(gain, 0)
  }

  setLevel(kind: NoiseKind, level: number): void {
    const gain = this.gains.get(kind)
    if (gain && this.playing) this.ramp(gain, level)
  }

  /** Two soft sine tones to mark a phase change; audible even when the tab
   *  is in the background because it runs on the audio clock. */
  chime(): void {
    if (!this.ctx) this.ctx = new AudioContext()
    void this.ctx.resume()
    const t0 = this.ctx.currentTime
    for (const [freq, at] of [
      [523.25, 0],
      [659.25, 0.35],
    ] as const) {
      const osc = this.ctx.createOscillator()
      osc.frequency.value = freq
      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0, t0 + at)
      env.gain.linearRampToValueAtTime(0.08, t0 + at + 0.02)
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 1.2)
      osc.connect(env).connect(this.ctx.destination)
      osc.start(t0 + at)
      osc.stop(t0 + at + 1.3)
    }
  }

  private ramp(gain: GainNode, target: number): void {
    if (!this.ctx) return
    gain.gain.cancelScheduledValues(this.ctx.currentTime)
    gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1)
  }
}

export const noiseEngine = new NoiseEngine()
