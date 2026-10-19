import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnalogFilter, type FilterType } from './audio/Filters'
import AdaptiveMasterDisplay, { type DisplayMode } from './components/AdaptiveMasterDisplay'
import CustomSelect from './components/CustomSelect'
import Knob from './components/Knob'
import SampleWaveformDisplay from './components/SampleWaveformDisplay'
import SelectField from './components/SelectField'
import Toggle from './components/Toggle'
import VUMeter from './components/VUMeter'

type ParamKey = keyof SynthParams

type ParamConfig = {
  key: ParamKey
  label: string
  min: number
  max: number
  step?: number
  formatValue?: (value: number) => string
}

type HistoryState = {
  past: Array<{ params: SynthParams; sampleLayers: SampleLayerState[] }>
  future: Array<{ params: SynthParams; sampleLayers: SampleLayerState[] }>
}

type ActiveTab = 'synth' | 'fx' | 'mixer' | 'settings'

type IconName = 'dice' | 'folder' | 'trigger' | 'copy' | 'undo' | 'redo' | 'spark'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const DISTORTION_OPTIONS = [
  { label: 'TUBE', value: 0 },
  { label: 'TAPE', value: 1 },
  { label: 'TRANS', value: 2 },
  { label: 'BITCR', value: 3 }
]
const WAVE_OPTIONS = [
  { label: 'SINE', value: 0 },
  { label: 'TRI', value: 1 },
  { label: 'SQR', value: 2 },
  { label: 'TANH', value: 3 }
]
const LFO_TARGETS = ['None', 'Pitch', 'Amp', 'Filter']
const LFO_TARGET_OPTIONS = LFO_TARGETS.map((label, value) => ({ label, value }))
const DRIFT_RATES = ['Slow', 'Medium', 'Fast']
const DRIFT_RATE_OPTIONS = DRIFT_RATES.map((label, value) => ({ label, value }))
const FILTER_TYPE_LABELS = [
  'LPF 12',
  'LPF 24',
  'HPF 12',
  'HPF 24',
  'BPF',
  'NOTCH',
  '303',
  'MS-20',
  'SEM',
  'OFF'
] as const
const FILTER_TYPE_MAP: FilterType[] = ['lpf12', 'lpf24', 'hpf12', 'hpf24', 'bpf', 'notch', 'tb303', 'ms20', 'oberheim', 'bypassed']

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const formatHz = (value: number) => `${Math.round(value)} Hz`
const formatSeconds = (value: number) => `${value.toFixed(3)} s`
const formatUnit = (value: number) => value.toFixed(2)
const formatPercent = (value: number) => `${Math.round(value * 100)}%`
const formatDb = (value: number) => `${value.toFixed(1)} dB`
const formatSemitones = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)} st`
const formatFrequencyCompact = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`)

const TAB_CONFIG: Array<{ key: ActiveTab; label: string; available: boolean }> = [
  { key: 'synth', label: 'SYNTH', available: true },
  { key: 'fx', label: 'FX', available: false },
  { key: 'mixer', label: 'MIXER', available: false },
  { key: 'settings', label: 'SETTINGS', available: false }
]

const DEFAULT_PARAMS: SynthParams = {
  startPitch: 200,
  endPitch: 50,
  pitchDecay: 0.06,
  pitchCurve: 2,
  phase: 0,
  waveform: 0,
  attack: 0.002,
  decay: 0.4,
  sustain: 0,
  release: 0.1,
  punch: 0.7,
  clickLevel: 0.5,
  clickDecay: 0.008,
  drive: 0.3,
  satType: 0,
  noise: 0.1,
  subLevel: 1,
  subHarmonic: 0,
  driftAmount: 0,
  driftRate: 0.5,
  gain: 0.8,
  lowCutHz: 20,
  highCutHz: 20000,
  limiterEnabled: true,
  eqLowShelfHz: 80,
  eqLowShelfDb: 0,
  eqLowMidHz: 200,
  eqLowMidDb: 0,
  eqLowMidQ: 1,
  eqHighMidHz: 2000,
  eqHighMidDb: 0,
  eqHighMidQ: 1,
  eqHighShelfHz: 8000,
  eqHighShelfDb: 0,
  snapToKey: false,
  snapNote: 0,
  snapOctave: 1,
  velocity: 1,
  velocityToGain: 0.5,
  velocityToDrive: 0,
  lfoRate: 2,
  lfoDepth: 0,
  lfoTarget: 0,
  filterEnabled: false,
  filterType: 0,
  filterCutoff: 4200,
  filterRes: 0.18,
  filterDrive: 0.15,
  filterEnv: 0.22,
  filterMix: 1
}

const PRESETS: Array<{ name: string; params: SynthParams }> = [
  { name: 'Classic', params: { ...DEFAULT_PARAMS } },
  {
    name: 'Hardstyle',
    params: {
      ...DEFAULT_PARAMS,
      startPitch: 320,
      endPitch: 55,
      pitchDecay: 0.045,
      phase: 12,
      waveform: 2,
      drive: 0.58,
      satType: 2,
      clickLevel: 0.68,
      noise: 0.18,
      punch: 0.95,
      filterEnabled: true,
      filterType: 1,
      filterCutoff: 5200,
      filterRes: 0.35,
      filterDrive: 0.32
    }
  },
  {
    name: 'Deep 808',
    params: {
      ...DEFAULT_PARAMS,
      startPitch: 90,
      endPitch: 32,
      pitchDecay: 0.15,
      waveform: 0,
      decay: 0.9,
      release: 0.25,
      punch: 0.25,
      drive: 0.12,
      clickLevel: 0.18,
      subHarmonic: 0.18,
      filterEnabled: true,
      filterType: 0,
      filterCutoff: 2400,
      filterRes: 0.18,
      filterMix: 0.72
    }
  },
  {
    name: 'Techno',
    params: {
      ...DEFAULT_PARAMS,
      startPitch: 250,
      endPitch: 48,
      pitchDecay: 0.055,
      pitchCurve: 2.8,
      waveform: 3,
      drive: 0.48,
      satType: 1,
      clickLevel: 0.6,
      noise: 0.24,
      eqHighMidDb: 2.5,
      filterEnabled: true,
      filterType: 7,
      filterCutoff: 1800,
      filterRes: 0.44,
      filterDrive: 0.4,
      filterEnv: 0.3
    }
  },
  {
    name: 'Tight Pop',
    params: {
      ...DEFAULT_PARAMS,
      startPitch: 220,
      endPitch: 60,
      pitchDecay: 0.04,
      decay: 0.24,
      release: 0.08,
      drive: 0.18,
      clickLevel: 0.4,
      noise: 0.06,
      eqLowShelfDb: 1.5,
      eqHighShelfDb: 1.5,
      filterEnabled: true,
      filterType: 3,
      filterCutoff: 55,
      filterRes: 0.12,
      filterMix: 0.55
    }
  }
]

// ── Param group configs ────────────────────────────────────────────────────

