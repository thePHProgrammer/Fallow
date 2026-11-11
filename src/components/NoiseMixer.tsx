import { useEffect, useState } from 'react'
import { useSettings, type NoiseKind } from '../store/settings'
import { noiseEngine } from '../audio/noise'
import { useUi, WAVES_THRESHOLD } from '../store/ui'
import { radio, type RadioStatus, type Station } from '../audio/radio'

const CHANNELS: { kind: NoiseKind; label: string }[] = [
  { kind: 'white', label: 'White' },
  { kind: 'pink', label: 'Pink' },
  { kind: 'brown', label: 'Brown' },
  { kind: 'rain', label: 'Rain' },
  { kind: 'waves', label: 'Waves' },
]

function radioLine(status: RadioStatus, station: Station | null): string {
  switch (status) {
    case 'idle':
      return 'Streams live lofi when you press play. Needs a connection.'
    case 'connecting':
      return station ? `Tuning in to ${station.name}…` : 'Finding a station…'
    case 'playing':
      return `Playing · ${station?.name ?? 'lofi radio'}`
    case 'error':
      return 'Could not reach a station — the radio needs a connection.'
  }
}

function LofiRadio() {
  const volume = useSettings((s) => s.radioVolume)
  const setVolume = useSettings((s) => s.setRadioVolume)
  const [status, setStatus] = useState<RadioStatus>(radio.status)
  const [station, setStation] = useState<Station | null>(radio.station)

  useEffect(() => {
    radio.setVolume(volume)
  }, [volume])

  useEffect(
    () =>
      radio.subscribe((st, sn) => {
        setStatus(st)
        setStation(sn)
      }),
    [],
  )

  const on = status === 'connecting' || status === 'playing'

  return (
    <div className="radio">
      <div className="mixer-head">
        <h2 className="mixer-title">Lofi radio</h2>
        <div className="radio-actions">
          {on && (
            <button className="btn btn-quiet" onClick={() => radio.skip()}>
              Next station
            </button>
          )}
          <button
            className="btn"
            aria-pressed={on}
            onClick={() => (on ? radio.stop() : void radio.play())}
          >
            {on ? 'Radio off' : 'Play lofi'}
          </button>
        </div>
      </div>
      <p className="radio-status" aria-live="polite">
        {radioLine(status, station)}
      </p>
      <div className="mixer-row">
        <label htmlFor="radio-volume">Volume</label>
        <input
          id="radio-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(e.target.valueAsNumber)}
        />
      </div>
    </div>
  )
}

export function NoiseMixer() {
  const soundMix = useSettings((s) => s.soundMix)
  const setNoiseLevel = useSettings((s) => s.setNoiseLevel)
  const playing = useUi((u) => u.noiseOn)
  const setPlaying = useUi((u) => u.setNoiseOn)
  const overWater = playing && soundMix.waves > WAVES_THRESHOLD

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
    <section className="mixer" aria-label="Background sound">
      <LofiRadio />
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
      <p className="radio-status" aria-live="polite">
        {overWater
          ? 'The bird is out over the water.'
          : 'Turn up Waves with sound on and the bird flies out to sea.'}
      </p>
    </section>
  )
}
