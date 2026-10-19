import { useEffect, useRef } from 'react'

type VUMeterProps = {
  level: number       // 0.0 – 1.0 RMS level
  peak?: number       // 0.0 – 1.0 peak level
  color?: string      // accent color for the module
  width?: number
  height?: number
}

const SEGMENTS = 20

export default function VUMeter({ level, peak = 0, color = '#2ECC71', width = 10, height = 80 }: VUMeterProps) {
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

    const segH = Math.floor((height - SEGMENTS + 1) / SEGMENTS)
    const gap = 1
    const lit = Math.round(level * SEGMENTS)
    const peakSeg = Math.round(peak * SEGMENTS)

    for (let i = 0; i < SEGMENTS; i++) {
      const seg = SEGMENTS - 1 - i  // 0 = bottom, SEGMENTS-1 = top
      const y = i * (segH + gap)
      const isLit = seg < lit

      let segColor: string
      if (seg >= SEGMENTS - 3) {
        segColor = isLit ? '#E74C3C' : 'rgba(231,76,60,0.12)'
      } else if (seg >= SEGMENTS - 6) {
        segColor = isLit ? '#F1C40F' : 'rgba(241,196,15,0.12)'
      } else {
        segColor = isLit ? color : `${color}18`
      }

      ctx.fillStyle = segColor
      ctx.beginPath()
      ctx.roundRect(0, y, width, Math.max(1, segH), 1)
      ctx.fill()
    }

    // Peak hold marker
    if (peakSeg > 0 && peakSeg <= SEGMENTS) {
      const peakI = SEGMENTS - peakSeg
      const py = peakI * (segH + gap)
      ctx.fillStyle = peakSeg >= SEGMENTS - 3 ? '#E74C3C' : peakSeg >= SEGMENTS - 6 ? '#F1C40F' : color
      ctx.fillRect(0, py, width, 2)
    }
  }, [level, peak, color, width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, display: 'block', borderRadius: '2px' }}
    />
  )
}
