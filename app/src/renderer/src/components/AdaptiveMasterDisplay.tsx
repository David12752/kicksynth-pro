import { useEffect, useRef } from 'react'
import EQCurve from './EQCurve'
import PitchEnvelopeEditor from './PitchEnvelopeEditor'

export type DisplayMode = 'OSC' | 'AMP_ENV' | 'FILTER' | 'EQ' | 'MIX' | 'PHASE' | 'PITCH_ENV'

const MODES: { key: DisplayMode; label: string }[] = [
  { key: 'OSC',      label: 'OSC'    },
  { key: 'PITCH_ENV',label: 'PITCH'  },
  { key: 'AMP_ENV',  label: 'AMP'    },
  { key: 'FILTER',   label: 'FILTER' },
  { key: 'EQ',       label: 'EQ'     },
  { key: 'MIX',      label: 'MIX'    },
  { key: 'PHASE',    label: 'PHASE'  }
]

type Props = {
  mode: DisplayMode
  onModeChange: (mode: DisplayMode) => void
  params: SynthParams
  waveform: number[]
  subWaveform: number[]
  sampleWaveforms: number[][]
  peak: number
  pulseToken: number
  sampleLayers: SampleLayerState[]
  onEQChange: (updates: Partial<SynthParams>) => void
}

/* ── Canvas drawing helpers ────────────────────────────────────────────── */

function safeWave(input: number[]): number[] {
  if (!input?.length) return new Array(512).fill(0)
  return input.slice(0, 512).map((p) => (Number.isFinite(p) ? p : 0))
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cols: number, rows: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  for (let i = 1; i < cols; i++) {
    ctx.beginPath(); ctx.moveTo((w / cols) * i, 0); ctx.lineTo((w / cols) * i, h); ctx.stroke()
  }
  for (let i = 1; i < rows; i++) {
    ctx.beginPath(); ctx.moveTo(0, (h / rows) * i); ctx.lineTo(w, (h / rows) * i); ctx.stroke()
  }
}

function drawOSCMode(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  waveform: number[], subWaveform: number[], sampleWaveforms: number[][],
  peak: number, pulseToken: number, params: SynthParams
) {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, pulseToken > 0 ? 'rgba(20,36,52,0.98)' : '#13131a')
  bg.addColorStop(1, '#0e0e14')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)

  if (pulseToken > 0) {
    const flash = ctx.createRadialGradient(w * 0.5, h * 0.4, 10, w * 0.5, h * 0.4, w * 0.55)
    flash.addColorStop(0, 'rgba(91,141,184,0.18)'); flash.addColorStop(1, 'rgba(91,141,184,0)')
    ctx.fillStyle = flash; ctx.fillRect(0, 0, w, h)
  }

  drawGrid(ctx, w, h, 8, 4)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke()

  const drawWave = (points: number[], color: string, lw: number) => {
    const safe = safeWave(points)
    if (!safe.some((p) => Math.abs(p) > 0.0001)) return
    ctx.beginPath()
    safe.forEach((p, i) => {
      const x = (i / Math.max(safe.length - 1, 1)) * w
      const y = h * 0.5 - p * h * 0.38
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        const prevX = ((i - 1) / Math.max(safe.length - 1, 1)) * w
        const prevY = h * 0.5 - safe[i - 1] * h * 0.38
        ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2)
      }
    })
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke()
  }

  const LAYER_COLORS = ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.16)']
  sampleWaveforms.forEach((sw, i) => drawWave(sw, LAYER_COLORS[i], 1))
  drawWave(subWaveform, 'rgba(42,127,255,0.45)', 1.2)
  drawWave(waveform, '#D8D8E8', 2)

  if (peak > 0.01) {
    const peakY = h - peak * h * 0.92
    ctx.beginPath(); ctx.moveTo(0, peakY); ctx.lineTo(w, peakY)
    ctx.strokeStyle = 'rgba(91,141,184,0.3)'; ctx.lineWidth = 1; ctx.stroke()
  }

  ctx.fillStyle = 'rgba(91,141,184,0.55)'; ctx.font = '700 9px Inter, system-ui, sans-serif'
  ctx.fillText('OSC', 8, 14)
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillText(`PEAK ${peak > 0.0001 ? (20 * Math.log10(peak)).toFixed(1) : '–∞'} dBFS`, w - 100, 14)

  if (params.lfoDepth > 0.01 && params.lfoTarget > 0) {
    const LFO_T = ['', 'PITCH', 'AMP', 'FILTER']
    const badge = `LFO › ${LFO_T[params.lfoTarget] ?? ''} ${params.lfoRate.toFixed(1)}Hz`
    ctx.font = '600 8px Inter, system-ui, sans-serif'
    const tw = ctx.measureText(badge).width
    const bx = w - tw - 14; const by = h - 14
    ctx.fillStyle = 'rgba(91,141,184,0.16)'; ctx.beginPath(); ctx.roundRect(bx - 4, by - 9, tw + 8, 13, 3); ctx.fill()
    ctx.fillStyle = 'rgba(91,141,184,0.8)'; ctx.fillText(badge, bx, by)
  }
}

