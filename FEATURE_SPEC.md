# KickSynth Pro — Full Feature Specification

## 1. Sub/Oscillator Section
- [ ] Waveform Selection: Sine, Triangle, Square (Hardstyle), Tanh saturated sine
- [ ] Pitch Envelope: Start Hz, End Hz, Decay time
- [ ] Pitch Curve Control: Linear / Exponential / Custom Bezier
- [ ] Phase Control: Set initial phase (0°-360°) to prevent clicks

## 2. Click/Sample Layers
- [ ] Multi-Layer: 3 sample slots
- [ ] Per-layer Pitch shift (semitones)
- [ ] Time Stretch (change pitch without changing length)
- [ ] Start Offset (trim point within sample)
- [ ] Per-layer Low Pass Filter
- [ ] Per-layer High Pass Filter
- [ ] Per-layer Volume + Enable toggle
- [ ] Drag & drop sample loading

## 3. Amp Envelope & Shaping
- [ ] Full ADSR envelope (Attack, Decay, Sustain, Release)
- [ ] Soft Clipping at output (warm harmonics, no digital clipping)
- [ ] Look-ahead Limiter (always hits 0dBFS without clipping)
- [ ] Output Level meter (peak hold)

## 4. Drive / Distortion / "The Sauce"
- [ ] Saturation types: Soft Clip, Tube, Bitcrush, Tape
- [ ] Sub Harmonic Enhancer (adds octave below fundamental)
- [ ] Built-in EQ: 4-band (Low Shelf, Low-Mid Peak, High-Mid Peak, High Shelf)
- [ ] Drive amount per type

## 5. Utility & Workflow
- [ ] Snap to Key: lock sub frequency to musical note (C, C#, D... + octave)
- [ ] Export/Render to WAV (drag & drop to DAW)
- [ ] Waveform Visualizer: real-time, shows sub + sample layers + phase
- [ ] Sidechain Trigger Mode (Volume Shaper like Kickstart)
- [ ] Preset system: save/load/browse

## 6. Modulation
- [ ] LFO: rate, depth, target (pitch, amp, filter cutoff)
- [ ] Velocity Mapping: velocity → volume, drive, pitch
- [ ] Analog Drift: random micro-variations in frequency + phase (vintage feel)
  - Drift Amount: 0-100%
  - Drift Rate: slow/medium/fast

## 7. MIDI & Integration
- [ ] MIDI input: Note On triggers kick
- [ ] MIDI learn for all parameters
- [ ] OSC support (for DAW automation)

## 8. Audio Engine (JUCE)
- [ ] JUCE WebSocket server (real audio device, not CLI)
- [ ] ASIO/WASAPI support on Windows
- [ ] VST3 plugin format
- [ ] Standalone application
- [ ] Sample rate: 44.1k / 48k / 96k

## Priority Order (build sequence):
1. JUCE WebSocket server (audio engine)
2. Full oscillator + pitch envelope + phase control
3. Sample layers (3 slots) with filters
4. Drive/Saturation types
5. Sub harmonic enhancer
6. Built-in EQ (4-band)
7. Snap to Key
8. Analog Drift
9. Sidechain mode
10. LFO + Velocity mapping
