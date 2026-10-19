# KickSynth Pro - Technical Architecture

## 1. Executive Summary
KickSynth Pro is a hybrid kick drum synthesizer combining mathematical sub-synthesis with multi-layered sampling, driven by a high-performance C++ core (JUCE) and a modern, high-resolution Web UI (Electron/React).

## 2. Core Engine Architecture (C++/JUCE)
The engine is split into three primary processing blocks:

### A. Synthesis Layer (Sub-Oscillator)
- **Engine:** Pure mathematical oscillator (Sine, Triangle, Square with PWM).
- **Pitch Sweep:** Specialized exponential envelope for the initial "knock" (0ms - 50ms) and a logarithmic decay for the fundamental.
- **Saturation:** Soft-clip algorithm to add harmonics to the sub without losing fundamental power.

### B. Sample Engine (3 Layers)
- **Click Layer:** High-pass filtered transients (PCM).
- **Texture Layer:** Mid-band content for character (analog grit, acoustic thumps).
- **Noise Layer:** Synthesized or sampled noise for "air" and sustain.
- **Phase Alignment:** Automatic phase alignment between the Sub-oscillator and the Sample layers to prevent cancellation.

### C. Advanced Modulation (Bezier System)
- **Curves:** 4-node Bezier curves for Amplitude and Pitch.
- **Calculation:** Pre-calculated lookup tables (LUT) for CPU efficiency during playback.
- **Resolution:** 128-bit precision for smooth, zipper-free sweeps.

## 3. Intelligent DSP Features
### Intelligent EQ (The "Mud-Killer")
- **Mechanism:** A dynamic notch filter that follows the fundamental frequency of the Sub-oscillator.
- **Action:** Automatically applies a -3dB to -6dB dip in the 150Hz - 300Hz range relative to the pitch to ensure clarity in the mix.

### Export System
- **Offline Render:** High-quality 32-bit float rendering.
- **Drag & Drop:** File-backed buffer that allows the user to drag the rendered WAV directly from the UI into a DAW.

## 4. UI/UX Architecture
### Frontend (Electron/React)
- **Theme:** "Pro Studio" (Dark Navy: #0A0F1E, Cyan: #00F2FF).
- **Visualization:** Real-time WebGL-based waveform and spectrum analyzer.
- **Communication:** Communication with the JUCE core via a custom **IPC Bridge** (either WebSocket or Shared Memory).

### AI Generator ("Surprise Me")
- **Keywords:** Thump, Industrial, Tight, Deep, Aggressive.
- **Implementation:** A heuristic-based mapping system that translates keywords into preset parameter ranges, combined with a local lightweight neural network for timbre selection.

## 5. Project Roadmap
- **Phase 1:** Core DSP synthesis and Bezier envelope implementation.
- **Phase 2:** Sampler integration and basic UI layout.
- **Phase 3:** Intelligent EQ and IPC Bridge development.
- **Phase 4:** AI Generator and WAV Export.