function drawAMPENVMode(ctx: CanvasRenderingContext2D, w: number, h: number, params: SynthParams) {
  ctx.fillStyle = '#13131a'; ctx.fillRect(0, 0, w, h)
  drawGrid(ctx, w, h, 8, 4)

  const { attack, decay, sustain, release, punch } = params
  const pad = { l: 32, r: 24, t: 20, b: 28 }
  const W = w - pad.l - pad.r; const H = h - pad.t - pad.b
  const totalTime = attack + decay + release * 2 + 0.06
  const sustainGap = totalTime * 0.2
  const aEnd = (attack / totalTime) * W; const dEnd = aEnd + (decay / totalTime) * W
  const sEnd = dEnd + (sustainGap / totalTime) * W; const rEnd = sEnd + (release / totalTime) * W
  const peakY = pad.t + H * (1 - Math.min(1, 1 + punch * 0.12))
  const sustainY = pad.t + H * (1 - sustain); const zeroY = pad.t + H

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(pad.l + W, zeroY); ctx.stroke()

  ctx.beginPath(); ctx.moveTo(pad.l, zeroY)
  ctx.bezierCurveTo(pad.l + aEnd * 0.15, zeroY, pad.l + aEnd * 0.85, peakY, pad.l + aEnd, peakY)
  ctx.bezierCurveTo(pad.l + aEnd + (dEnd - aEnd) * 0.2, peakY, pad.l + dEnd, sustainY + (peakY - sustainY) * 0.05, pad.l + dEnd, sustainY)
  ctx.lineTo(pad.l + sEnd, sustainY)
  ctx.bezierCurveTo(pad.l + sEnd + (rEnd - sEnd) * 0.2, sustainY, pad.l + rEnd, zeroY - (zeroY - sustainY) * 0.05, pad.l + rEnd, zeroY)
  ctx.lineTo(pad.l, zeroY); ctx.closePath()
  ctx.fillStyle = 'rgba(157,78,221,0.1)'; ctx.fill()

  ctx.beginPath(); ctx.moveTo(pad.l, zeroY)
  ctx.bezierCurveTo(pad.l + aEnd * 0.15, zeroY, pad.l + aEnd * 0.85, peakY, pad.l + aEnd, peakY)
  ctx.bezierCurveTo(pad.l + aEnd + (dEnd - aEnd) * 0.2, peakY, pad.l + dEnd, sustainY + (peakY - sustainY) * 0.05, pad.l + dEnd, sustainY)
  ctx.lineTo(pad.l + sEnd, sustainY)
  ctx.bezierCurveTo(pad.l + sEnd + (rEnd - sEnd) * 0.2, sustainY, pad.l + rEnd, zeroY - (zeroY - sustainY) * 0.05, pad.l + rEnd, zeroY)
  ctx.strokeStyle = '#9D4EDD'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke()

  const pts = [
    { x: pad.l + aEnd, y: peakY }, { x: pad.l + dEnd, y: sustainY },
    { x: pad.l + sEnd, y: sustainY }, { x: pad.l + rEnd, y: zeroY }
  ]
  pts.forEach((pt) => {
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#9D4EDD'; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.stroke()
  })

  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '600 8px Inter, system-ui, sans-serif'
  const labels = [
    { x: pad.l + aEnd * 0.5, label: 'A' }, { x: pad.l + aEnd + (dEnd - aEnd) * 0.5, label: 'D' },
    { x: pad.l + dEnd + (sEnd - dEnd) * 0.5, label: 'S' }, { x: pad.l + sEnd + (rEnd - sEnd) * 0.5, label: 'R' }
  ]
  labels.forEach(({ x, label }) => ctx.fillText(label, x - 4, h - 8))

  if (punch > 0.05) {
    ctx.fillStyle = 'rgba(184,155,74,0.7)'; ctx.font = '700 8px Inter, system-ui, sans-serif'
    ctx.fillText(`PUNCH ${punch.toFixed(2)}`, 8 + pad.l, pad.t - 4)
  }
  ctx.fillStyle = 'rgba(157,78,221,0.6)'; ctx.font = '700 9px Inter, system-ui, sans-serif'
  ctx.fillText('AMP ENV', 8, 14)
}

