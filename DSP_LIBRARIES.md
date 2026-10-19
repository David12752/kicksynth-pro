# KickSynth Pro — DSP Libraries Research

_Date: 2026-03-27_

## Goal
Identify the best **license-safe** DSP building blocks for:
- Reverb
- Compressor
- Chorus / Flanger
- Distortion / Waveshaper
- Delay

The brief asked for **MIT / Apache** options. During verification, a few popular candidates turned out to be **permissive but not MIT/Apache** (BSD / ISC), and JUCE turned out to be **not permissive** at all.

So below I split recommendations into:
1. **Best fit for this project**
2. **Verified license status**
3. **Practical recommendation for KickSynth Pro**

---

## Executive summary

### Best practical stack for KickSynth Pro
If the goal is **fastest safe implementation with clean licensing awareness**:

- **Delay / modulation / quick prototyping:** **Maximilian (MIT)**
- **Filters / EQ / crossovers / utility DSP:** **DSPFilters (MIT)**
- **Modern delay + supporting DSP primitives:** **Signalsmith DSP (MIT)**
- **Reference / experimental DSP language ideas:** **SOUL source (ISC)**
- **Already in project, but not permissive for reuse:** **JUCE DSP module**
- **Very strong option if BSD is acceptable:** **Gin (BSD-3-Clause)**

### Recommended policy decision
For a clean commercial path:
- Treat **MIT / Apache / BSD / ISC** as acceptable permissive source dependencies _if approved internally_
- Do **not** treat JUCE as a general permissive DSP source library outside the existing JUCE-based app structure

---

# License verification table

| Library | License status | Verified result | Use? |
|---|---:|---|---|
| **JUCE Framework / JUCE DSP** | ❌ Not MIT/Apache | Dual-licensed **AGPLv3 + commercial JUCE license** | Use only because the project already depends on JUCE; not a permissive add-on source library |
| **Gin** | ⚠️ Not MIT/Apache, but permissive | **BSD-3-Clause** | Very good if BSD is acceptable |
| **SOUL source** | ⚠️ Not MIT/Apache, but permissive source | **ISC** for source; binary toolkit has additional commercial terms | Good as reference / source-level algorithms, not my first drop-in recommendation |
| **DSPFilters** | ✅ MIT | README explicitly states **MIT license** | Good for filters / EQ / crossover duties |
| **Maximilian** | ✅ MIT | GitHub API reports **MIT License** | Good for effects prototyping and musical DSP |
| **Signalsmith DSP** | ✅ MIT | Project docs explicitly say **MIT licensed** | Strong modern supporting DSP library |

---

# Per-library notes

## 1) JUCE DSP module

### License
- **Not MIT/Apache**
- JUCE framework is dual licensed under **AGPLv3** and the **commercial JUCE licence**

### Strengths
- Already present in the project
- Good standard blocks: filters, convolution, FFT, oversampling, dynamics helpers
- Tight integration with existing JUCE plugin/app code

### Weaknesses
- Not permissive in the MIT/Apache sense
- Not something I would recommend as a standalone “free to embed anywhere” dependency

### Verdict
**Use inside this project where JUCE is already part of the stack, but do not count it as the answer to the MIT/Apache requirement.**

---

## 2) Gin (Roland Rabien)

### License
- **BSD-3-Clause**
- Not MIT/Apache, but still permissive and commercially friendly

### Strengths
- Rich JUCE-oriented ecosystem
- Includes DSP, modulation, synth UI, plugin utilities
- Especially attractive for faster premium-plugin development

### Weaknesses
- More framework-y than minimal
- Brings opinions and structure, not just tiny isolated DSP blocks

### Verdict
If BSD is acceptable, **Gin is one of the best real-world accelerators** for shipping a premium music tool. If you want strict MIT/Apache only, it does not qualify.

---

## 3) SOUL

### License
- Source files in repo: **ISC**
- Binary toolkit / downloadable pieces may introduce extra terms