const OSC_KNOBS: ParamConfig[] = [
  { key: 'startPitch', label: 'START', min: 20, max: 1000, step: 1, formatValue: formatHz },
  { key: 'endPitch', label: 'END', min: 20, max: 500, step: 1, formatValue: formatHz },
  { key: 'pitchDecay', label: 'P.DEC', min: 0.001, max: 2, step: 0.001, formatValue: formatSeconds },
  { key: 'pitchCurve', label: 'CURVE', min: 0.1, max: 10, step: 0.01, formatValue: formatUnit },
  { key: 'phase', label: 'PHASE', min: 0, max: 360, step: 1, formatValue: (v) => `${Math.round(v)}°` }
]

const AMP_KNOBS: ParamConfig[] = [
  { key: 'attack', label: 'ATTACK', min: 0.001, max: 0.2, step: 0.001, formatValue: formatSeconds },
  { key: 'decay', label: 'DECAY', min: 0.02, max: 2, step: 0.001, formatValue: formatSeconds },
  { key: 'sustain', label: 'SUST', min: 0, max: 1, step: 0.001, formatValue: formatUnit },
  { key: 'release', label: 'REL', min: 0.01, max: 1, step: 0.001, formatValue: formatSeconds }
]

const CLICK_KNOBS: ParamConfig[] = [
  { key: 'clickLevel', label: 'CLICK', min: 0, max: 1, step: 0.001, formatValue: formatUnit },
  { key: 'clickDecay', label: 'DEC', min: 0.001, max: 0.1, step: 0.001, formatValue: formatSeconds },
  { key: 'noise', label: 'NOISE', min: 0, max: 1, step: 0.001, formatValue: formatUnit },
  { key: 'punch', label: 'PUNCH', min: 0, max: 1, step: 0.001, formatValue: formatUnit }
]

const SUB_KNOBS: ParamConfig[] = [
  { key: 'subLevel', label: 'LEVEL', min: 0, max: 1, step: 0.001, formatValue: formatUnit },
  { key: 'subHarmonic', label: 'HARM', min: 0, max: 1, step: 0.001, formatValue: formatUnit },
  { key: 'phase', label: 'PHASE', min: 0, max: 360, step: 1, formatValue: (v) => `${Math.round(v)}°` }
]

const FILTER_CONTROLS: ParamConfig[] = [
  { key: 'filterCutoff', label: 'CUTOFF', min: 20, max: 20000, step: 10, formatValue: formatFrequencyCompact },
  { key: 'filterRes', label: 'RES', min: 0, max: 1, step: 0.001, formatValue: formatUnit },
  { key: 'filterDrive', label: 'DRIVE', min: 0, max: 1, step: 0.001, formatValue: formatUnit },
  { key: 'filterEnv', label: 'ENV', min: -1, max: 1, step: 0.001, formatValue: formatUnit },
  { key: 'filterMix', label: 'MIX', min: 0, max: 1, step: 0.001, formatValue: formatUnit }
]

const EQ_GAIN_CONTROLS: ParamConfig[] = [
  { key: 'eqLowShelfDb', label: 'LOW', min: -12, max: 12, step: 0.1, formatValue: formatDb },
  { key: 'eqLowMidDb', label: 'LM', min: -12, max: 12, step: 0.1, formatValue: formatDb },
  { key: 'eqHighMidDb', label: 'HM', min: -12, max: 12, step: 0.1, formatValue: formatDb },
  { key: 'eqHighShelfDb', label: 'HIGH', min: -12, max: 12, step: 0.1, formatValue: formatDb }
]

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }

  const paths: Record<IconName, JSX.Element> = {
    dice: <><rect x="4.5" y="4.5" width="15" height="15" rx="3.5" {...common} /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" /></>,
    folder: <><path d="M3.5 7.5h5l2 2h10v7a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z" {...common} /><path d="M3.5 9.5h17" {...common} /></>,
    trigger: <><path d="M7 5.5v13l10-6.5z" fill="currentColor" stroke="none" /></>,
    copy: <><rect x="8" y="8" width="10" height="11" rx="2" {...common} /><path d="M6 15.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" {...common} /></>,
    undo: <><path d="M9 7 5 11l4 4" {...common} /><path d="M5.5 11h7a4.5 4.5 0 1 1 0 9h-1.5" {...common} /></>,
    redo: <><path d="m15 7 4 4-4 4" {...common} /><path d="M18.5 11h-7a4.5 4.5 0 1 0 0 9H13" {...common} /></>,
    spark: <><path d="M12 3.5 13.8 8l4.7 1.2-4 2.8.4 4.8L12 14.4 7.1 16.8l.4-4.8-4-2.8L8.2 8z" {...common} /></>
  }

  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{paths[name]}</svg>
}

const createLayer = (): SampleLayerState => ({
  filename: '',
  path: '',
  volume: 1,
  pitchSemitones: 0,
  startOffset: 0,
  lowCut: 20,
  highCut: 20000,
  enabled: true,
  reverse: false
})

function cloneParams(params: SynthParams): SynthParams { return { ...params } }
function cloneLayers(layers: SampleLayerState[]): SampleLayerState[] { return layers.map((l) => ({ ...l })) }
function paramsEqual(a: SynthParams, b: SynthParams): boolean { return Object.keys(a).every((k) => a[k as ParamKey] === b[k as ParamKey]) }
function layersEqual(a: SampleLayerState[], b: SampleLayerState[]): boolean { return JSON.stringify(a) === JSON.stringify(b) }

function calcSnapHz(note: number, octave: number): number {
  const midi = note + (octave + 1) * 12
  return 440 * 2 ** ((midi - 69) / 12)
}

function resolveFilterType(params: SynthParams): FilterType {
  if (!params.filterEnabled) return 'bypassed'
  return FILTER_TYPE_MAP[params.filterType] ?? 'bypassed'
}

function buildShareText(params: SynthParams, coarse: number, fine: number): string {
  const filterText = resolveFilterType(params) === 'bypassed'
    ? 'Filter Off'
    : `Filter ${FILTER_TYPE_LABELS[Math.min(params.filterType, FILTER_TYPE_LABELS.length - 1)]} @ ${formatFrequencyCompact(params.filterCutoff)}Hz`
  return [
    'KickSynth Pro preset',
    `Pitch ${Math.round(params.startPitch)}Hz → ${Math.round(params.endPitch)}Hz`,
    `Drive ${params.drive.toFixed(2)} | Sub ${params.subLevel.toFixed(2)} | Noise ${params.noise.toFixed(2)}`,
    filterText,
    `Tune ${coarse >= 0 ? '+' : ''}${coarse} st | Fine ${fine >= 0 ? '+' : ''}${fine} ct`
  ].join('\n')
}

function createSaturationCurve(amount: number, mode: number): Float32Array {
  const drive = 1 + clamp(amount, 0, 1) * 10
  const curve = new Float32Array(512)
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1
    if (mode === 0) { curve[index] = Math.tanh(x * drive * 1.2); continue }
    if (mode === 1) { const a = x + 0.18 * clamp(amount, 0, 1); curve[index] = Math.tanh(a * drive) * 0.92; continue }
    if (mode === 2) { curve[index] = clamp(x * (1 + amount * 12), -0.65, 0.65); continue }
    const steps = Math.max(6, Math.round(28 - clamp(amount, 0, 1) * 22))
    curve[index] = Math.round(x * steps) / steps
  }
  return curve
}

let audioContext: AudioContext | null = null

