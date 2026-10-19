type SynthParams = {
  startPitch: number
  endPitch: number
  pitchDecay: number
  pitchCurve: number
  phase: number
  waveform: number
  attack: number
  decay: number
  sustain: number
  release: number
  punch: number
  clickLevel: number
  clickDecay: number
  drive: number
  satType: number
  noise: number
  subLevel: number
  subHarmonic: number
  driftAmount: number
  driftRate: number
  gain: number
  lowCutHz: number
  highCutHz: number
  limiterEnabled: boolean
  eqLowShelfHz: number
  eqLowShelfDb: number
  eqLowMidHz: number
  eqLowMidDb: number
  eqLowMidQ: number
  eqHighMidHz: number
  eqHighMidDb: number
  eqHighMidQ: number
  eqHighShelfHz: number
  eqHighShelfDb: number
  snapToKey: boolean
  snapNote: number
  snapOctave: number
  velocity: number
  velocityToGain: number
  velocityToDrive: number
  lfoRate: number
  lfoDepth: number
  lfoTarget: number
  filterEnabled: boolean
  filterType: number
  filterCutoff: number
  filterRes: number
  filterDrive: number
  filterEnv: number
  filterMix: number
}

type SampleLayerState = {
  filename: string
  path?: string
  volume: number
  pitchSemitones: number
  startOffset: number
  lowCut: number
  highCut: number
  enabled: boolean
  reverse: boolean
}

type SynthPayload = {
  params: SynthParams
  sampleLayers: SampleLayerState[]
}

type PreviewResponse = {
  waveform: number[]
  subWaveform?: number[]
  sampleWaveforms?: number[][]
  peak?: number
  duration?: number
  sampleRate?: number
  server?: 'juce' | 'fallback'
}

type ExportResponse = {
  success: boolean
  path?: string
  error?: string
}

type TriggerResponse = {
  success: boolean
  error?: string
  engine?: 'juce' | 'webaudio'
}

type SampleLoadResponse = {
  success: boolean
  slot: number
  path?: string
  filename?: string
  error?: string
}

type ServerStateResponse = {
  success: boolean
  connected: boolean
  params?: SynthParams
  sampleLayers?: SampleLayerState[]
}

declare global {
  interface Window {
    kicksynth: {
      preview: (payload: SynthPayload) => Promise<PreviewResponse>
      trigger: (payload: SynthPayload) => Promise<TriggerResponse>
      export: (payload: SynthPayload) => Promise<ExportResponse>
      loadSample: (slot: number) => Promise<SampleLoadResponse>
      getState: () => Promise<ServerStateResponse>
      copyText: (text: string) => Promise<void>
      close: () => void
      minimize: () => void
      maximize: () => void
      onMaximizeState: (listener: (event: unknown, isMaximized: boolean) => void) => void
      offMaximizeState: (listener: (event: unknown, isMaximized: boolean) => void) => void
    }
  }
}

export {}