### Strengths
- Modern audio-language approach
- Excellent for understanding DSP building blocks and experimenting quickly
- Good educational/reference value

### Weaknesses
- Not the easiest “drop in C++ effect library” answer
- Binary/tooling situation is more nuanced than a plain MIT repo

### Verdict
**Best used as inspiration, reference code, or source-level algorithm study**, not as the primary low-friction dependency for this app.

---

## 4) DSPFilters (Vinnie Falco)

### License
- README explicitly states **MIT License**

### Strengths
- Excellent for:
  - biquads
  - EQ bands
  - shelves
  - band filters
  - crossover-style tasks
- Runtime-friendly filter design patterns
- Great foundation for 4-band EQ / tone stages

### Weaknesses
- Not a broad effects suite
- No headline reverb / chorus UI-level abstractions

### Verdict
**Keep this in the shortlist for EQ / filter infrastructure.**

---

## 5) Maximilian

### License
- **MIT License**

### Strengths
- Broad musical DSP toolbox
- Includes:
  - delay
  - distortion
  - chorus
  - flanging
  - oscillators
  - filters
  - sample playback
- Great for fast prototyping and getting musical results quickly

### Weaknesses
- More “creative coding / broad DSP playground” than surgical, enterprise-style DSP package
- You may still want your own wrapper / refinement layer for production polish

### Verdict
**Best MIT option for getting multiple musical effects working fast.**

---

## 6) Signalsmith DSP

### License
- **MIT License**

### Strengths
- Modern header-only DSP support library
- Strong for delay-related infrastructure and precise support utilities
- Clean architecture and modern C++ style
- Good fit for a refined, lightweight implementation stack

### Weaknesses
- Less of a “kitchen sink multi-effect plugin toolkit” than Maximilian or Gin
- You still assemble the final effect architecture yourself

### Verdict
**Excellent MIT companion library**, especially for delay/support DSP and clean implementation patterns.

---

# Best choices by effect type

## 1) Reverb — best free algorithmic reverb

### Best permissive answer
**If BSD is allowed:** **Gin**
- Fastest route inside a JUCE ecosystem
- Good chance of higher-quality ready-made result with less glue code

### Best strict-MIT answer
**Build your own lightweight Schroeder / Freeverb-style reverb**, supported by:
- **Signalsmith DSP (MIT)** for helper DSP infrastructure
- **DSPFilters (MIT)** for damping / tone filters if needed

### Why
Strict MIT/Apache options are weaker for “drop-in premium algorithmic reverb” than for filters/modulation/delay. For KickSynth Pro specifically, a custom algorithmic reverb tuned for short drum tails is actually preferable to a huge generic hall.

### Recommendation for this project
Because kicks need short, controlled ambience rather than lush cinematic tails:
- **Renderer-side generated IR / algorithmic short reverb is the right call**
- Keep it purpose-built and lightweight
- Don’t over-engineer this with a giant external dependency

---

## 2) Compressor — transparent peak / RMS compressor

### Best strict-MIT path
- **Roll your own compressor core** (easy to own, easy to tune)
- Use **Signalsmith DSP (MIT)** and/or **DSPFilters (MIT)** where helpful around the detector path

### Alternate practical path
- If BSD is acceptable, evaluate **Gin DSP** components
- If staying inside existing stack, JUCE DSP can help, but again: **not permissive license**

### Recommendation
For a kick tool, I would **not** bring in a large dependency just for compression. Write a compact compressor yourself:
- peak + RMS detector
- attack / release smoothing
- soft knee optional
- dry/wet mix
- makeup gain

That gives better product control than outsourcing the core character.

---

## 3) Chorus / Flanger — modulation effects

### Best MIT choice
**Maximilian (MIT)**
- Explicitly includes chorus and flanging
- Fast path to a working musical result

### Strong companion
**Signalsmith DSP (MIT)**
- Good support for delay-line infrastructure and clean implementation patterns