function drawFilterMode(ctx: CanvasRenderingContext2D, w: number, h: number, params: SynthParams) {
  ctx.fillStyle = '#13131a'; ctx.fillRect(0, 0, w, h)
  const { filterCutoff, filterRes, filterType, filterEnabled } = params
  const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const logMin = Math.log10(20); const logMax = Math.log10(20000)
  const freqToX = (f: number) => ((Math.log10(f) - logMin) / (logMax - logMin)) * w
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
  freqs.forEach((f) => { const x = freqToX(f); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() })
  const dbLines = [-36, -24, -12, 0, 6]
  dbLines.forEach((db) => {
    const y = h * 0.5 - (db / 48) * h
    ctx.strokeStyle = db === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  })
  const getResponse = (freq: number): number => {
    if (!filterEnabled) return 0
    const ratio = freq / filterCutoff; const logR = Math.log2(ratio)
    const resPeak = filterRes * 12 * Math.exp(-Math.pow(logR * 5, 2))
    if (filterType === 0) return Math.min(resPeak, resPeak + 3) - Math.max(0, logR * 12)
    if (filterType === 1) return Math.min(resPeak, resPeak + 3) - Math.max(0, logR * 24)
    if (filterType === 2) return Math.min(0, logR * 12) + (logR < 0 ? 0 : resPeak * 0.5)
    if (filterType === 3) return Math.min(0, logR * 24) + (logR < 0 ? 0 : resPeak * 0.5)
    if (filterType === 4) { const bw = 1 / (0.4 + filterRes * 2); return -Math.abs(logR) * 12 * bw + resPeak + filterRes * 4 }
    if (filterType === 5) { const depth = (1 - filterRes * 0.7) * 24; return Math.abs(logR) < 0.8 ? -depth * Math.exp(-Math.pow(logR * 3, 2)) : 0 }
    const slope = [18, 24, 12][filterType - 6] ?? 18
    return Math.min(resPeak, resPeak + 3) - Math.max(0, logR * slope)
  }
  const dbToY = (db: number) => h * 0.5 - (db / 48) * h
  ctx.beginPath()
  for (let px = 0; px < w; px++) {
    const freq = 10 ** (logMin + (px / w) * (logMax - logMin))
    const y = dbToY(getResponse(freq)); px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y)
  }
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
  ctx.fillStyle = 'rgba(91,141,184,0.1)'; ctx.fill()
  ctx.beginPath()
  for (let px = 0; px < w; px++) {
    const freq = 10 ** (logMin + (px / w) * (logMax - logMin))
    const y = dbToY(getResponse(freq)); px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y)
  }
  ctx.strokeStyle = filterEnabled ? '#5B8DB8' : '#444'; ctx.lineWidth = 2; ctx.stroke()
  const cx = freqToX(filterCutoff)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4])
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke(); ctx.setLineDash([])
  const cy = dbToY(getResponse(filterCutoff))
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#5B8DB8'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '600 8px Inter, system-ui, sans-serif'
  ;[100, 500, 1000, 5000, 10000].forEach((f) => {
    const label = f >= 1000 ? `${f / 1000}k` : `${f}`
    ctx.fillText(label, freqToX(f) - 8, h - 4)
  })
  ctx.fillStyle = 'rgba(91,141,184,0.6)'; ctx.font = '700 9px Inter, system-ui, sans-serif'
  ctx.fillText('FILTER', 8, 14)
  if (!filterEnabled) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '700 12px Inter, system-ui, sans-serif'
    ctx.fillText('BYPASSED', w / 2 - 36, h / 2)
  }
}

