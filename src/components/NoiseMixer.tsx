import { useState } from 'react'
import { useSettings, type NoiseKind } from '../store/settings'
import { noiseEngine } from '../audio/noise'

const CHANNELS: { kind: NoiseKind; label: string }[] = [
  { kind: 'white', label: 'White' },
  { kind: 'pink', label: 'Pink' },
  { kind: 'brown', label: 'Brown' },
]

export function NoiseMixer() {
  const soundMix = useSettings((s) => s.soundMix)
  const setNoiseLevel = useSettings((s) => s.setNoiseLevel)
  const [playing, setPlaying] = useState(false)

  const toggle = () => {
    if (playing) {
      noiseEngine.stop()
      setPlaying(false)
    } else {
      noiseEngine.start(soundMix)
      setPlaying(true)
    }
  }

  const onLevel = (kind: NoiseKind, level: number) => {
    setNoiseLevel(kind, level)
    noiseEngine.setLevel(kind, level)
  }

  return (
    <section className="mixer" aria-label="Background noise mixer">
      <div className="mixer-head">
        <h2 className="mixer-title">Background noise</h2>
        <button className="btn" onClick={toggle} aria-pressed={playing}>
          {playing ? 'Sound off' : 'Sound on'}
        </button>
      </div>
      {CHANNELS.map(({ kind, label }) => (
        <div className="mixer-row" key={kind}>
          <label htmlFor={`noise-${kind}`}>{label}</label>
          <input
            id={`noise-${kind}`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={soundMix[kind]}
            onChange={(e) => onLevel(kind, e.target.valueAsNumber)}
          />
        </div>
      ))}
    </section>
  )
}