### Recommendation
If you later expand KickSynth Pro beyond essential kick shaping, use:
- **Maximilian** for fast proof-of-concept
- then replace / refine with your own tuned modulation code if needed

For the current kick-focused product, chorus/flanger are lower priority than compressor / distortion / delay / reverb.

---

## 4) Distortion / Waveshaper — musical waveshaping

### Best MIT choice
**Maximilian (MIT)**
- Already includes distortion effects
- Good fast-musical sandbox

### Project recommendation
For KickSynth Pro, a **custom waveshaper** is better than a heavyweight dependency because:
- kick distortion needs very specific transient behavior
- asymmetry, pre/post tone, and mix matter more than library breadth
- the current renderer-side wave shaper approach is already sensible

### Best path
- Keep the custom waveshaper core
- Use **DSPFilters** for pre/post tone shaping if needed
- Use Maximilian only if you want alternative distortion voicings fast

---

## 5) Delay — sync-able stereo delay

### Best MIT choice
**Signalsmith DSP (MIT)** + **Maximilian (MIT)**

Why this combo:
- Signalsmith gives clean modern support patterns
- Maximilian gives fast musical delay / modulation prototyping

### Recommendation
For KickSynth Pro, the delay needs are simple and drum-oriented:
- tempo sync
- feedback
- stereo width / crossfeed
- damping / tone
- dry/wet

This is a good case for **your own compact implementation**, possibly borrowing support ideas from Signalsmith.

---

# Final recommendations by priority

## Tier A — best immediate value

### 1. **Maximilian (MIT)**
Use for:
- chorus / flanger research
- distortion alternatives
- delay prototyping
- quick musical proof-of-concepts

### 2. **DSPFilters (MIT)**
Use for:
- EQ section
- damping filters
- tone shaping around distortion / delay / reverb
- crossovers / utility filter work

### 3. **Signalsmith DSP (MIT)**
Use for:
- modern support DSP
- delay infrastructure
- utility math / signal helpers
- clean C++ implementation reference

---

## Tier B — useful but with caveats

### 4. **Gin (BSD-3-Clause)**
Use if your license policy allows BSD.
This is arguably the strongest “ship fast in JUCE” option, but it does **not** satisfy a strict MIT/Apache-only rule.

### 5. **SOUL (ISC source)**
Use as:
- algorithm reference
- experimentation tool
- educational source

Not my first recommendation as the main production dependency here.

---

## Tier C — already present but not a permissive dependency answer

### 6. **JUCE DSP module**
Use only because the app is already JUCE-based.
Do **not** treat it as the solution to the permissive-license research requirement.

---

# Recommended implementation strategy for KickSynth Pro

## Short version
For this product, I would **not** over-import libraries.

### Best architecture
- **Compressor:** custom implementation
- **Distortion:** custom waveshaper + filter support
- **Reverb:** custom short drum reverb / generated IR
- **Delay:** custom stereo delay
- **EQ / tone filters:** DSPFilters or your own biquads
- **Future modulation effects:** Maximilian or Signalsmith-assisted custom code

## Why
KickSynth Pro is not a general-purpose multi-FX rack.
It is a focused kick designer. That means:
- fewer algorithms
- tighter tuning
- better UX
- easier future maintenance

A small number of tuned, owned DSP blocks beats a giant dependency pile here.

---

# Bottom line

If you want the clearest answer:

## Best strict-MIT/near-MIT toolkit shortlist
1. **Maximilian** — MIT
2. **DSPFilters** — MIT
3. **Signalsmith DSP** — MIT
4. **SOUL source** — ISC (permissive, but not MIT/Apache)
5. **Gin** — BSD-3-Clause (excellent, but not MIT/Apache)
6. **JUCE DSP** — AGPL/commercial, not permissive

## Best product decision
For KickSynth Pro specifically:
- use **custom DSP for the core effects**
- optionally use **DSPFilters / Signalsmith / Maximilian** as targeted helpers
- avoid depending on JUCE DSP or Gin for license-critical “portable permissive source” claims