function drawMIXMode(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  params: SynthParams, sampleLayers: SampleLayerState[], peak: number
) {
  ctx.fillStyle = '#13131a'; ctx.fillRect(0, 0, w, h)
  drawGrid(ctx, w, h, 8, 4)
  const sources = [
    { label: 'MAIN OSC', level: params.gain, color: '#5B8DB8', enabled: true },
    { label: 'SUB OSC',  level: params.subLevel * (params.subHarmonic > 0 ? 1 : 0.7), color: '#2A7FFF', enabled: true },
    { label: 'LAYER 1',  level: sampleLayers[0]?.volume ?? 0, color: '#27AE60', enabled: sampleLayers[0]?.enabled ?? false },
    { label: 'LAYER 2',  level: sampleLayers[1]?.volume ?? 0, color: '#27AE60', enabled: sampleLayers[1]?.enabled ?? false },
    { label: 'LAYER 3',  level: sampleLayers[2]?.volume ?? 0, color: '#27AE60', enabled: sampleLayers[2]?.enabled ?? false }
  ]
  const pad = { l: 70, r: 20, t: 18, b: 14 }
  const barH = Math.floor((h - pad.t - pad.b - (sources.length - 1) * 8) / sources.length)
  const maxW = w - pad.l - pad.r
  sources.forEach((src, i) => {
    const y = pad.t + i * (barH + 8); const barWidth = Math.max(2, src.level * maxW)
    const alpha = src.enabled ? 1 : 0.35
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.roundRect(pad.l, y, maxW, barH, 3); ctx.fill()
    ctx.globalAlpha = alpha
    const grad = ctx.createLinearGradient(pad.l, 0, pad.l + maxW, 0)
    grad.addColorStop(0, src.color); grad.addColorStop(1, `${src.color}88`)
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(pad.l, y, barWidth, barH, 3); ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = src.enabled ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)'
    ctx.font = '700 8px Inter, system-ui, sans-serif'; ctx.fillText(src.label, 4, y + barH / 2 + 3)
    ctx.fillStyle = src.enabled ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.12)'
    ctx.fillText(`${Math.round(src.level * 100)}%`, pad.l + maxW + 4, y + barH / 2 + 3)
  })
  const peakDb = peak > 0.0001 ? `${(20 * Math.log10(peak)).toFixed(1)} dBFS` : '–∞ dBFS'
  ctx.fillStyle = 'rgba(91,141,184,0.6)'; ctx.font = '700 9px Inter, system-ui, sans-serif'
  ctx.fillText('MIX', 8, 14)
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillText(`OUT ${peakDb}`, w - 100, 14)
}