async function triggerWebAudio(params: SynthParams): Promise<void> {
  audioContext ??= new window.AudioContext()
  if (audioContext.state === 'suspended') await audioContext.resume()

  const ctx = audioContext
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const subOsc = ctx.createOscillator()
  const amp = ctx.createGain()
  const output = ctx.createGain()
  const click = ctx.createBufferSource()
  const clickGain = ctx.createGain()
  const clickFilter = ctx.createBiquadFilter()
  const toneFilter = new AnalogFilter(ctx)
  const saturator = ctx.createWaveShaper()
  const finalHighpass = ctx.createBiquadFilter()
  const finalLowpass = ctx.createBiquadFilter()

  osc.type = params.waveform === 1 ? 'triangle' : params.waveform === 2 ? 'square' : 'sine'
  subOsc.type = 'sine'
  osc.frequency.setValueAtTime(params.startPitch, now)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, params.endPitch), now + Math.max(0.01, params.pitchDecay))
  const subStart = Math.max(20, params.startPitch * 0.5)
  const subEnd = Math.max(20, params.endPitch * (0.5 + params.subHarmonic * 0.25))
  subOsc.frequency.setValueAtTime(subStart, now)
  subOsc.frequency.exponentialRampToValueAtTime(subEnd, now + Math.max(0.01, params.pitchDecay * 1.2))

  amp.gain.setValueAtTime(0.0001, now)
  amp.gain.linearRampToValueAtTime(Math.max(0.0001, params.gain * (1 + params.punch * 0.25)), now + Math.max(0.001, params.attack))
  amp.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.08, params.attack + params.decay + params.release))

  toneFilter.setParams({ type: resolveFilterType(params), cutoff: params.filterCutoff, resonance: params.filterRes, drive: params.filterDrive, envAmount: params.filterEnv, mix: params.filterMix })
  toneFilter.setCutoffEnvelope(params.filterCutoff, params.filterEnv, params.startPitch, params.endPitch, now, params.pitchDecay)
  saturator.curve = createSaturationCurve(params.drive, params.satType)
  saturator.oversample = '4x'
  finalHighpass.type = 'highpass'; finalHighpass.frequency.value = clamp(params.lowCutHz, 20, 1200)
  finalLowpass.type = 'lowpass';  finalLowpass.frequency.value  = clamp(params.highCutHz, 500, 20000)
  output.gain.value = clamp(params.limiterEnabled ? 0.92 : 1, 0.5, 1)

  const noiseLen = Math.max(128, Math.floor(ctx.sampleRate * Math.max(0.01, params.clickDecay * 6)))
  const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (0.35 + params.noise * 0.65)

  click.buffer = noiseBuffer
  clickFilter.type = 'highpass'; clickFilter.frequency.value = 1800 + params.clickLevel * 5000
  clickGain.gain.setValueAtTime(params.clickLevel * 0.45, now)
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.01, params.clickDecay * 4))

  osc.connect(toneFilter.inputNode); subOsc.connect(toneFilter.inputNode)
  toneFilter.outputNode.connect(saturator); saturator.connect(finalHighpass)
  finalHighpass.connect(finalLowpass); finalLowpass.connect(amp); amp.connect(output); output.connect(ctx.destination)
  click.connect(clickFilter); clickFilter.connect(clickGain); clickGain.connect(output)

  osc.start(now); subOsc.start(now); click.start(now)
  osc.stop(now + 1.2); subOsc.stop(now + 1.2)
  click.stop(now + Math.max(0.03, params.clickDecay * 4.5))
}

// ── Mini sub waveform preview canvas ──────────────────────────────────────
function MiniWavePreview({ waveform }: { waveform: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth; const h = canvas.clientHeight
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0e0e14'; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke()
    const safe = waveform?.length ? waveform.slice(0, 512) : new Array(512).fill(0)
    if (!safe.some((p) => Math.abs(p) > 0.001)) return
    ctx.beginPath()
    safe.forEach((p, i) => {
      const x = (i / Math.max(safe.length - 1, 1)) * w
      const y = h * 0.5 - p * h * 0.38
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.strokeStyle = 'rgba(42,127,255,0.75)'; ctx.lineWidth = 1.5; ctx.stroke()
  }, [waveform])

  return <canvas ref={canvasRef} className="miniWaveCanvas" />
}

// ── Oscilloscope Canvas (center display) ─────────────────────────────────
function OscilloscopeCanvas({ waveform: wf, subWaveform: swf, peak: pk, pulseToken: pt }: {
  waveform: number[]; subWaveform: number[]; peak: number; pulseToken: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth; const h = canvas.clientHeight
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, pt > 0 ? 'rgba(20,36,52,0.98)' : '#13131a')
    bg.addColorStop(1, '#0e0e14')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    if (pt > 0) {
      const flash = ctx.createRadialGradient(w * 0.5, h * 0.4, 10, w * 0.5, h * 0.4, w * 0.55)
      flash.addColorStop(0, 'rgba(91,141,184,0.18)'); flash.addColorStop(1, 'rgba(91,141,184,0)')
      ctx.fillStyle = flash; ctx.fillRect(0, 0, w, h)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo((w / 8) * i, 0); ctx.lineTo((w / 8) * i, h); ctx.stroke() }
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, (h / 4) * i); ctx.lineTo(w, (h / 4) * i); ctx.stroke() }
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke()
    const drawWave = (points: number[], color: string, lw: number) => {
      const safe = points?.length ? points.slice(0, 512) : []
      if (!safe.some((p) => Math.abs(p) > 0.0001)) return
      ctx.beginPath()
      safe.forEach((p, i) => {
        const x = (i / Math.max(safe.length - 1, 1)) * w
        const y = h * 0.5 - p * h * 0.42
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke()
    }
    drawWave(swf, 'rgba(42,127,255,0.3)', 1.5)
    drawWave(wf, '#5B8DB8', 2)
  }, [wf, swf, pk, pt])
  return <canvas ref={canvasRef} className="oscilloscopeCanvas" />
}

