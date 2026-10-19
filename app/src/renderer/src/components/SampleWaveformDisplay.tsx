import { useEffect, useRef } from 'react'

type SampleWaveformDisplayProps = {
  /** Float32Array of peak data (alternating min/max per column), or null when empty */
  peaks?: Float32Array | null
  /** RMS level 0–1 for tinting the waveform */
  level?: number
  color?: string
  width?: number
  height?: number
  /** When true, shows drag-and-drop placeholder instead of waveform */
  isEmpty?: boolean
}

export default function SampleWaveformDisplay({
  peaks = null,
  level = 0,
  color = '#27AE60',
  width = 180,
  height = 48,
  isEmpty = true
}: SampleWaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const cx = width / 2
    const cy = height / 2

    if (isEmpty || !peaks || peaks.length < 2) {
      // ── Placeholder ────────────────────────────────────────────────────────
      // Dashed center line
      ctx.strokeStyle = `${color}30`
      ctx.lineWidth = 1
      ctx.setLineDash([4, 5])
      ctx.beginPath()
      ctx.moveTo(8, cy)
      ctx.lineTo(width - 8, cy)
      ctx.stroke()
      ctx.setLineDash([])

      // Upload icon (arrow up + base bar)
      const iconSize = 13
      const ix = cx
      const iy = cy - 10
      ctx.strokeStyle = `${color}55`
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Shaft
      ctx.beginPath()
      ctx.moveTo(ix, iy + iconSize * 0.7)
      ctx.lineTo(ix, iy)
      ctx.stroke()

      // Arrow head
      ctx.beginPath()
      ctx.moveTo(ix - iconSize * 0.35, iy + iconSize * 0.35)
      ctx.lineTo(ix, iy)
      ctx.lineTo(ix + iconSize * 0.35, iy + iconSize * 0.35)
      ctx.stroke()

      // Base bar
      ctx.beginPath()
      ctx.moveTo(ix - iconSize * 0.55, iy + iconSize * 0.8)
      ctx.lineTo(ix + iconSize * 0.55, iy + iconSize * 0.8)
      ctx.stroke()

      // Label
      ctx.fillStyle = `${color}44`
      ctx.font = '700 7px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.letterSpacing = '0.1em'
      ctx.fillText('DRAG & DROP  ·  CLICK TO LOAD', cx, cy + 16)

      return
    }

    // ── Waveform ─────────────────────────────────────────────────────────────
    const cols = Math.floor(peaks.length / 2)
    const colW = width / cols

    // Soft glow fill
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, `${color}50`)
    grad.addColorStop(0.5, `${color}28`)
    grad.addColorStop(1, `${color}50`)

    // Build top path (max values) left-to-right
    ctx.beginPath()
    for (let i = 0; i < cols; i++) {
      const maxVal = peaks[i * 2]       // 0..1
      const y = cy - maxVal * (height * 0.46)
      const x = i * colW + colW * 0.5
      if (i === 0) ctx.moveTo(x, y)
      else {
        const px = (i - 1) * colW + colW * 0.5
        const py = cy - peaks[(i - 1) * 2] * (height * 0.46)
        ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
      }
    }
    // Bottom path (min values) right-to-left
    for (let i = cols - 1; i >= 0; i--) {
      const minVal = peaks[i * 2 + 1]   // -1..0, stored as absolute
      const y = cy + minVal * (height * 0.46)
      const x = i * colW + colW * 0.5
      if (i === cols - 1) ctx.lineTo(x, y)
      else {
        const nx = (i + 1) * colW + colW * 0.5
        const ny = cy + peaks[(i + 1) * 2 + 1] * (height * 0.46)
        ctx.quadraticCurveTo(nx, ny, (nx + x) / 2, (ny + y) / 2)
      }
    }
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Outline stroke
    ctx.strokeStyle = `${color}${Math.round(55 + level * 120).toString(16).padStart(2, '0')}`
    ctx.lineWidth = 1
    ctx.stroke()

    // Center axis
    ctx.strokeStyle = `${color}20`
    ctx.lineWidth = 1
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(0, cy)
    ctx.lineTo(width, cy)
    ctx.stroke()
    ctx.setLineDash([])
  }, [peaks, level, color, width, height, isEmpty])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, display: 'block' }}
    />
  )
}
