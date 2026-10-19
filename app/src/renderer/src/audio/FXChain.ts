export type FXModuleKey = 'compressor' | 'distortion' | 'eq' | 'reverb' | 'delay' | 'stereo'
export type DistortionMode = 'tube' | 'tape' | 'transistor' | 'bitcrush'
export type ReverbPreset = 'tight' | 'room' | 'hall' | 'plate' | 'gated'
export type DelayMode = 'slapback' | 'synced'
export type DelayDivision = '1/4' | '1/8' | '1/16' | '1/32'

type EnabledMap = Record<FXModuleKey, boolean>

type EQSettings = {
  lowShelfFreq: number
  lowShelfGain: number
  lowMidFreq: number
  lowMidGain: number
  lowMidQ: number
  highMidFreq: number
  highMidGain: number
  highMidQ: number
  highShelfFreq: number
  highShelfGain: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export class FXChain {
  private ctx: AudioContext
  private input: GainNode
  private output: GainNode

  private compressor: DynamicsCompressorNode
  private compDry: GainNode
  private compWet: GainNode
  private compOut: GainNode

  private distortionNode: WaveShaperNode
  private distortionTone: BiquadFilterNode
  private distDry: GainNode
  private distWet: GainNode
  private distOut: GainNode

  private eqLowShelf: BiquadFilterNode
  private eqLowMid: BiquadFilterNode
  private eqHighMid: BiquadFilterNode
  private eqHighShelf: BiquadFilterNode
  private eqDry: GainNode
  private eqWet: GainNode
  private eqOut: GainNode

  private reverbPreDelay: DelayNode
  private reverbNode: ConvolverNode
  private reverbDry: GainNode
  private reverbWet: GainNode
  private reverbOut: GainNode

  private delayNode: DelayNode
  private delayFeedback: GainNode
  private delayTone: BiquadFilterNode
  private delayDry: GainNode
  private delayWet: GainNode
  private delayOut: GainNode

  private stereoSplitter: ChannelSplitterNode
  private stereoMerger: ChannelMergerNode
  private stereoDry: GainNode
  private stereoWet: GainNode
  private stereoSideGain: GainNode
  private stereoLeftOut: GainNode
  private stereoRightOut: GainNode

  private makeupGain: GainNode
  private enabled: EnabledMap = {
    compressor: true,
    distortion: false,
    eq: true,
    reverb: false,
    delay: false,
    stereo: false
  }

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.input = ctx.createGain()
    this.output = ctx.createGain()

    this.compressor = ctx.createDynamicsCompressor()
    this.compDry = ctx.createGain()
    this.compWet = ctx.createGain()
    this.compOut = ctx.createGain()

    this.distortionNode = ctx.createWaveShaper()
    this.distortionTone = ctx.createBiquadFilter()
    this.distDry = ctx.createGain()
    this.distWet = ctx.createGain()
    this.distOut = ctx.createGain()

    this.eqLowShelf = ctx.createBiquadFilter()
    this.eqLowMid = ctx.createBiquadFilter()
    this.eqHighMid = ctx.createBiquadFilter()
    this.eqHighShelf = ctx.createBiquadFilter()
    this.eqDry = ctx.createGain()
    this.eqWet = ctx.createGain()
    this.eqOut = ctx.createGain()

    this.reverbPreDelay = ctx.createDelay(1)
    this.reverbNode = ctx.createConvolver()
    this.reverbDry = ctx.createGain()
    this.reverbWet = ctx.createGain()
    this.reverbOut = ctx.createGain()

    this.delayNode = ctx.createDelay(2)
    this.delayFeedback = ctx.createGain()
    this.delayTone = ctx.createBiquadFilter()
    this.delayDry = ctx.createGain()
    this.delayWet = ctx.createGain()
    this.delayOut = ctx.createGain()

    this.stereoSplitter = ctx.createChannelSplitter(2)
    this.stereoMerger = ctx.createChannelMerger(2)
    this.stereoDry = ctx.createGain()
    this.stereoWet = ctx.createGain()
    this.stereoSideGain = ctx.createGain()
    this.stereoLeftOut = ctx.createGain()
    this.stereoRightOut = ctx.createGain()

    this.makeupGain = ctx.createGain()

    this.buildChain()
    this.setCompressor(-12, 6, 0.001, 0.05, 2, 0.7)
    this.setPunchMode()
    this.setDistortion(0.22, 0.58, 0.34, 'tube')
    this.setEq({
      lowShelfFreq: 80,
      lowShelfGain: 0,
      lowMidFreq: 200,
      lowMidGain: 0,
      lowMidQ: 1,
      highMidFreq: 2000,
      highMidGain: 0,
      highMidQ: 1,
      highShelfFreq: 8000,
      highShelfGain: 0
    }, 1)
    this.setReverbPreset('tight', 0.14)
    this.setDelayPreset('1/16', 0.14)
    this.setStereo(1)
    this.updateMix('compressor', 0.7)
    this.updateMix('distortion', 0)
    this.updateMix('eq', 1)
    this.updateMix('reverb', 0)
    this.updateMix('delay', 0)
    this.updateMix('stereo', 0)
    this.setEnabled('compressor', true)
    this.setEnabled('distortion', false)
    this.setEnabled('eq', true)
    this.setEnabled('reverb', false)
    this.setEnabled('delay', false)
    this.setEnabled('stereo', false)
  }

  private buildChain(): void {
    this.compressor.knee.value = 12

    this.distortionNode.oversample = '4x'
    this.distortionTone.type = 'lowpass'
    this.distortionTone.frequency.value = 5200
    this.distortionTone.Q.value = 0.707

    this.eqLowShelf.type = 'lowshelf'
    this.eqLowMid.type = 'peaking'
    this.eqHighMid.type = 'peaking'
    this.eqHighShelf.type = 'highshelf'

    this.delayTone.type = 'lowpass'
    this.delayTone.frequency.value = 5000
    this.delayFeedback.gain.value = 0.2

    this.input.connect(this.compDry)
    this.input.connect(this.compressor)
    this.compressor.connect(this.compWet)
    this.compDry.connect(this.compOut)
    this.compWet.connect(this.compOut)

    this.compOut.connect(this.distDry)
    this.compOut.connect(this.distortionNode)
    this.distortionNode.connect(this.distortionTone)
    this.distortionTone.connect(this.distWet)
    this.distDry.connect(this.distOut)
    this.distWet.connect(this.distOut)

    this.distOut.connect(this.eqDry)
    this.distOut.connect(this.eqLowShelf)
    this.eqLowShelf.connect(this.eqLowMid)
    this.eqLowMid.connect(this.eqHighMid)
    this.eqHighMid.connect(this.eqHighShelf)
    this.eqHighShelf.connect(this.eqWet)
    this.eqDry.connect(this.eqOut)
    this.eqWet.connect(this.eqOut)

    this.eqOut.connect(this.reverbDry)
    this.eqOut.connect(this.reverbPreDelay)
    this.reverbPreDelay.connect(this.reverbNode)
    this.reverbNode.connect(this.reverbWet)
    this.reverbDry.connect(this.reverbOut)
    this.reverbWet.connect(this.reverbOut)

    this.reverbOut.connect(this.delayDry)
    this.reverbOut.connect(this.delayNode)
    this.delayNode.connect(this.delayTone)
    this.delayTone.connect(this.delayWet)
    this.delayTone.connect(this.delayFeedback)
    this.delayFeedback.connect(this.delayNode)
    this.delayDry.connect(this.delayOut)
    this.delayWet.connect(this.delayOut)

    this.delayOut.connect(this.stereoDry)
    this.delayOut.connect(this.stereoWet)
    this.stereoWet.connect(this.stereoSplitter)

    this.stereoSplitter.connect(this.stereoLeftOut, 0)
    this.stereoSplitter.connect(this.stereoRightOut, 1)
    this.stereoSplitter.connect(this.stereoSideGain, 0)
    this.stereoSplitter.connect(this.stereoSideGain, 1)

    this.stereoLeftOut.connect(this.stereoMerger, 0, 0)
    this.stereoRightOut.connect(this.stereoMerger, 0, 1)
    this.stereoSideGain.connect(this.stereoMerger, 0, 0)
    this.stereoSideGain.connect(this.stereoMerger, 0, 1)

    this.stereoDry.connect(this.makeupGain)
    this.stereoMerger.connect(this.makeupGain)
    this.makeupGain.connect(this.output)
  }

  connect(destination: AudioNode): void {
    this.output.connect(destination)
  }

  disconnect(): void {
    this.output.disconnect()
  }

  get inputNode(): GainNode {
    return this.input
  }

  get outputNode(): GainNode {
    return this.output
  }

  setEnabled(key: FXModuleKey, enabled: boolean): void {
    this.enabled[key] = enabled
    if (key === 'compressor') {
      this.compDry.gain.value = enabled ? this.compDry.gain.value : 1
      this.compWet.gain.value = enabled ? this.compWet.gain.value : 0
    }
    if (key === 'distortion') {
      this.distDry.gain.value = enabled ? this.distDry.gain.value : 1
      this.distWet.gain.value = enabled ? this.distWet.gain.value : 0
    }
    if (key === 'eq') {
      this.eqDry.gain.value = enabled ? this.eqDry.gain.value : 1
      this.eqWet.gain.value = enabled ? this.eqWet.gain.value : 0
    }
    if (key === 'reverb') {
      this.reverbDry.gain.value = enabled ? this.reverbDry.gain.value : 1
      this.reverbWet.gain.value = enabled ? this.reverbWet.gain.value : 0
    }
    if (key === 'delay') {
      this.delayDry.gain.value = enabled ? this.delayDry.gain.value : 1
      this.delayWet.gain.value = enabled ? this.delayWet.gain.value : 0
    }
    if (key === 'stereo') {
      this.stereoDry.gain.value = enabled ? this.stereoDry.gain.value : 1
      this.stereoWet.gain.value = enabled ? this.stereoWet.gain.value : 0
    }
  }

  updateMix(key: FXModuleKey, mix: number): void {
    const wet = clamp(mix, 0, key === 'stereo' ? 2 : 1)
    const dry = key === 'stereo' ? clamp(1 - wet * 0.5, 0, 1) : clamp(1 - wet, 0, 1)

    if (key === 'compressor') {
      this.compDry.gain.value = this.enabled.compressor ? dry : 1
      this.compWet.gain.value = this.enabled.compressor ? wet : 0
    }
    if (key === 'distortion') {
      this.distDry.gain.value = this.enabled.distortion ? dry : 1
      this.distWet.gain.value = this.enabled.distortion ? wet : 0
    }
    if (key === 'eq') {
      this.eqDry.gain.value = this.enabled.eq ? dry : 1
      this.eqWet.gain.value = this.enabled.eq ? wet : 0
    }
    if (key === 'reverb') {
      this.reverbDry.gain.value = this.enabled.reverb ? dry : 1
      this.reverbWet.gain.value = this.enabled.reverb ? wet : 0
    }
    if (key === 'delay') {
      this.delayDry.gain.value = this.enabled.delay ? dry : 1
      this.delayWet.gain.value = this.enabled.delay ? wet : 0
    }
    if (key === 'stereo') {
      this.stereoDry.gain.value = this.enabled.stereo ? dry : 1
      this.stereoWet.gain.value = this.enabled.stereo ? Math.min(1, wet * 0.75) : 0
    }
  }

  setCompressor(threshold: number, ratio: number, attack: number, release: number, makeup: number, mix = 1): void {
    this.compressor.threshold.value = clamp(threshold, -20, 0)
    this.compressor.ratio.value = clamp(ratio, 2, 20)
    this.compressor.attack.value = clamp(attack, 0.0001, 0.05)
    this.compressor.release.value = clamp(release, 0.01, 0.5)
    this.makeupGain.gain.value = Math.pow(10, clamp(makeup, 0, 12) / 20)
    this.updateMix('compressor', mix)
  }

  setPunchMode(makeup = 3, mix = 0.72): void {
    this.setCompressor(-10, 6, 0.001, 0.05, makeup, mix)
  }

  setDistortion(amount: number, tone: number, mix: number, mode: DistortionMode = 'tube'): void {
    const drive = clamp(amount, 0, 1)
    const curve = new Float32Array(256)

    for (let index = 0; index < 256; index += 1) {
      const x = (index * 2) / 256 - 1

      if (mode === 'tube') {
        curve[index] = Math.tanh(x * (1 + drive * 6))
        continue
      }

      if (mode === 'tape') {
        curve[index] = Math.tanh((x + drive * 0.15) * (1 + drive * 5)) * 0.9
        continue
      }

      if (mode === 'transistor') {
        curve[index] = clamp(x * (1 + drive * 16), -0.7, 0.7)
        continue
      }

      const steps = Math.max(6, Math.round(28 - drive * 20))
      curve[index] = Math.round(x * steps) / steps
    }

    this.distortionNode.curve = curve
    this.distortionTone.frequency.value = 900 + clamp(tone, 0, 1) * 9000
    this.updateMix('distortion', mix)
  }

  setEq(settings: EQSettings, mix = 1): void {
    this.eqLowShelf.frequency.value = clamp(settings.lowShelfFreq, 20, 600)
    this.eqLowShelf.gain.value = clamp(settings.lowShelfGain, -12, 12)

    this.eqLowMid.frequency.value = clamp(settings.lowMidFreq, 80, 1200)
    this.eqLowMid.gain.value = clamp(settings.lowMidGain, -12, 12)
    this.eqLowMid.Q.value = clamp(settings.lowMidQ, 0.2, 8)

    this.eqHighMid.frequency.value = clamp(settings.highMidFreq, 500, 8000)
    this.eqHighMid.gain.value = clamp(settings.highMidGain, -12, 12)
    this.eqHighMid.Q.value = clamp(settings.highMidQ, 0.2, 8)

    this.eqHighShelf.frequency.value = clamp(settings.highShelfFreq, 2000, 20000)
    this.eqHighShelf.gain.value = clamp(settings.highShelfGain, -12, 12)
    this.updateMix('eq', mix)
  }

  setReverb(size: number, damping: number, predelay: number, width: number, mix: number): void {
    this.reverbPreDelay.delayTime.value = clamp(predelay, 0, 0.25)
    this.reverbNode.buffer = this.generateReverb(size, damping, width)
    this.updateMix('reverb', mix)
  }

  setReverbPreset(preset: ReverbPreset, mix = 0.16): void {
    if (preset === 'tight') {
      this.setReverb(0.06, 0.55, 0.005, 0.15, mix)
      return
    }
    if (preset === 'room') {
      this.setReverb(0.16, 0.42, 0.012, 0.28, mix)
      return
    }
    if (preset === 'hall') {
      this.setReverb(0.45, 0.3, 0.02, 0.45, mix)
      return
    }
    if (preset === 'plate') {
      this.setReverb(0.62, 0.36, 0.01, 0.2, mix)
      return
    }

    this.setReverb(0.11, 0.88, 0.003, 0.08, mix)
  }

  private generateReverb(size: number, damping: number, width: number): AudioBuffer {
    const sr = this.ctx.sampleRate
    const safeSize = clamp(size, 0.05, 1)
    const duration = 0.18 + safeSize * 2.1
    const length = Math.ceil(sr * duration)
    const buffer = this.ctx.createBuffer(2, length, sr)
    const widthAmount = clamp(width, 0, 1)

    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel)
      const phase = channel === 0 ? 1 : -1
      for (let index = 0; index < length; index += 1) {
        const time = index / sr
        const decay = Math.exp(-(time * (1.6 + damping * 5.5)) / safeSize)
        const noise = Math.random() * 2 - 1
        const widthBias = channel === 0 ? 1 + widthAmount * 0.2 : 1 - widthAmount * 0.2
        data[index] = noise * decay * widthBias + Math.sin(index * 0.00093 * phase) * 0.0012 * widthAmount
      }
    }

    return buffer
  }

  setDelay(time: number, feedback: number, mix: number, sync = true): void {
    this.delayNode.delayTime.value = clamp(time, 0.015, 1.5)
    this.delayFeedback.gain.value = clamp(feedback, 0, 0.8)
    this.delayTone.frequency.value = 2200 + clamp(1 - feedback, 0, 1) * 5200
    this.updateMix('delay', mix)

    if (!sync && time < 0.06)
      this.delayFeedback.gain.value = Math.min(this.delayFeedback.gain.value, 0.12)
  }

  setDelayPreset(division: DelayDivision, mix = 0.14, mode: DelayMode = 'synced', bpm = 120): void {
    if (mode === 'slapback') {
      this.setDelay(clamp(60 / Math.max(60, bpm), 0.015, 0.05), 0.08, mix, false)
      return
    }

    const beat = 60 / Math.max(1, bpm)
    const multiplier = division === '1/4' ? 1 : division === '1/8' ? 0.5 : division === '1/16' ? 0.25 : 0.125
    this.setDelay(beat * multiplier, 0.24, mix, true)
  }

  setStereo(width: number): void {
    const safeWidth = clamp(width, 0, 2)
    this.stereoSideGain.gain.value = Math.max(0, safeWidth - 1) * 0.5
    this.updateMix('stereo', clamp(safeWidth - 0.8, 0, 1))
  }
}
