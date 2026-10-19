export type FilterType =
  | 'lpf12'
  | 'lpf24'
  | 'hpf12'
  | 'hpf24'
  | 'bpf'
  | 'notch'
  | 'tb303'
  | 'ms20'
  | 'oberheim'
  | 'bypassed'

export interface FilterParams {
  type: FilterType
  cutoff: number
  resonance: number
  drive: number
  envAmount: number
  mix: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function createDriveCurve(amount: number): Float32Array {
  const drive = 1 + clamp(amount, 0, 1) * 12
  const curve = new Float32Array(512)

  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1
    curve[index] = Math.tanh(x * drive)
  }

  return curve
}

export class AnalogFilter {
  private ctx: AudioContext
  private input: GainNode
  private output: GainNode
  private filterA: BiquadFilterNode
  private filterB: BiquadFilterNode
  private preGain: GainNode
  private postGain: GainNode
  private driveShaper: WaveShaperNode
  private dryGain: GainNode
  private wetGain: GainNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.input = ctx.createGain()
    this.output = ctx.createGain()
    this.filterA = ctx.createBiquadFilter()
    this.filterB = ctx.createBiquadFilter()
    this.preGain = ctx.createGain()
    this.postGain = ctx.createGain()
    this.driveShaper = ctx.createWaveShaper()
    this.dryGain = ctx.createGain()
    this.wetGain = ctx.createGain()

    this.driveShaper.curve = createDriveCurve(0)
    this.driveShaper.oversample = '4x'

    this.input.connect(this.dryGain)
    this.dryGain.connect(this.output)

    this.input.connect(this.preGain)
    this.preGain.connect(this.driveShaper)
    this.driveShaper.connect(this.filterA)
    this.filterA.connect(this.filterB)
    this.filterB.connect(this.postGain)
    this.postGain.connect(this.wetGain)
    this.wetGain.connect(this.output)

    this.setParams({
      type: 'bypassed',
      cutoff: 4000,
      resonance: 0,
      drive: 0,
      envAmount: 0,
      mix: 1
    })
  }

  get inputNode(): GainNode {
    return this.input
  }

  get outputNode(): GainNode {
    return this.output
  }

  setParams(params: FilterParams): void {
    const { type, cutoff, resonance, drive, mix } = params
    const safeCutoff = clamp(cutoff, 20, 20000)
    const safeRes = clamp(resonance, 0, 1)
    const safeMix = clamp(mix, 0, 1)

    this.preGain.gain.value = 1 + clamp(drive, 0, 1) * 4
    this.postGain.gain.value = 0.85
    this.driveShaper.curve = createDriveCurve(drive)

    const configureStage = (filter: BiquadFilterNode, filterType: BiquadFilterType, q: number) => {
      filter.type = filterType
      filter.Q.value = q
      filter.frequency.value = safeCutoff
    }

    switch (type) {
      case 'lpf12':
        configureStage(this.filterA, 'lowpass', safeRes * 20)
        configureStage(this.filterB, 'allpass', 0.0001)
        break
      case 'lpf24':
        configureStage(this.filterA, 'lowpass', safeRes * 15 + 0.5)
        configureStage(this.filterB, 'lowpass', safeRes * 12 + 0.35)
        break
      case 'hpf12':
        configureStage(this.filterA, 'highpass', safeRes * 20)
        configureStage(this.filterB, 'allpass', 0.0001)
        break
      case 'hpf24':
        configureStage(this.filterA, 'highpass', safeRes * 15 + 0.5)
        configureStage(this.filterB, 'highpass', safeRes * 12 + 0.35)
        break
      case 'bpf':
        configureStage(this.filterA, 'bandpass', 0.5 + safeRes * 30)
        configureStage(this.filterB, 'allpass', 0.0001)
        break
      case 'notch':
        configureStage(this.filterA, 'notch', 1 + safeRes * 20)
        configureStage(this.filterB, 'allpass', 0.0001)
        break
      case 'tb303':
        configureStage(this.filterA, 'lowpass', 1 + safeRes * 24)
        configureStage(this.filterB, 'lowpass', 0.8 + safeRes * 18)
        this.postGain.gain.value = 0.72
        break
      case 'ms20':
        configureStage(this.filterA, 'highpass', 0.8 + safeRes * 20)
        configureStage(this.filterB, 'lowpass', 0.6 + safeRes * 10)
        this.postGain.gain.value = 0.78
        break
      case 'oberheim':
        configureStage(this.filterA, 'bandpass', 0.5 + safeRes * 15)
        configureStage(this.filterB, 'allpass', 0.0001)
        this.postGain.gain.value = 0.88
        break
      case 'bypassed':
        configureStage(this.filterA, 'allpass', 0.0001)
        configureStage(this.filterB, 'allpass', 0.0001)
        break
    }

    const wet = type === 'bypassed' ? 0 : safeMix
    this.dryGain.gain.value = 1 - wet
    this.wetGain.gain.value = wet
  }

  setCutoffEnvelope(baseCutoff: number, envAmount: number, startPitch: number, endPitch: number, now: number, decay: number): void {
    const safeBase = clamp(baseCutoff, 20, 20000)
    const safeDecay = Math.max(0.01, decay)
    const pitchRatio = clamp(startPitch / Math.max(1, endPitch), 0.25, 8)
    const envDepth = clamp(envAmount, -1, 1)
    const target = clamp(safeBase * Math.pow(pitchRatio, envDepth * 0.8), 20, 20000)

    ;[this.filterA.frequency, this.filterB.frequency].forEach((param) => {
      param.cancelScheduledValues(now)
      param.setValueAtTime(target, now)
      param.exponentialRampToValueAtTime(safeBase, now + safeDecay)
    })
  }
}
