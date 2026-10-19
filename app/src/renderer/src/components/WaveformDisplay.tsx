import { useEffect, useMemo, useRef } from 'react'

type WaveformDisplayProps = {
  waveform: number[]
  subWaveform?: number[]
  sampleWaveforms?: number[][]
  peak?: number
  pulseToken?: number
}

const ZERO_WAVE = new Array(512).fill(0)
const SAMPLE_LAYER_COLORS = [
  'rgba(224, 224, 224, 0.12)',
  'rgba(224, 224, 224, 0.16)',
  'rgba(224, 224, 224, 0.2)'
]

function safeWave(input?: number[]): number[] {
  if (!input || input.length === 0)
    return ZERO_WAVE
  return input.slice(0, 512).map((point) => (Number.isFinite(point) ? point : 0))
}

function hasSignal(points: number[]): boolean {
  return points.some((p) => Math.abs(p) > 0.001)
}

export default function WaveformDisplay({ waveform, subWaveform, sampleWaveforms, peak = 0, pulseToken = 0 }: WaveformDisplayProps) {
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const layers = useMemo(() => ({
    waveform: safeWave(waveform),
    subWaveform: safeWave(subWaveform),
    sampleWaveforms: [0, 1, 2].map((index) => safeWave(sampleWaveforms?.[index]))
  }), [sampleWaveforms, subWaveform, waveform])

  const activeSampleCount = useMemo(() => layers.sampleWaveforms.filter(hasSignal).length, [layers.sampleWaveforms])
  const hasSubSignal = useMemo(() => hasSignal(layers.subWaveform), [layers.subWaveform])
  const peakDb = peak > 0.0001 ? (20 * Math.log10(peak)).toFixed(1) : '–∞'

  useEffect(() => {
    const canvas = waveCanvasRef.current
    if (!canvas)
      return

    const ctx = canvas.getContext('2d')
    if (!ctx)
      return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, width, height)
    const pulseAmount = pulseToken > 0 ? 1 : 0
    const bg = ctx.createLinearGradient(0, 0, 0, height)
    bg.addColorStop(0, pulseAmount ? 'rgba(31, 48, 66, 0.98)' : '#1E1E1E')
    bg.addColorStop(1, '#171717')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    if (pulseAmount) {
      const flash = ctx.createRadialGradient(width * 0.5, height * 0.45, 10, width * 0.5, height * 0.45, width * 0.55)
      flash.addColorStop(0, 'rgba(91, 141, 184, 0.22)')
      flash.addColorStop(1, 'rgba(91, 141, 184, 0)')
      ctx.fillStyle = flash
      ctx.fillRect(0, 0, width, height)
    }

    // Horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i += 1) {
      const y = (height / 4) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height * 0.5)
    ctx.lineTo(width, height * 0.5)
    ctx.stroke()

    const drawWave = (points: number[], color: string, lineWidth: number) => {
      if (!points.some((point) => Math.abs(point) > 0.0001))
        return

      ctx.beginPath()
      points.forEach((point, index) => {
        const x = (index / Math.max(points.length - 1, 1)) * width
        const y = height * 0.5 - point * (height * 0.34)
        if (index === 0)
          ctx.moveTo(x, y)
        else
          ctx.lineTo(x, y)
      })
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    layers.sampleWaveforms.forEach((layer, index) => drawWave(layer, SAMPLE_LAYER_COLORS[index], 1))
    drawWave(layers.subWaveform, 'rgba(224, 224, 224, 0.35)', 1.05)
    drawWave(layers.waveform, '#E0E0E0', 1.8)
  }, [layers, pulseToken])

  useEffect(() => {
    const canvas = spectrumCanvasRef.current
    if (!canvas)
      return

    const ctx = canvas.getContext('2d')
    if (!ctx)
      return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#1E1E1E'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i += 1) {
      const y = (height / 4) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const bars = 54
    const spectrumSource = layers.waveform
    for (let i = 0; i < bars; i += 1) {
      const bin = spectrumSource[Math.min(spectrumSource.length - 1, Math.floor((i / bars) * spectrumSource.length))] ?? 0
      const energy = Math.abs(bin) * (0.35 + (i / bars) * 1.05) + peak * 0.16
      const barHeight = Math.min(height - 4, energy * height * 1.9)
      const x = (i / bars) * width
      const barWidth = width / bars - 2
      // Color by frequency band: low = warm, high = cool
      const hue = 200 + (i / bars) * 60
      ctx.fillStyle = `hsla(${hue}, 35%, 38%, 0.9)`
      ctx.fillRect(x + 1, height - barHeight, Math.max(2, barWidth), barHeight)
    }

    const peakHeight = Math.min(height - 2, Math.max(2, peak * height))
    const peakY = height - peakHeight
    ctx.beginPath()
    ctx.moveTo(0, peakY)
    ctx.lineTo(width, peakY)
    ctx.strokeStyle = '#5B8DB8'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [layers, peak])

  return (
    <div className="displayRow">
      <section className="displayPanel waveformPanel">
        <div className="displayHeader">
          <span>WAVEFORM</span>
          <div className="displayMeta">
            {hasSubSignal && <span className="displayChip">SUB</span>}
            {activeSampleCount > 0 && <span className="displayChip">{activeSampleCount}× LAYER</span>}
            <span className="displayAccent">OSCILLATOR</span>
          </div>
        </div>
        <canvas ref={waveCanvasRef} className="displayCanvas" />
      </section>
      <section className="displayPanel spectrumPanel">
        <div className="displayHeader">
          <span>SPECTRUM</span>
          <div className="displayMeta">
            <span className="displayAccent">PEAK {peakDb} dBFS</span>
          </div>
        </div>
        <canvas ref={spectrumCanvasRef} className="displayCanvas" />
      </section>
    </div>
  )
}
