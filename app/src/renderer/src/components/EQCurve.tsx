import { useEffect, useMemo, useRef, useState } from 'react'

type EQPointKey = 'eqLowShelf' | 'eqLowMid' | 'eqHighMid' | 'eqHighShelf'

type EQCurveProps = {
  params: SynthParams
  onChange: (updates: Partial<SynthParams>) => void
}

const MIN_FREQ = 20
const MAX_FREQ = 20000
const MIN_DB = -12
const MAX_DB = 12
const EQ_POINT_COLOR = '#5B8DB8'
const EQ_FILL_COLOR = 'rgba(91, 141, 184, 0.12)'

function freqToX(freq: number, width: number): number {
  const minLog = Math.log10(MIN_FREQ)
  const maxLog = Math.log10(MAX_FREQ)
  return ((Math.log10(freq) - minLog) / (maxLog - minLog)) * width
}

function xToFreq(x: number, width: number): number {
  const minLog = Math.log10(MIN_FREQ)
  const maxLog = Math.log10(MAX_FREQ)
  const ratio = Math.min(1, Math.max(0, x / Math.max(width, 1)))
  return 10 ** (minLog + ratio * (maxLog - minLog))
}

function dbToY(db: number, height: number): number {
  return ((MAX_DB - db) / (MAX_DB - MIN_DB)) * height
}

function yToDb(y: number, height: number): number {
  const ratio = Math.min(1, Math.max(0, y / Math.max(height, 1)))
  return MAX_DB - ratio * (MAX_DB - MIN_DB)
}

export default function EQCurve({ params, onChange }: EQCurveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [dragging, setDragging] = useState<EQPointKey | null>(null)

  const points = useMemo(() => ([
    { key: 'eqLowShelf' as const, x: params.eqLowShelfHz, y: params.eqLowShelfDb },
    { key: 'eqLowMid' as const, x: params.eqLowMidHz, y: params.eqLowMidDb },
    { key: 'eqHighMid' as const, x: params.eqHighMidHz, y: params.eqHighMidDb },
    { key: 'eqHighShelf' as const, x: params.eqHighShelfHz, y: params.eqHighShelfDb }
  ]), [params])

  useEffect(() => {
    const canvas = canvasRef.current
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

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1

    ;[20, 40, 80, 200, 500, 1000, 2000, 5000, 8000, 12000, 20000].forEach((freq) => {
      const x = freqToX(freq, width)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    })

    ;[-12, -6, 0, 6, 12].forEach((db) => {
      const y = dbToY(db, height)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    })

    const responseAt = (freq: number): number => {
      const lowShelf = params.eqLowShelfDb * Math.exp(-Math.pow((Math.log(freq / params.eqLowShelfHz)) / 1.35, 2))
      const lowMid = params.eqLowMidDb * Math.exp(-Math.pow((Math.log(freq / params.eqLowMidHz)) / Math.max(params.eqLowMidQ, 0.3), 2))
      const highMid = params.eqHighMidDb * Math.exp(-Math.pow((Math.log(freq / params.eqHighMidHz)) / Math.max(params.eqHighMidQ, 0.3), 2))
      const highShelf = params.eqHighShelfDb * Math.exp(-Math.pow((Math.log(freq / params.eqHighShelfHz)) / 1.35, 2))
      return lowShelf + lowMid + highMid + highShelf
    }

    ctx.beginPath()
    for (let px = 0; px < width; px += 1) {
      const freq = xToFreq(px, width)
      const y = dbToY(responseAt(freq), height)
      if (px === 0)
        ctx.moveTo(px, y)
      else
        ctx.lineTo(px, y)
    }
    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fillStyle = EQ_FILL_COLOR
    ctx.fill()

    ctx.beginPath()
    for (let px = 0; px < width; px += 1) {
      const freq = xToFreq(px, width)
      const y = dbToY(responseAt(freq), height)
      if (px === 0)
        ctx.moveTo(px, y)
      else
        ctx.lineTo(px, y)
    }
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 1.5
    ctx.stroke()

    points.forEach((point) => {
      const x = freqToX(point.x, width)
      const y = dbToY(point.y, height)
      ctx.fillStyle = EQ_POINT_COLOR
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
      ctx.lineWidth = 1
      ctx.stroke()
    })
  }, [params, points])

  useEffect(() => {
    if (!dragging)
      return undefined

    const handleMove = (event: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas)
        return

      const rect = canvas.getBoundingClientRect()
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      const freq = xToFreq(localX, rect.width)
      const db = yToDb(localY, rect.height)

      if (dragging === 'eqLowShelf') onChange({ eqLowShelfHz: freq, eqLowShelfDb: db })
      if (dragging === 'eqLowMid') onChange({ eqLowMidHz: freq, eqLowMidDb: db })
      if (dragging === 'eqHighMid') onChange({ eqHighMidHz: freq, eqHighMidDb: db })
      if (dragging === 'eqHighShelf') onChange({ eqHighShelfHz: freq, eqHighShelfDb: db })
    }

    const handleUp = () => setDragging(null)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, onChange])

  return (
    <div className="eqCurveShell">
      <div className="eqScale eqScaleTop" aria-hidden="true">
        <span>+12 dB</span>
        <span>0 dB</span>
        <span>-12 dB</span>
      </div>
      <canvas
        ref={canvasRef}
        className="eqCurveCanvas"
        onMouseDown={(event) => {
          const canvas = canvasRef.current
          if (!canvas)
            return

          const rect = canvas.getBoundingClientRect()
          const x = event.clientX - rect.left
          const y = event.clientY - rect.top
          const hit = points.find((point) => {
            const px = freqToX(point.x, rect.width)
            const py = dbToY(point.y, rect.height)
            return Math.hypot(px - x, py - y) < 14
          })
          setDragging(hit?.key ?? null)
        }}
      />
      <div className="eqScale eqScaleBottom" aria-hidden="true">
        <span>20Hz</span>
        <span>20kHz</span>
      </div>
    </div>
  )
}