function drawPhaseMode(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  waveform: number[], peak: number
) {
  // Dark background
  ctx.fillStyle = '#0d0d12'; ctx.fillRect(0, 0, w, h)

  const cx = w / 2; const cy = h / 2
  const radius = Math.min(w, h) * 0.42

  // Outer ring
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()

  // Cross lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke()

  // Diagonal guides (+45° / -45°)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1
  const d = radius * 0.7
  ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke()

  // Draw Lissajous using waveform as both L and R (mono simulation — shows as diagonal line)
  // We pair adjacent samples as pseudo L/R
  const safe = waveform?.length ? waveform.slice(0, 512) : new Array(512).fill(0)
  const hasSignal = safe.some((p) => Math.abs(p) > 0.001)

  if (hasSignal) {
    ctx.strokeStyle = 'rgba(42,200,180,0.7)'; ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let i = 0; i < safe.length - 1; i += 2) {
      const L = safe[i]; const R = safe[i + 1] ?? safe[i]
      // Rotate 45°: M = (L+R)/sqrt(2), S = (L-R)/sqrt(2)
      const M = (L + R) * 0.707; const S = (L - R) * 0.707
      const px = cx + S * radius; const py = cy - M * radius
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.stroke()
  }

  // Correlation meter (simplified: all mono source = 1.0 correlation)
  const corr = hasSignal ? 0.98 : 0
  const corrLabel = corr.toFixed(2)

  // Draw correlation bar below goniometer
  const barY = cy + radius + 14; const barW = radius * 1.6; const barX = cx - barW / 2

  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.beginPath()
  ctx.roundRect(barX, barY, barW, 6, 3); ctx.fill()

  // Fill from center to right for positive correlation
  const fillW = Math.max(0, corr) * (barW / 2)
  const fillColor = corr > 0.5 ? '#27AE60' : corr > 0 ? '#B89B4A' : '#C05050'
  ctx.fillStyle = fillColor; ctx.beginPath()
  ctx.roundRect(cx, barY, fillW, 6, 3); ctx.fill()

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '600 8px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('-1', barX + 8, barY + 15); ctx.fillText('0', cx, barY + 15); ctx.fillText('+1', barX + barW - 8, barY + 15)
  ctx.textAlign = 'left'

  ctx.fillStyle = 'rgba(42,200,180,0.65)'; ctx.font = '700 9px Inter, system-ui, sans-serif'
  ctx.fillText('PHASE', 8, 14)
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fillText(`CORR ${corrLabel}`, w - 70, 14)

  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '700 9px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  if (!hasSignal) ctx.fillText('TRIGGER to see signal', cx, cy)
  ctx.textAlign = 'left'

  // Peak indicator
  if (peak > 0.01) {
    const peakR = radius * Math.min(1, peak * 1.2)
    ctx.strokeStyle = `rgba(232,197,71,${0.2 + peak * 0.3})`; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, peakR, 0, Math.PI * 2); ctx.stroke()
  }
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function AdaptiveMasterDisplay({
  mode, onModeChange, params,
  waveform, subWaveform, sampleWaveforms,
  peak, pulseToken, sampleLayers, onEQChange
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (mode === 'EQ' || mode === 'PITCH_ENV') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth; const h = canvas.clientHeight
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    if (mode === 'OSC')          drawOSCMode(ctx, w, h, waveform, subWaveform, sampleWaveforms, peak, pulseToken, params)
    else if (mode === 'AMP_ENV') drawAMPENVMode(ctx, w, h, params)
    else if (mode === 'FILTER')  drawFilterMode(ctx, w, h, params)
    else if (mode === 'MIX')     drawMIXMode(ctx, w, h, params, sampleLayers, peak)
    else if (mode === 'PHASE')   drawPhaseMode(ctx, w, h, waveform, peak)
  }, [mode, params, waveform, subWaveform, sampleWaveforms, peak, pulseToken, sampleLayers])

  return (
    <div className="masterDisplay">
      {/* Mode tab bar */}
      <div className="masterDisplayModes">
        {MODES.map(({ key, label }) => (
          <button
            key={key}
            className={`masterModeBtn ${mode === key ? 'active' : ''}`}
            onClick={() => onModeChange(key)}
          >
            {label}
          </button>
        ))}
        <div className="masterDisplaySpacer" />
        <span className="masterDisplayHint">
          {mode === 'OSC'      && 'Waveform · Realtime oscilloscope'}
          {mode === 'PITCH_ENV'&& 'Pitch envelope — drag nodes to edit'}
          {mode === 'AMP_ENV' && 'Amplitude · ADSR shape'}
          {mode === 'FILTER'  && 'Filter response — controls below'}
          {mode === 'EQ'      && '4-band parametric EQ — knobs below'}
          {mode === 'MIX'     && 'Signal balance'}
          {mode === 'PHASE'   && 'Phase correlation · Goniometer'}
        </span>
      </div>

      {/* Display area */}
      <div className="masterDisplayCanvas">
        {mode === 'EQ'
          ? <EQCurve params={params} onChange={onEQChange} />
          : mode === 'PITCH_ENV'
            ? <div className="masterDisplayPitchEnv">
                <PitchEnvelopeEditor
                  values={{
                    startPitch: params.startPitch,
                    endPitch: params.endPitch,
                    pitchDecay: params.pitchDecay,
                    pitchCurve: params.pitchCurve
                  }}
                  onChange={onEQChange}
                  color="#9D4EDD"
                />
              </div>
            : <canvas ref={canvasRef} className="masterDisplayCanvasEl" />
        }
      </div>
    </div>
  )
}