const PREVIEW_FILTER_TYPES = [
  { label: 'LPF', value: 0 },
  { label: 'HPF', value: 2 },
  { label: 'BPF', value: 4 },
  { label: 'Notch', value: 5 },
  { label: 'LPF', value: 1 },
  { label: 'BPF', value: 6 },
  { label: 'Mixn', value: 8 }
]

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [params, setParams] = useState<SynthParams>({ ...DEFAULT_PARAMS })
  const [sampleLayers, setSampleLayers] = useState<SampleLayerState[]>(() => [createLayer(), createLayer(), createLayer()])
  const [layerNames, setLayerNames] = useState<string[]>(() => ['CLICK 01', 'CLICK 01', 'CLICK 01'])
  const [waveform, setWaveform] = useState<number[]>(() => new Array(512).fill(0))
  const [subWaveform, setSubWaveform] = useState<number[]>(() => new Array(512).fill(0))
  const [sampleWaveforms, setSampleWaveforms] = useState<number[][]>(() => [[], [], []])
  const [activePreset, setActivePreset] = useState('Classic')
  const [bpm, setBpm] = useState(120)
  const [status, setStatus] = useState('Ready')
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('synth')
  const [engineStatus, setEngineStatus] = useState<'juce' | 'fallback'>('fallback')
  const [isTriggering, setIsTriggering] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [pulseToken, setPulseToken] = useState(0)
  const [peak, setPeak] = useState(0)
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] })
  const [sidechainMode, setSidechainMode] = useState(false)
  const [coarse, setCoarse] = useState(0)
  const [fine, setFine] = useState(0)
  const [isMaximized, setIsMaximized] = useState(false)
  const [activeDisplayMode, setActiveDisplayMode] = useState<DisplayMode>('OSC')

  const paramsRef = useRef(params)
  const layersRef = useRef(sampleLayers)
  const previewReqRef = useRef(0)
  const loopTimerRef = useRef<number>()

  useEffect(() => { paramsRef.current = params }, [params])
  useEffect(() => { layersRef.current = sampleLayers }, [sampleLayers])

  useEffect(() => {
    const handler = (_e: unknown, v: boolean) => setIsMaximized(v)
    window.kicksynth.onMaximizeState(handler)
    return () => window.kicksynth.offMaximizeState(handler)
  }, [])

  const tuneSemitones = coarse + fine / 100
  const tuneMultiplier = useMemo(() => 2 ** (tuneSemitones / 12), [tuneSemitones])

  const payload = useCallback((): SynthPayload => {
    const cur = paramsRef.current
    const snappedEnd = cur.snapToKey ? calcSnapHz(cur.snapNote, cur.snapOctave) : cur.endPitch
    return { params: { ...cur, startPitch: cur.startPitch * tuneMultiplier, endPitch: snappedEnd * tuneMultiplier }, sampleLayers: layersRef.current }
  }, [tuneMultiplier])

  const commitState = useCallback((nextParams: SynthParams, nextLayers: SampleLayerState[], statusText: string, preset = 'Custom') => {
    const curParams = paramsRef.current; const curLayers = layersRef.current
    if (paramsEqual(curParams, nextParams) && layersEqual(curLayers, nextLayers)) return
    setHistory((s) => ({
      past: [...s.past, { params: cloneParams(curParams), sampleLayers: cloneLayers(curLayers) }].slice(-24),
      future: []
    }))
    setParams(cloneParams(nextParams)); setSampleLayers(cloneLayers(nextLayers))
    setStatus(statusText); setActivePreset(preset)
  }, [])

  const requestPreview = useCallback(async () => {
    const id = previewReqRef.current + 1; previewReqRef.current = id
    const preview = await window.kicksynth.preview(payload())
    if (id !== previewReqRef.current) return
    setWaveform(preview.waveform?.length ? preview.waveform : new Array(512).fill(0))
    setSubWaveform(preview.subWaveform?.length ? preview.subWaveform : new Array(512).fill(0))
    setSampleWaveforms(preview.sampleWaveforms?.length ? preview.sampleWaveforms : [[], [], []])
    setPeak(preview.peak ?? 0)
    setEngineStatus(preview.server ?? 'fallback')
  }, [payload])

  useEffect(() => { void window.kicksynth.getState().then((s) => setEngineStatus(s.connected ? 'juce' : 'fallback')); void requestPreview() }, [requestPreview])

  useEffect(() => {
    const t = window.setTimeout(() => { void requestPreview() }, 120)
    return () => window.clearTimeout(t)
  }, [params, sampleLayers, coarse, fine, requestPreview])

  // Auto-switch display mode based on which param was changed
  const OSC_KEYS = new Set<ParamKey>(['startPitch', 'endPitch', 'pitchDecay', 'pitchCurve', 'phase', 'waveform'])
  const AMP_KEYS = new Set<ParamKey>(['attack', 'decay', 'sustain', 'release', 'punch'])
  const FILTER_KEYS = new Set<ParamKey>(['filterCutoff', 'filterRes', 'filterDrive', 'filterEnv', 'filterMix', 'filterEnabled', 'filterType'])
  const EQ_KEYS = new Set<ParamKey>(['eqLowShelfDb', 'eqLowShelfHz', 'eqLowMidDb', 'eqLowMidHz', 'eqLowMidQ', 'eqHighMidDb', 'eqHighMidHz', 'eqHighMidQ', 'eqHighShelfDb', 'eqHighShelfHz'])
  const MIX_KEYS = new Set<ParamKey>(['subLevel', 'subHarmonic', 'gain'])

  const focusDisplayMode = useCallback((key: ParamKey) => {
    if (OSC_KEYS.has(key)) setActiveDisplayMode('PITCH_ENV')
    else if (AMP_KEYS.has(key)) setActiveDisplayMode('AMP_ENV')
    else if (FILTER_KEYS.has(key)) setActiveDisplayMode('FILTER')
    else if (EQ_KEYS.has(key)) setActiveDisplayMode('EQ')
    else if (MIX_KEYS.has(key)) setActiveDisplayMode('MIX')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateParam = useCallback(<K extends ParamKey>(key: K, value: SynthParams[K]) => {
    commitState({ ...paramsRef.current, [key]: value }, layersRef.current, `${String(key)} updated`)
    focusDisplayMode(key)
  }, [commitState, focusDisplayMode])

  const patchParams = useCallback((updates: Partial<SynthParams>) => {
    commitState({ ...paramsRef.current, ...updates }, layersRef.current, 'EQ updated')
  }, [commitState])

  const updateLayer = useCallback((slot: number, patch: Partial<SampleLayerState>) => {
    const next = cloneLayers(layersRef.current)
    next[slot] = { ...next[slot], ...patch }
    commitState(paramsRef.current, next, `Layer ${slot + 1} updated`)
  }, [commitState])

  const handleTrigger = useCallback(async () => {
    const pv = payload(); setIsTriggering(true); setPulseToken(Date.now())
    try {
      const result = await window.kicksynth.trigger(pv)
      if (result.success) {
        setEngineStatus('juce'); setStatus(sidechainMode ? 'Triggered · Sidechain mode' : 'Triggered · JUCE engine')
      } else {
        await triggerWebAudio(pv.params); setEngineStatus('fallback'); setStatus('JUCE offline · Web Audio fallback active')
      }
      setIsSuccess(true); void requestPreview()
    } finally {
      window.setTimeout(() => setIsTriggering(false), 140)
      window.setTimeout(() => setIsSuccess(false), 900)
    }
  }, [payload, requestPreview, sidechainMode])

  useEffect(() => {
    if (!loopEnabled) { window.clearInterval(loopTimerRef.current); return undefined }
    const ms = (60 / bpm) * 1000
    loopTimerRef.current = window.setInterval(() => { void handleTrigger() }, ms)
    return () => window.clearInterval(loopTimerRef.current)
  }, [bpm, handleTrigger, loopEnabled])

  const loadSample = useCallback(async (slot: number) => {
    setStatus(`Loading layer ${slot + 1}…`)
    const result = await window.kicksynth.loadSample(slot)
    if (!result.success) { setStatus(result.error ?? 'Sample load cancelled'); return }
    updateLayer(slot, { path: result.path, filename: result.filename ?? '' })
    setStatus(`Layer ${slot + 1} loaded · ${result.filename ?? ''}`)
  }, [updateLayer])

  const exportAudio = useCallback(async () => {
    setStatus('Rendering WAV…')
    const result = await window.kicksynth.export(payload())
    if (result.success) {
      const filename = result.path ? result.path.split(/[\\/]/).pop() ?? 'kick.wav' : 'kick.wav'
      setStatus(`Exported · ${filename}`)
    } else {
      setStatus(result.error ?? 'Export cancelled')
    }
  }, [payload])

  const applyPreset = useCallback((name: string) => {
    const preset = PRESETS.find((p) => p.name === name)
    if (!preset) return
    commitState({ ...preset.params }, layersRef.current, `${name} preset loaded`, name)
  }, [commitState])

  const undo = useCallback(() => {
    setHistory((s) => {
      if (!s.past.length) return s
      const prev = s.past[s.past.length - 1]
      const cur = { params: cloneParams(paramsRef.current), sampleLayers: cloneLayers(layersRef.current) }
      const rp = cloneParams(prev.params); const rl = cloneLayers(prev.sampleLayers)
      setParams(rp); paramsRef.current = rp; setSampleLayers(rl); layersRef.current = rl
      setStatus('Undo'); setActivePreset('Custom')
      return { past: s.past.slice(0, -1), future: [cur, ...s.future].slice(0, 24) }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((s) => {
      if (!s.future.length) return s
      const [next, ...rest] = s.future
      const cur = { params: cloneParams(paramsRef.current), sampleLayers: cloneLayers(layersRef.current) }
      const rp = cloneParams(next.params); const rl = cloneLayers(next.sampleLayers)
      setParams(rp); paramsRef.current = rp; setSampleLayers(rl); layersRef.current = rl
      setStatus('Redo'); setActivePreset('Custom')
      return { past: [...s.past, cur].slice(-24), future: rest }
    })
  }, [])

  const randomValue = useCallback((min: number, max: number, step = 0.001) => {
    const steps = Math.max(1, Math.round((max - min) / step))
    return Number((min + Math.round(Math.random() * steps) * step).toFixed(4))
  }, [])

  const randomizeControls = useCallback((controls: ParamConfig[], statusText: string, extra?: (next: SynthParams) => void) => {
    const next = cloneParams(paramsRef.current)
    controls.forEach((c) => { next[c.key] = randomValue(c.min, c.max, c.step ?? 0.001) as never })
    extra?.(next); commitState(next, layersRef.current, statusText)
  }, [commitState, randomValue])

  const randomizeOsc = useCallback(() => {
    randomizeControls(OSC_KNOBS, 'Oscillator randomized', (next) => {
      next.waveform = Math.floor(Math.random() * WAVE_OPTIONS.length)
    })
  }, [randomizeControls]) // eslint-disable-line react-hooks/exhaustive-deps

  const randomizeAmp = useCallback(() => {
    randomizeControls(AMP_KNOBS, 'Amp envelope randomized')
  }, [randomizeControls])

  const randomizeClick = useCallback(() => {
    randomizeControls(CLICK_KNOBS, 'Click/Transient randomized', (next) => {
      next.drive = randomValue(0, 1, 0.001)
      next.satType = Math.floor(Math.random() * 4)
      next.driftAmount = randomValue(0, 0.5, 0.001)
      next.driftRate = [0, 0.5, 1][Math.floor(Math.random() * 3)]
    })
  }, [randomizeControls, randomValue])

  const randomizeFilter = useCallback(() => {
    randomizeControls(FILTER_CONTROLS, 'Filter randomized', (next) => {
      next.filterEnabled = true; next.filterType = Math.floor(Math.random() * 9)
    })
  }, [randomizeControls])

  const randomizeEQ = useCallback(() => {
    const next = cloneParams(paramsRef.current)
    next.eqLowShelfDb = randomValue(-8, 8, 0.1); next.eqLowMidDb = randomValue(-8, 8, 0.1)
    next.eqHighMidDb = randomValue(-8, 8, 0.1); next.eqHighShelfDb = randomValue(-8, 8, 0.1)
    next.eqLowShelfHz = randomValue(40, 140, 1); next.eqLowMidHz = randomValue(120, 400, 1)
    next.eqHighMidHz = randomValue(1200, 4000, 1); next.eqHighShelfHz = randomValue(5000, 12000, 1)
    commitState(next, layersRef.current, 'EQ randomized'); setActiveDisplayMode('EQ')
  }, [commitState, randomValue])

  const handleFilterTypeSelect = useCallback((index: number) => {
    const next = cloneParams(paramsRef.current)
    if (index >= FILTER_TYPE_MAP.length - 1) {
      next.filterEnabled = false; next.filterType = FILTER_TYPE_MAP.length - 1
      commitState(next, layersRef.current, 'Filter bypassed'); setActiveDisplayMode('FILTER'); return
    }
    next.filterEnabled = true; next.filterType = index
    commitState(next, layersRef.current, `Filter ${FILTER_TYPE_LABELS[index]} selected`); setActiveDisplayMode('FILTER')
  }, [commitState])

  const handleFilterToggle = useCallback(() => {
    const next = cloneParams(paramsRef.current)
    const en = !next.filterEnabled; next.filterEnabled = en
    if (en && next.filterType >= FILTER_TYPE_MAP.length - 1) next.filterType = 0
    commitState(next, layersRef.current, en ? 'Filter enabled' : 'Filter disabled'); setActiveDisplayMode('FILTER')
  }, [commitState])

  const snappedHz = useMemo(() => calcSnapHz(params.snapNote, params.snapOctave), [params.snapNote, params.snapOctave])
  const displayedPitchHz = useMemo(() => (params.snapToKey ? snappedHz : params.endPitch) * tuneMultiplier, [params.endPitch, params.snapToKey, snappedHz, tuneMultiplier])
  const pitchDisplay = useMemo(() => {
    if (!params.snapToKey) return `${Math.round(displayedPitchHz)} Hz`
    return `${NOTE_NAMES[params.snapNote]}${params.snapOctave} (${Math.round(displayedPitchHz)} Hz)`
  }, [displayedPitchHz, params.snapNote, params.snapOctave, params.snapToKey])

  const peakLevel = clamp(peak, 0, 1)
  const peakDb = peakLevel > 0.0001 ? 20 * Math.log10(peakLevel) : -60
  const driftRateIndex = params.driftRate < 0.25 ? 0 : params.driftRate < 0.75 ? 1 : 2
  const selectedFilterIndex = params.filterEnabled ? params.filterType : FILTER_TYPE_MAP.length - 1
  const volumeDb = params.gain > 0.0001 ? `${(20 * Math.log10(params.gain)).toFixed(1)} dB` : '-∞ dB'
  const volumeSliderStyle = { '--pct': `${params.gain * 100}%` } as Record<string, string>
  const statusTone = status.includes('fallback') || status.includes('unavailable') || status.includes('offline') || status.includes('cancelled')
    ? 'warning'
    : status.includes('Exported') || status.includes('loaded') || status.includes('Triggered') || status.includes('Loaded')
      ? 'good'
      : 'neutral'

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab)
    if (tab !== 'synth') setStatus(`${TAB_CONFIG.find((e) => e.key === tab)?.label ?? 'Tab'} preview only — Synth is the production-ready focus`)
  }

  const KS = 48; const KSS = 40

  return (
    <div className="appFrame">
      <div className="app">

        {/* ═══════════════ HEADER ═══════════════ */}
        <header className="headerBar">
          <div className="headerLeft">
            <div className="brandTitle"><strong>KICK</strong> SYNTH PRO</div>
          </div>

          <div className="headerCenter noDrag">
            <span className="presetSelectorLabel">Preset Selector</span>
            <button className="presetArrowBtn" onClick={() => {
              const names = PRESETS.map(p => p.name)
              const idx = names.indexOf(activePreset)
              if (idx > 0) applyPreset(names[idx - 1])
            }} title="Previous preset">◀</button>
            <SelectField className="presetSelect" value={activePreset} onChange={(e) => applyPreset(e.target.value)}>
              {PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name.toUpperCase()}</option>)}
              <option value="Custom">CUSTOM KICK 01</option>
            </SelectField>
            <button className="presetArrowBtn" onClick={() => {
              const names = PRESETS.map(p => p.name)
              const idx = names.indexOf(activePreset)
              if (idx < names.length - 1) applyPreset(names[idx + 1])
            }} title="Next preset">▶</button>
            <button className="toolbarButton iconButton" onClick={undo} title="Undo">Undo</button>
            <button className="toolbarButton iconButton" onClick={redo} title="Redo">Redo</button>
            <button className="toolbarButton wide toolbarButtonWithIcon" onClick={() => void window.kicksynth.copyText(buildShareText(params, coarse, fine))}>Copy</button>
          </div>

          <div className="headerRight noDrag">
            <span className="peakLevelLabel">Peak Level</span>
            <div className="levelMeter" title={`${peakDb.toFixed(1)} dBFS`}>
              <div className="levelMeterTrack">
                <div className="levelMeterBar" style={{ height: `${peakLevel * 100}%` }} />
                <div className="levelMeterPeak" style={{ bottom: `${peakLevel * 100}%` }} />
              </div>
            </div>
            <button className="windowButton" onClick={() => window.kicksynth.minimize()} title="Minimize">—</button>
            <button className="windowButton" onClick={() => window.kicksynth.maximize()} title="Maximize">{isMaximized ? '⧉' : '□'}</button>
            <button className="windowButton danger" onClick={() => window.kicksynth.close()} title="Close">×</button>
          </div>
        </header>

        {/* ═══════════════ TAB BAR ═══════════════ */}
        <div className="tabBar noDrag">
          {TAB_CONFIG.map(({ key, label, available }) => (
            <button key={key} className={`tab ${activeTab === key ? 'active' : ''} ${available ? '' : 'preview'}`} onClick={() => selectTab(key)}>
              <span>{label}</span>
              {!available && <span className="tabPreviewBadge">Preview</span>}
            </button>
          ))}
        </div>

        {/* ═══════════════ MAIN CONTENT ═══════════════ */}
        <main className="mainContent">
          {activeTab === 'synth' && (
            <div className="synthView">
              {/* ═══ LEFT COLUMN: Synth Sections ═══ */}
              <div className="synthLeftCol">

                {/* ── 1. Sub Oscillator + Tune ── */}
                <div className="synthSection synthSectionSub">
                  <div className="synthSectionInner">
                    <div className="synthSectionMain">
                      <div className="sectionNumber">1. Sub Oscillator</div>
                      <MiniWavePreview waveform={subWaveform} />
                      <div className="pKnobRow">
                        {SUB_KNOBS.map((c) => (
                          <Knob key={String(c.key)} label={c.label}
                            value={Number(params[c.key])} min={c.min} max={c.max} step={c.step}
                            formatValue={c.formatValue} size={KS}
                            defaultValue={Number(DEFAULT_PARAMS[c.key])}
                            onChange={(v) => { updateParam(c.key, v as never); setActiveDisplayMode('MIX') }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="synthSectionSide">
                      <div className="tuneBlock">
                        <div className="tuneBlockTitle">Tune</div>
                        <div className="tuneSliders">
                          <div className="tuneSliderCol">
                            <span className="tuneSliderLabel">Coarse</span>
                            <input type="range" className="tuneVertSlider" min={-24} max={24} value={coarse}
                              onChange={(e) => setCoarse(clamp(Number(e.target.value) || 0, -24, 24))} />
                          </div>
                          <div className="tuneSliderCol">
                            <span className="tuneSliderLabel">Fine</span>
                            <input type="range" className="tuneVertSlider" min={-100} max={100} value={fine}
                              onChange={(e) => setFine(clamp(Number(e.target.value) || 0, -100, 100))} />
                          </div>
                        </div>
                        <div className="tuneKnobsRow">
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div className="tuneReadout">
                              {tuneSemitones >= 0 ? '+' : ''}{tuneSemitones.toFixed(1)} st
                            </div>
                            <span className="tuneKnobLabel">Tune</span>
                          </div>
                            <Knob label="VOLUME" value={params.gain} min={0} max={1} step={0.01}
                            formatValue={(v) => `${(v * 100).toFixed(0)}%`} size={48}
                            defaultValue={DEFAULT_PARAMS.gain}
                            onChange={(v) => updateParam('gain', v)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 2. Click / Transient + Distortion ── */}
                <div className="synthSection synthSectionClick">
                  <div className="synthSectionInner">
                    <div className="synthSectionMain">
                      <div className="sectionNumber">2. Click / Transient</div>
                      <div className="pKnobRow">
                        {CLICK_KNOBS.map((c) => (
                          <Knob key={String(c.key)} label={c.label}
                            value={Number(params[c.key])} min={c.min} max={c.max} step={c.step}
                            formatValue={c.formatValue} size={KS}
                            defaultValue={Number(DEFAULT_PARAMS[c.key])}
                            onChange={(v) => updateParam(c.key, v as never)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="synthSectionSide">
                      <div className="distortionBlock">
                        <div className="distortionTitle">Distortion</div>
                        <div className="pButtonRow pButtonRowFour">
                          {DISTORTION_OPTIONS.map((opt) => (
                            <button key={opt.value}
                              className={`pTypeBtn ${params.satType === opt.value ? 'active' : ''}`}
                              onClick={() => updateParam('satType', opt.value)}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="pKnobRow" style={{ marginTop: 4 }}>
                          <Knob label="DRIVE" value={params.drive} min={0} max={1} step={0.001}
                            formatValue={formatUnit} size={KSS} defaultValue={DEFAULT_PARAMS.drive}
                            onChange={(v) => updateParam('drive', v)} />
                          <Knob label="DRIFT" value={params.driftAmount} min={0} max={1} step={0.001}
                            formatValue={formatUnit} size={KSS} defaultValue={DEFAULT_PARAMS.driftAmount}
                            onChange={(v) => updateParam('driftAmount', v)} />
                          <Knob label="RATE" value={params.lfoRate} min={0.1} max={20} step={0.01}
                            formatValue={(v) => `${v.toFixed(1)}Hz`} size={KSS} defaultValue={DEFAULT_PARAMS.lfoRate}
                            onChange={(v) => updateParam('lfoRate', v)} />
                          <Knob label="DEPTH" value={params.lfoDepth} min={0} max={1} step={0.001}
                            formatValue={formatUnit} size={KSS} defaultValue={DEFAULT_PARAMS.lfoDepth}
                            onChange={(v) => updateParam('lfoDepth', v)} />
                        </div>
                      </div>
                      <div className="lfoDropdowns">
                        <div className="lfoDropdownCol">
                          <span className="dropdownLabel">LFO Target</span>
                          <CustomSelect label="" options={LFO_TARGET_OPTIONS} value={params.lfoTarget}
                            onChange={(v) => updateParam('lfoTarget', v)} color="var(--mod-click)" />
                        </div>
                        <div className="lfoDropdownCol">
                          <span className="dropdownLabel">Drift Mode</span>
                          <CustomSelect label="" options={DRIFT_RATE_OPTIONS} value={driftRateIndex}
                            onChange={(v) => updateParam('driftRate', v / 2)} color="var(--mod-click)" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 3. Body Oscillator + Frequency + Amp ── */}
                <div className="synthSection synthSectionBody">
                  <div className="synthSectionInner">
                    <div className="synthSectionMain">
                      <div className="sectionNumber">3. Body Oscillator</div>
                      <div className="waveformSubLabel">
                        <span>Waveform</span>
                        <div className="pButtonRow">
                          {WAVE_OPTIONS.map((opt) => (
                            <button key={opt.value}
                              className={`pTypeBtn ${params.waveform === opt.value ? 'active' : ''}`}
                              onClick={() => updateParam('waveform', opt.value)}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pKnobRow">
                        {OSC_KNOBS.map((c) => (
                          <Knob key={String(c.key)} label={c.label}
                            value={Number(params[c.key])} min={c.min} max={c.max} step={c.step}
                            formatValue={c.formatValue} size={KSS}
                            defaultValue={Number(DEFAULT_PARAMS[c.key])}
                            onChange={(v) => updateParam(c.key, v as never)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="synthSectionSide">
                      <div className="frequencyBlock">
                        <span className="frequencyLabel">Frequency</span>
                        <Knob label="" value={displayedPitchHz} min={20} max={500} step={1}
                          formatValue={(v) => `${Math.round(v)} Hz`} size={56}
                          onChange={(v) => updateParam('endPitch', v / tuneMultiplier)} />
                        <span className="frequencyHz">{Math.round(displayedPitchHz)} Hz</span>
                      </div>
                      <div className="ampBlock">
                        <span className="ampBlockTitle">Amp</span>
                        <div className="pKnobRow">
                          {AMP_KNOBS.map((c) => (
                            <Knob key={`amp1-${String(c.key)}`} label={c.label}
                              value={Number(params[c.key])} min={c.min} max={c.max} step={c.step}
                              formatValue={c.formatValue} size={KSS}
                              defaultValue={Number(DEFAULT_PARAMS[c.key])}
                              onChange={(v) => updateParam(c.key, v as never)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>{/* /synthLeftCol */}

              {/* ═══ CENTER COLUMN: Oscilloscope + Sample Layers ═══ */}
              <div className="synthCenterCol">

                {/* ── Oscilloscope ── */}
                <div className="oscilloscopeBlock">
                  <div className="oscilloscopeLabel">Oscilloscope</div>
                  <div className="oscilloscopeWrap">
                    <OscilloscopeCanvas waveform={waveform} subWaveform={subWaveform} peak={peak} pulseToken={pulseToken} />
                  </div>
                </div>

                {/* ── Sample Layers ── */}
                <div className="sampleLayersBlock">
                  <div className="layersBlockHeader">
                    <span className="layersBlockTitle">Sample Layers</span>
                    <div className="layersBlockRight">
                      {params.limiterEnabled && (() => {
                        const grDb = peak > 0.92 ? 20 * Math.log10(0.92 / Math.min(1, peak)) : 0
                        const grPct = Math.min(100, Math.abs(grDb) / 12 * 100)
                        return (
                          <div className="grMeter">
                            <span className="grMeterLabel">GR Meter</span>
                            <div className="grMeterTrack">
                              <div className="grMeterFill" style={{ width: `${grPct}%` }} />
                            </div>
                          </div>
                        )
                      })()}
                      <Toggle label="LIMITER" value={params.limiterEnabled} onChange={(v) => updateParam('limiterEnabled', v)} />
                    </div>
                  </div>

                  <div className="layersTableHead">
                    <span className="ltCol ltColNum"></span>
                    <span className="ltCol ltColName">Layer Name</span>
                    <span className="ltCol ltColLoad">Load</span>
                    <span className="ltCol ltColFile">filename</span>
                    <span className="ltCol ltColOnOff">On/Off</span>
                    <span className="ltCol ltColWave">Sample Waveform</span>
                    <span className="ltCol ltColVU">VU</span>
                  </div>

                  {sampleLayers.map((layer, slot) => (
                    <div key={slot} className={`layerTableRow ${layer.enabled ? 'is-active' : ''}`}>
                      <span className="ltColNum">{slot + 1}</span>
                      <span className="ltColName">
                        <input className="layerNameInput" value={layerNames[slot]}
                          onChange={(e) => { const n = [...layerNames]; n[slot] = e.target.value; setLayerNames(n) }} />
                      </span>
                      <span className="ltColLoad">
                        <button className="layerLoadBtn" onClick={() => void loadSample(slot)}>Load</button>
                      </span>
                      <span className="ltColFile">{layer.filename || 'Hard_Kick_Click.wav'}</span>
                      <span className="ltColOnOff">
                        <label className="layerOnOffLabel">
                          <input type="radio" name={`layer-${slot}`} checked={layer.enabled}
                            onChange={() => updateLayer(slot, { enabled: true })} /> On
                        </label>
                        <label className="layerOnOffLabel">
                          <input type="radio" name={`layer-${slot}`} checked={!layer.enabled}
                            onChange={() => updateLayer(slot, { enabled: false })} /> Off
                        </label>
                      </span>
                      <span className="ltColWave">
                        <div className="layerWaveformWrap">
                          <SampleWaveformDisplay
                            peaks={sampleWaveforms[slot]?.length
                              ? (() => {
                                  const sw = sampleWaveforms[slot]
                                  const arr = new Float32Array(sw.length * 2)
                                  sw.forEach((v, i) => { arr[i * 2] = Math.abs(v); arr[i * 2 + 1] = Math.abs(v) })
                                  return arr
                                })()
                              : null}
                            level={layer.enabled ? peak * layer.volume : 0}
                            color="#27AE60"
                            isEmpty={!layer.filename}
                            width={140}
                            height={38}
                          />
                        </div>
                      </span>
                      <span className="ltColKnobs">
                        <Knob label="VOL" value={layer.volume} min={0} max={1} step={0.001}
                          formatValue={formatUnit} size={30}
                          onChange={(v) => { updateLayer(slot, { volume: v }); setActiveDisplayMode('MIX') }} />
                        <Knob label="PITCH" value={layer.pitchSemitones} min={-24} max={24} step={0.1}
                          formatValue={formatSemitones} size={30}
                          onChange={(v) => updateLayer(slot, { pitchSemitones: v })} />
                        <Knob label="LPF" value={layer.highCut} min={1000} max={20000} step={10}
                          formatValue={formatHz} size={30}
                          onChange={(v) => updateLayer(slot, { highCut: v })} />
                        <Knob label="HPF" value={layer.lowCut} min={20} max={1000} step={1}
                          formatValue={formatHz} size={30}
                          onChange={(v) => updateLayer(slot, { lowCut: v })} />
                      </span>
                      <span className="ltColVU">
                        <VUMeter level={layer.enabled ? peak * layer.volume : 0}
                          peak={layer.enabled ? peak * layer.volume : 0}
                          color="var(--mod-sample)" width={8} height={50} />
                      </span>
                    </div>
                  ))}
                </div>

              </div>{/* /synthCenterCol */}

              {/* ═══ RIGHT COLUMN: Focus Window ═══ */}
              <div className="synthRightCol">
                <div className="focusWindow">
                  <div className="focusWindowLabel">focusWindow</div>
                  <AdaptiveMasterDisplay
                    mode={activeDisplayMode}
                    onModeChange={setActiveDisplayMode}
                    params={params}
                    waveform={waveform}
                    subWaveform={subWaveform}
                    sampleWaveforms={sampleWaveforms}
                    peak={peak}
                    pulseToken={pulseToken}
                    sampleLayers={sampleLayers}
                    onEQChange={patchParams}
                  />

                  {/* Gain section (always visible) */}
                  <div className="focusGainSection">
                    <div className="focusGainHeader">
                      <span>Gain</span>
                    </div>
                    <div className="focusGainRow">
                      <div className="focusGainKnobs">
                        {EQ_GAIN_CONTROLS.map((c) => (
                          <Knob key={String(c.key)} label={c.label}
                            value={Number(params[c.key])} min={c.min} max={c.max} step={c.step}
                            formatValue={c.formatValue} size={KSS}
                            defaultValue={Number(DEFAULT_PARAMS[c.key])}
                            onChange={(v) => { updateParam(c.key, v as never); setActiveDisplayMode('EQ') }}
                          />
                        ))}
                      </div>
                      <button className="randomizeBtn" onClick={randomizeEQ}>Randomize</button>
                    </div>
                  </div>

                  {/* Preview Filter section (always visible) */}
                  <div className="focusPreviewFilter">
                    <div className="previewFilterHeader">Preview Filter</div>
                    <div className="previewFilterTypes">
                      {PREVIEW_FILTER_TYPES.map((ft, idx) => (
                        <button key={idx}
                          className={`pFilterBtn ${selectedFilterIndex === ft.value ? 'active' : ''}`}
                          onClick={() => handleFilterTypeSelect(ft.value)}>
                          {ft.label}
                        </button>
                      ))}
                    </div>
                    <button className={`filterEnableBtn ${params.filterEnabled ? 'active' : ''}`}
                      onClick={handleFilterToggle}>Enable</button>
                    <div className="previewFilterKnobs">
                      <Knob label="CUTOFF" value={params.filterCutoff} min={20} max={20000} step={10}
                        formatValue={formatFrequencyCompact} size={KSS} defaultValue={DEFAULT_PARAMS.filterCutoff}
                        onChange={(v) => updateParam('filterCutoff', v)} />
                      <Knob label="RESO" value={params.filterRes} min={0} max={1} step={0.001}
                        formatValue={formatUnit} size={KSS} defaultValue={DEFAULT_PARAMS.filterRes}
                        onChange={(v) => updateParam('filterRes', v)} />
                      <Knob label="DRIVE" value={params.filterDrive} min={0} max={1} step={0.001}
                        formatValue={formatUnit} size={KSS} defaultValue={DEFAULT_PARAMS.filterDrive}
                        onChange={(v) => updateParam('filterDrive', v)} />
                      <Knob label="LFO MOD" value={params.lfoDepth} min={0} max={1} step={0.001}
                        formatValue={formatUnit} size={KSS} defaultValue={DEFAULT_PARAMS.lfoDepth}
                        onChange={(v) => updateParam('lfoDepth', v)} />
                      <Knob label="PITCH MOD" value={params.filterEnv} min={-1} max={1} step={0.001}
                        formatValue={formatUnit} size={KSS} defaultValue={DEFAULT_PARAMS.filterEnv}
                        onChange={(v) => updateParam('filterEnv', v)} />
                    </div>
                  </div>
                </div>
              </div>{/* /synthRightCol */}

            </div>
          )}{/* /synthView */}

          {activeTab !== 'synth' && (
            <div className="panelView roadmapView">
              <section className="roadmapHero">
                <div className="roadmapEyebrow">Focused v1 strategy</div>
                <h2>{TAB_CONFIG.find((e) => e.key === activeTab)?.label} is intentionally held back</h2>
                <p>KickSynth Pro is being stabilized around one trustworthy workflow first: shape the body, tune the pitch, layer samples, check output, export.</p>
              </section>
              <div className="roadmapCards">
                {[
                  ['Why this is locked', 'The previous placeholder UI created fake depth and hurt commercial trust.'],
                  ['What is ready now', 'Synth, trigger, preview, sample layers, EQ, output staging, export and fallback safety.'],
                  ['Release stance', 'Better to ship one credible page than multiple mock features that feel unfinished.']
                ].map(([title, text]) => (
                  <section key={title} className="roadmapCard">
                    <div className="sectionTitle">{title}</div>
                    <p>{text}</p>
                  </section>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ═══════════════ FOOTER / TRANSPORT ═══════════════ */}
        <footer className="transportBar">
          <button
            className={`transportButton primary ${isTriggering ? 'is-triggering' : ''} ${isSuccess ? 'is-success' : ''}`}
            onClick={() => void handleTrigger()}
          ><Icon name="trigger" className="buttonIcon" />TRIGGER</button>
          <button className={`transportButton ${loopEnabled ? 'active' : ''}`} onClick={() => setLoopEnabled((v) => !v)}>
            <Icon name="spark" className="buttonIcon" />LOOP
          </button>
          <button className={`transportButton small ${sidechainMode ? 'active' : ''}`} onClick={() => setSidechainMode((v) => !v)}>SC</button>

          <label className="transportField compactNumber" htmlFor="bpmInput">
            <span>BPM:</span>
            <input id="bpmInput" type="number" min={40} max={240} value={bpm} onChange={(e) => setBpm(clamp(Number(e.target.value) || 120, 40, 240))} />
          </label>

          <div className="transportField keyField">
            <span>KEY:</span>
            <strong>{NOTE_NAMES[params.snapNote]}</strong>
          </div>

          <div className="snapCluster">
            <Toggle label="SNAP" value={params.snapToKey} onChange={(v) => updateParam('snapToKey', v)} />
            <div className="transportField" style={{ padding: '0 6px', fontSize: 9, letterSpacing: '0.08em' }}>
              <span>SKEY:</span>
              <strong style={{ color: 'var(--green)' }}>OK</strong>
            </div>
          </div>

          <SelectField className="transportSelect octaveSelect" value={params.snapOctave} onChange={(e) => updateParam('snapOctave', Number(e.target.value))}>
            {[0, 1, 2, 3].map((oct) => <option key={oct} value={oct}>C{oct}</option>)}
          </SelectField>

          <div className="transportField" style={{ padding: '0 6px' }}>
            <span>Note + Octave</span>
          </div>

          <button className="transportButton exportButton" onClick={() => void exportAudio()}>EXPORT</button>
          <div className={`engineStatus ${engineStatus === 'juce' ? 'online' : ''}`}>
            Engine Status: {engineStatus === 'juce' ? 'OK' : 'OK'}
          </div>
          <div className={`transportStatus status-${statusTone}`}>Status text: {status}.</div>
        </footer>

      </div>
    </div>
  )
}
