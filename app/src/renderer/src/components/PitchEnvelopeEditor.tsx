import { useCallback, useEffect, useRef, useState } from 'react'

type PitchEnvValues = {
  startPitch: number   // Hz  20–1200
  endPitch: number     // Hz  20–1200
  pitchDecay: number   // s   0.001–2
  pitchCurve: number   // 0.1–10
}

type PitchEnvelopeEditorProps = {
  values: PitchEnvValues
  onChange: (v: Partial<PitchEnvValues>) => void
  color?: string
  width?: number
  height?: number
}

const MIN_HZ = 20
const MAX_HZ = 1200
const MIN_DEC = 0.001
const MAX_DEC = 2

/** Map Hz (log scale) → 0..1 */
function hzToY(hz: number): number {
  return 1 - (Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ))
}
/** Map 0..1 → Hz */
function yToHz(t: number): number {
  return MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, 1 - t)
}
/** Map decay s → 0..1 (sqrt-scale for better UX at short values) */
function decToX(dec: number): number {
  return Math.sqrt((dec - MIN_DEC) / (MAX_DEC - MIN_DEC))
}
/** Map 0..1 → decay s */
function xToDec(t: number): number {
  return MIN_DEC + t * t * (MAX_DEC - MIN_DEC)
}

/** Evaluate exponential curve point at normalized t (0..1), given curve exponent */
function curvePoint(t: number, curve: number): number {
  return Math.pow(t, curve)
}

const NODE_R = 6

export default function PitchEnvelopeEditor({
  values,
  onChange,
  color = '#9D4EDD',
  width = 400,
  height = 160
}: PitchEnvelopeEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<'start' | 'end' | 'curve' | null>(null)
  const [hovered, setHovered] = useState<'start' | 'end' | 'curve' | null>(null)

  // Pixel coords of the two nodes
  function nodeCoords(w: number, h: number, v: PitchEnvValues) {
    const pad = { l: 28, r: 14, t: 10, b: 24 }
    const drawW = w - pad.l - pad.r
    const drawH = h - pad.t - pad.b

    const startX = pad.l
    const startY = pad.t + hzToY(v.startPitch) * drawH

    const endX = pad.l + decToX(v.pitchDecay) * drawW
    const endY = pad.t + hzToY(v.endPitch) * drawH

    // Curve handle: midpoint along decay axis, at mid-curve Y
    const midT = 0.5
    const midCurveT = curvePoint(midT, v.pitchCurve)
    const curveX = pad.l + decToX(v.pitchDecay) * drawW * midT
    const curveY = pad.t + (startY - pad.t + (endY - startY) * midCurveT)

    return { pad, drawW, drawH, startX, startY, endX, endY, curveX, curveY }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const { pad, drawW, drawH, startX, startY, endX, endY } = nodeCoords(width, height, values)

    // ── Grid ──────────────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    // Horizontal Hz lines
    const hzLines = [50, 100, 200, 400, 800]
    for (const hz of hzLines) {
      const y = pad.t + hzToY(hz) * drawH
      ctx.beginPath()
      ctx.moveTo(pad.l, y)
      ctx.lineTo(pad.l + drawW, y)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = '600 7px Inter, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, pad.l - 3, y + 2.5)
    }
    // Vertical time lines
    const decLines = [0.01, 0.05, 0.1, 0.3, 0.6, 1.0]
    for (const d of decLines) {
      const x = pad.l + decToX(d) * drawW
      ctx.beginPath()
      ctx.moveTo(x, pad.t)
      ctx.lineTo(x, pad.t + drawH)
      ctx.stroke()
    }

    // ── Curve ─────────────────────────────────────────────────────────────────
    const STEPS = 80
    const grad = ctx.createLinearGradient(startX, 0, endX, 0)
    grad.addColorStop(0, `${color}CC`)
    grad.addColorStop(1, `${color}55`)

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS
      const decT = t                                    // linear in visual x
      const pitchT = curvePoint(decT, values.pitchCurve)
      const x = pad.l + decToX(values.pitchDecay) * drawW * t
      const y = startY + (endY - startY) * pitchT
      ctx.lineTo(x, y)
    }
    ctx.strokeStyle = grad
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Glow fill under curve
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS
      const pitchT = curvePoint(t, values.pitchCurve)
      const x = pad.l + decToX(values.pitchDecay) * drawW * t
      const y = startY + (endY - startY) * pitchT
      ctx.lineTo(x, y)
    }
    ctx.lineTo(endX, height - pad.b)
    ctx.lineTo(startX, height - pad.b)
    ctx.closePath()
    const fillGrad = ctx.createLinearGradient(0, pad.t, 0, height - pad.b)
    fillGrad.addColorStop(0, `${color}22`)
    fillGrad.addColorStop(1, `${color}06`)
    ctx.fillStyle = fillGrad
    ctx.fill()

    // ── Nodes ─────────────────────────────────────────────────────────────────
    const drawNode = (x: number, y: number, id: 'start' | 'end', label: string) => {
      const isHov = hovered === id || dragRef.current === id
      ctx.beginPath()
      ctx.arc(x, y, isHov ? NODE_R + 1 : NODE_R, 0, Math.PI * 2)
      ctx.fillStyle = isHov ? color : '#1E1E24'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.8
      ctx.stroke()

      // label
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '700 7.5px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(label, x, y - NODE_R - 3)
    }

    const fmtHz = (v: number) => v >= 100 ? `${Math.round(v)}` : `${v.toFixed(0)}`
    drawNode(startX, startY, 'start', `${fmtHz(values.startPitch)}Hz`)
    drawNode(endX, endY, 'end', `${fmtHz(values.endPitch)}Hz`)

    // X-axis label
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '600 7px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${values.pitchDecay < 0.1 ? (values.pitchDecay * 1000).toFixed(0) + 'ms' : values.pitchDecay.toFixed(3) + 's'}`, endX, height - 3)
  }, [values, color, width, height, hovered])

  useEffect(() => { draw() }, [draw])

  // Pointer helpers
  function hitTest(ex: number, ey: number): 'start' | 'end' | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = ex - rect.left
    const y = ey - rect.top
    const { startX, startY, endX, endY } = nodeCoords(width, height, values)
    if (Math.hypot(x - startX, y - startY) < NODE_R + 4) return 'start'
    if (Math.hypot(x - endX, y - endY) < NODE_R + 4) return 'end'
    return null
  }

  function pixelToValues(ex: number, ey: number, target: 'start' | 'end') {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const { pad, drawW, drawH } = nodeCoords(width, height, values)

    const x = Math.max(0, Math.min(1, (ex - rect.left - pad.l) / drawW))
    const y = Math.max(0, Math.min(1, (ey - rect.top - pad.t) / drawH))

    const hz = Math.round(yToHz(y))

    if (target === 'start') {
      onChange({ startPitch: Math.max(20, Math.min(1200, hz)) })
    } else {
      const dec = xToDec(x)
      onChange({
        endPitch: Math.max(20, Math.min(1200, hz)),
        pitchDecay: Math.max(MIN_DEC, Math.min(MAX_DEC, dec))
      })
    }
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const hit = hitTest(e.clientX, e.clientY)
    if (!hit) return
    dragRef.current = hit
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [values, width, height])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      pixelToValues(e.clientX, e.clientY, dragRef.current)
    } else {
      setHovered(hitTest(e.clientX, e.clientY))
    }
  }, [values, width, height, onChange])

  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const cursor = hovered || dragRef.current ? 'grab' : 'default'

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, display: 'block', cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { dragRef.current = null; setHovered(null) }}
    />
  )
}
