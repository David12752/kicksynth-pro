# KickSynth Pro — UI/UX & DSP Architecture Blueprint

> Version 1.0 · March 2026 · Confidential Product Document

---

## Executive Summary

KickSynth Pro has solid bones — a 3-column layout with sub oscillator, central display, and sample layers. But the current state reads as a developer prototype, not a product producers would pay $79–$149 for. This blueprint transforms it into a premium instrument by:

1. Replacing the passive central display with an **interactive Master Display** — a real-time, draggable pitch/amp envelope + phase correlation meter
2. Introducing a **Global ↔ Detail** layer workflow that eliminates mode-hunting
3. Filling dead zones with **kick-specific pro parameters** (click designer, transient shaper, harmonic saturation, phase rotation)
4. Applying a **cohesive dark-mode aesthetic** at FabFilter/Arturia quality
5. Adding **3 workflow accelerators** that make producers faster than any competing kick synth

The goal: a plugin that feels like an instrument, not a panel of knobs.

---

## Before vs After

### Before (Current State)
| Area | Issue |
|---|---|
| Central display | Static waveform viewer — no interaction, no parameter coupling, wasted screen real estate |
| Sample layers (right column) | Flat list with basic controls; no visual feedback on how layers stack; no phase relationship visibility |
| Sub oscillator (left/center) | Functional but generic — could be any synth's oscillator section; no kick-specific character controls |
| Dead zones | Large areas of the UI that don't respond to interaction or show useful information; generic spacing filler |
| Knobs/controls | Uniform style with no visual hierarchy — critical parameters look identical to tertiary ones |
| Overall feel | "Someone's JUCE tutorial project" — technically works, visually forgettable |

### After (Target State)
| Area | Transformation |
|---|---|
| Central display | **Master Display**: interactive pitch envelope (draggable nodes), amp envelope overlay, real-time phase correlation meter, frequency spectrum ghost — the nerve center of the plugin |
| Sample layers | **Layer Cards** with inline waveform, solo/mute/phase/polarity buttons, click-to-expand detail view, visual volume relationship bars |
| Sub oscillator | **Sub Engine** panel with harmonic series visualization, saturation drive, tuning display with note name, dedicated "Click Designer" sub-module |
| Dead zones | Replaced with: Transient Shaper, Punch/Body/Air macro strip, Output section with mono maker + low-end focus |
| Knobs/controls | 3-tier visual hierarchy: primary (lit ring + glow), secondary (matte ring), tertiary (minimal dot indicator) |
| Overall feel | "I need to buy this" — dark, precise, alive with subtle animation, every pixel intentional |

---

## Master Display Design

The central display is the product's identity. It must be interactive, informative, and visually striking.

### Layout: 3 Stacked Regions

```
┌─────────────────────────────────────────────┐
│  PITCH ENVELOPE (top 45%)                   │
│  ┌───────────────────────────────────────┐  │
│  │  ●────────●                           │  │
│  │           \                           │  │
│  │            ●──────────────────●       │  │
│  │  start    decay    hold       end     │  │
│  └───────────────────────────────────────┘  │
│  AMP ENVELOPE (middle 35%)                  │
│  ┌───────────────────────────────────────┐  │
│  │  ╱╲                                   │  │
│  │ ╱  ╲───────╲                          │  │
│  │╱           ╲──────                    │  │
│  │ A   D    S       R                    │  │
│  └───────────────────────────────────────┘  │
│  PHASE + METERS (bottom 20%)                │
│  ┌───────────────────────────────────────┐  │
│  │  [SUB ◄──●──► S1] [S1◄──●──►S2] ... │  │
│  │  Phase Correlation: ████████░░  0.87  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Pitch Envelope — Interactive Graph

**Purpose:** The pitch envelope IS the kick. This is where producers sculpt the "boom" vs "thud" vs "808 dive." It must be the most satisfying interaction in the entire plugin.

**Nodes (4 draggable points):**
| Node | X-axis | Y-axis | Color | Behavior |
|---|---|---|---|---|
| **Start Pitch** | Fixed at x=0 | 20 Hz – 5 kHz (log scale) | Bright cyan `#00E5FF` | Vertical drag only. Snap to note values when Shift held. Tooltip shows note name + Hz |
| **Decay Point** | 1–200 ms from start | Same pitch range | Cyan, slightly dimmer | Free drag both axes. This is the "bend" — the most important node. Dragging right = longer attack transient |
| **Hold Point** | 1–500 ms from decay | Same pitch range | Teal `#00BFA5` | Horizontal drag = sustain duration. Vertical = sustain pitch. For 808s, this is where you set the body note |
| **End Pitch** | Fixed at envelope end | Same range | Dim teal | Vertical drag. Usually sits at the fundamental (40-60 Hz). Shows note name always |

**Curve Behavior:**
- Segments between nodes use **adjustable curve tension** — hover the segment, a ghost handle appears at midpoint, drag up/down for convex/concave. This replaces a separate "curve" knob.
- Exponential curves glow brighter at steep sections (visual velocity cue)
- The area under the pitch curve fills with a subtle gradient: cyan→teal, 8% opacity — makes the "size" of the pitch sweep visually apparent

**Parameter Coupling:**
- Dragging Start Pitch automatically adjusts the "Click" character (higher start = more click)
- Dragging Hold Point vertical couples to the Sub Oscillator tuning display — both show the same note
- When the pitch envelope end note ≠ sub oscillator tuning, a **red warning dot** appears between them (phase will be messy)

**Feel:**
- 60fps minimum redraw on drag
- Nodes have 12px hit targets with 20px hover expansion
- Magnetic snap to semitones (subtle tick), override with Ctrl for free pitch
- Double-click any node → type exact value (Hz or note name like "E1")
- Right-click node → reset to default

### Amp Envelope — Overlay Graph

**Rendered as a filled shape** behind/below the pitch envelope (10% opacity white fill, bright white edge line).

**Nodes:** Attack, Decay, Sustain level, Release — standard ADSR but with kick-optimized ranges:
- Attack: 0–5 ms (kicks need sub-ms precision here)
- Decay: 5–2000 ms
- Sustain: 0–100% (usually 0 for one-shot kicks, nonzero for 808 sustain)
- Release: 10–5000 ms

**Visual distinction:** Amp envelope line is **white with 60% opacity**, thinner (1.5px vs pitch's 2.5px). Nodes are smaller circles (8px vs pitch's 12px). This creates clear visual hierarchy: pitch is primary, amp is secondary.

**Interaction:** Same drag behavior as pitch. When both envelopes are visible, the one you last touched is "focused" (full opacity), the other dims to 40%.

### Phase Correlation Meter

**Bottom strip of the Master Display.** This is the "secret weapon" — no other kick synth shows this.

**Layout:** Horizontal bar for each layer pair:
- `SUB ↔ Sample1` 
- `SUB ↔ Sample2`
- `SUB ↔ Sample3`
- `Sample1 ↔ Sample2` (only if both active)

**Meter behavior:**
- Bar fills from center: left = out of phase (bad), right = in phase (good)
- Color: red (`#FF1744`) at -1.0 → yellow at 0 → green (`#00E676`) at +1.0
- Numeric readout on right: `-1.00` to `+1.00`
- When phase drops below 0.5, the meter **pulses subtly** — "hey, check your phase"

**Why this matters:** 90% of amateur kick layering sounds thin because of phase cancellation. Making it visible = making it fixable. This is the feature that makes forum posts.

### Display Mode Tabs

Small tabs at top-right of Master Display: `PITCH` · `AMP` · `BOTH` · `SPECTRUM`

- **PITCH**: Pitch envelope full size, amp envelope as thin ghost line
- **AMP**: Amp envelope full size, pitch as ghost
- **BOTH**: Split view as described above
- **SPECTRUM**: Real-time FFT of the mixed output — standard analyzer with kick-relevant bands highlighted (sub 20-60, fundamental 60-120, body 120-300, punch 2-5k, click 5-10k)

---

## Layering Workflow (Global vs Detail)

### The Problem

Current layout shows all 3 sample layers simultaneously with full controls visible. This means:
- Each layer gets cramped space
- Producer can't focus on one layer without visual noise from others
- No quick overview of how layers relate to each other
- Phase/timing relationships invisible

### The Solution: Two Modes

#### Global Layer View (Default)

The right column shows all layers as **compact cards**, stacked vertically:

```
┌─────────────────────────┐
│ SUB ENGINE          ▼   │
│ E1 · Sine+Sat · ████░░ │
│ [S] [M] [Ø] [◄►]       │
├─────────────────────────┤
│ SAMPLE 1 — "Kick_Top"▼ │
│ ~~waveform~~ · ████░░░ │  
│ [S] [M] [Ø] [◄►] [✂]  │
├─────────────────────────┤
│ SAMPLE 2 — "808_Sub" ▼ │
│ ~~waveform~~ · ███░░░░ │
│ [S] [M] [Ø] [◄►] [✂]  │
├─────────────────────────┤
│ SAMPLE 3 — (empty)   ▼ │
│ [ + Drop Sample Here ]  │
│                         │
├─────────────────────────┤
│ ═══ MASTER MIX ═══     │
│ ████████████░░ -2.1 dB  │
│ [MONO < 120Hz] [EXPORT] │
└─────────────────────────┘
```

**Each card shows:**
- Layer name / sample name (editable inline)
- Mini waveform (48px tall) — shows the sample with current trim/start points as dim markers
- Volume bar (horizontal, compact) — drag to set level
- **S** = Solo (yellow when active, exclusive by default, Ctrl+click for multi-solo)
- **M** = Mute (red when active)
- **Ø** = Phase invert (toggles polarity, orange when active)
- **◄►** = Micro-shift (±5ms sample delay) — click opens a tiny horizontal slider overlay
- **✂** = Trim (click opens trim handles on the mini waveform)
- **▼** = Expand to Detail View

**Visual relationships in Global View:**
- Volume bars are **aligned horizontally** across all cards — you can see relative levels at a glance
- Active phase issues show as a **thin red line** between the two conflicting cards
- Drag-and-drop reordering of layers (changes processing order)

#### Detail View (Per Layer)

Click ▼ or double-click a layer card → it **expands to fill the entire right column** (other layers collapse to tiny 24px headers showing just name + S/M buttons).

**Detail view contains:**

**For Sub Engine:**
- Waveform selector: Sine / Triangle / Saw / Noise + blend knob between adjacent shapes
- Harmonic series display: vertical bars showing harmonics 1-8 with individual level control
- Saturation section: Drive knob + character selector (Tape / Tube / Digital / Fuzz)
- Tuning: Large note display + fine tune ±100 cents + octave selector
- Click Designer (sub-module, see Pro Parameters below)

**For Sample Layers:**
- Large waveform display (200px tall) with:
  - Draggable start/end markers (trim)
  - Draggable fade-in/fade-out curves
  - Transient marker (auto-detected, adjustable)
  - Loop region markers (for sustained kicks)
- Pitch controls: semitone ±24, fine ±100 cents, key-tracking on/off
- Filter: LP/HP/BP with frequency + resonance knobs, envelope amount
- Individual amp envelope: ADSR knobs below the waveform
- Sample browser button → opens file browser overlay

**Navigation:** `Esc` or clicking collapsed layer header returns to Global View. Arrow keys cycle between layer detail views.

### Audition Behavior

- **Spacebar** always triggers the full mixed kick (all unmuted layers)
- **Alt+Click** on any layer card = audition that layer solo (temporary, doesn't change solo state)
- **MIDI input** triggers full kick; detail view shows that layer's isolated contribution as a ghost waveform overlay

---

## Pro Parameters & Module Map

### 1. Click Designer

**What:** A dedicated module for sculpting the initial transient "click" of a kick — the 0-5ms attack spike that cuts through a mix.

**Why it matters:** The click is what makes a kick audible on laptop speakers and in dense mixes. Currently, producers fake this by layering a separate click sample. Build it in.

**Parameters:**
- **Click Type**: Noise burst / Sine chirp / Impulse / Sample (dropdown)
- **Frequency**: 2 kHz – 15 kHz (for sine chirp mode)
- **Duration**: 0.1 – 5 ms
- **Level**: -inf to +6 dB relative to main body
- **Tone**: LP filter on the click, 1–20 kHz

**Where in UI:** Sub-panel inside Sub Engine detail view, below the harmonic series display. Collapsible. Header shows a tiny transient icon.

**Visual feedback:** In the Master Display, the click region (first 5ms) gets a **highlighted zone** with a distinct orange tint, showing the click's amplitude and frequency content as a mini spectrogram stripe.

### 2. Transient Shaper

**What:** Attack/sustain transient processor on the mixed output.

**Why it matters:** Controls punch independent of envelope settings. The difference between a kick that "hits" and one that "thuds."

**Parameters:**
- **Attack**: ±12 dB (boost/cut the transient)
- **Sustain**: ±12 dB (boost/cut the body/tail)
- **Detection**: Fast / Medium / Slow (sets the transient detection window)

**Where in UI:** Output section (bottom of center column, below Master Display). Two large knobs side by side with a small detection toggle between them.

**Visual feedback:** Master Display waveform shows a **dynamic overlay** — transient-detected region highlighted in orange, sustain region in blue. As you turn Attack up, the orange region visually "swells."

### 3. Harmonic Saturation

**What:** Adds harmonics to the sub oscillator to make it audible on small speakers without raising fundamental level.

**Why it matters:** A pure sine sub at 40Hz is inaudible on earbuds/laptops. Saturation adds the 80Hz, 120Hz, 160Hz harmonics that the brain uses to "reconstruct" the fundamental. Essential for modern production.

**Parameters:**
- **Drive**: 0–100% 
- **Character**: Tape (soft, warm, even harmonics) / Tube (odd harmonics, more aggressive) / Digital (hard clip, maximum presence) / Fuzz (broken speaker, lo-fi)
- **Mix**: 0–100% wet/dry
- **HP on Wet**: 60–500 Hz (prevents saturation from muddying the sub — crucial, most saturators don't have this)

**Where in UI:** Inside Sub Engine detail view, dedicated "SATURATION" panel with Drive as a large knob, Character as a 4-way selector with icons, Mix and HP as smaller knobs.

**Visual feedback:** The harmonic series display (vertical bars) **reacts in real-time** to saturation — you literally see harmonics appear and grow as you turn Drive up. Color shifts from teal (clean) to warm orange (saturated).

### 4. Phase Rotation

**What:** Continuous 0–360° phase rotation per layer.

**Why it matters:** When layering sub + samples, polarity flip (0°/180°) is too coarse. Continuous phase rotation lets you find the exact alignment where layers reinforce rather than cancel. The difference between a kick that shakes the room and one that sounds hollow.

**Parameters:**
- **Rotation**: 0–360° (continuous knob)
- **Frequency Focus**: 20–500 Hz (the frequency band where phase rotation is most aggressive — above this, it tapers off)

**Where in UI:** Each layer card (Global View) gets the existing **Ø** button upgraded: short press = polarity flip, **long press (300ms)** = opens a phase rotation popup with the continuous knob + frequency focus. In Detail View, it's always visible as a dedicated knob.

**Visual feedback:** The Phase Correlation meter in Master Display updates in real-time as you rotate. A **circular phase indicator** next to each layer's Ø button shows current rotation angle as a small radial gauge (like a compass).

### 5. Punch / Body / Air Macro Strip

**What:** Three-band "character" strip — macro controls that affect multiple parameters simultaneously.

**Why it matters:** Producers think in terms of "more punch" or "more body," not "increase 3kHz by 2dB and boost transient attack by 1.5dB." Macros bridge that gap.

**Parameters:**
- **Punch** (2–5 kHz emphasis + transient attack boost): -100% to +100%
- **Body** (80–300 Hz level + sustain adjustment): -100% to +100%
- **Air** (8–16 kHz shelf + subtle harmonic excitement): -100% to +100%

**Where in UI:** **Horizontal strip between Master Display and Output section** — three large, prominent sliders (not knobs) with clear labels. This is the "quick sculpt" zone. Prime real estate.

**Visual feedback:** Each slider has a **colored fill**: Punch = orange, Body = warm red, Air = light blue. The Master Display spectrum view (when active) shows corresponding frequency bands glow as you adjust. Band regions are subtly tinted to match.

### 6. Sample Alignment Tools

**What:** Micro-timing tools for precise sample alignment.

**Parameters:**
- **Micro-Shift**: ±5 ms per layer (0.01ms resolution)
- **Auto-Align**: One-click phase-optimal alignment (analyzes cross-correlation, finds best offset)
- **Polarity**: Normal / Inverted per layer
- **Mono Maker**: Frequency below which signal is summed to mono (20–500 Hz, default 120 Hz)
- **Low-End Focus**: Gentle LP tilt EQ that emphasizes fundamentals without adding mud (shelf at configurable frequency, ±6dB)

**Where in UI:**
- Micro-Shift + Polarity: Layer cards (Global View) via ◄► and Ø buttons
- Auto-Align: Button in the Phase Correlation meter strip — click it, it runs, shows before/after correlation values
- Mono Maker + Low-End Focus: Output section, bottom of right column in the Master Mix area

**Visual feedback:** 
- Auto-Align shows a brief animation: layers "slide" into alignment in the waveform view
- Mono Maker shows a vertical frequency line on the spectrum view marking the mono threshold
- Low-End Focus shows the EQ curve overlaid on spectrum

---

## Style Guide

### Color Palette

| Role | Color | Hex | Usage |
|---|---|---|---|
| Background (deepest) | Near-black | `#0D0D0F` | Main panel background |
| Background (panels) | Dark charcoal | `#161619` | Module panels, cards |
| Background (elevated) | Charcoal | `#1E1E22` | Hover states, active panels |
| Primary accent | Electric cyan | `#00E5FF` | Primary interactive elements, pitch envelope, active states |
| Secondary accent | Teal | `#00BFA5` | Secondary info, hold points, linked parameters |
| Warning/Phase | Orange | `#FF9100` | Phase issues, saturation indicators, transient regions |
| Danger/Cancel | Red | `#FF1744` | Phase cancellation, clipping, destructive actions |
| Positive | Green | `#00E676` | Phase correlation good, headroom OK |
| Text primary | Off-white | `#E8E8EC` | Labels, values |
| Text secondary | Medium gray | `#8888A0` | Descriptions, inactive labels |
| Text tertiary | Dim gray | `#555566` | Placeholder text, disabled states |

### Typography

- **Primary font:** `Inter` — clean, technical, excellent at small sizes. Available as variable font for precise weight control.
- **Display values** (Hz, dB, ms): `JetBrains Mono` — monospace for numeric alignment, slightly techy without being cold
- **Hierarchy:**
  - Module titles: Inter SemiBold 11px, all-caps, letter-spacing +1.5px, `#8888A0`
  - Parameter labels: Inter Medium 10px, `#8888A0`
  - Parameter values: JetBrains Mono Regular 11px, `#E8E8EC`
  - Section headers: Inter Bold 13px, `#E8E8EC`
  - Plugin name (top bar): Inter Black 16px, letter-spacing +3px, `#00E5FF`

### Knob Style: Flat-Modern with Depth Cue

No skeuomorphic 3D knobs. No flat circles either. **The "lit arc" style:**

- Circular knob with a **dark matte fill** (`#1E1E22`)
- Thin **outer ring** (1px, `#333340`)
- **Value arc** traces from 7 o'clock to current position, using the parameter's accent color at 80% opacity
- **Indicator dot** at current position: 4px circle, accent color, 100% opacity with subtle glow (4px blur)
- On hover: outer ring brightens to `#555566`, value arc to 100% opacity
- On drag: glow radius doubles, value readout appears above knob
- **Three sizes:**
  - Large (40px): Primary parameters (Drive, main tuning, Attack/Sustain on transient shaper)
  - Medium (32px): Standard parameters (filter freq, envelope times)
  - Small (24px): Secondary parameters (fine tune, mix knobs)

### Glow Philosophy

Glow is information, not decoration.

- **Active/focused elements** get a subtle outer glow (8px blur, accent color at 15% opacity)
- **Playing/audio-active** indicators pulse glow at note-on rate (not constant)
- **Warnings** (phase issues, clipping) use pulsing glow (orange or red, 20% opacity, 1Hz pulse)
- **Nothing glows by default.** Only interactive or state-communicating elements.
- Max 3 glowing elements visible at any time — if more would glow, only the most important wins

### Panel Materials

- Main background: solid `#0D0D0F`, no texture
- Module panels: solid `#161619` with 1px border `#222230`, border-radius 6px
- Elevated panels (popups, detail view): `#1E1E22` with 1px border `#333340`, subtle drop shadow (0 4px 16px rgba(0,0,0,0.5))
- **No gradients on panels.** Flatness = modernity. Save gradients for meters and envelope fills only.
- Subtle **1px top highlight** on panels (`#ffffff08`) to simulate top-lit edge — the only concession to depth

### Frequency Color Coding

Consistent across all displays (spectrum, EQ, band indicators):

| Band | Range | Color |
|---|---|---|
| Sub | 20–60 Hz | Deep blue `#2962FF` |
| Fundamental | 60–120 Hz | Cyan `#00E5FF` |
| Body | 120–300 Hz | Teal `#00BFA5` |
| Midrange | 300–2 kHz | Warm white `#FFF3E0` |
| Punch/Presence | 2–5 kHz | Orange `#FF9100` |
| Click/Air | 5–20 kHz | Light amber `#FFD54F` |

### Meter Colors

- **Level meters:** Green (`#00E676`) → Yellow (`#FFD600`) at -6dB → Red (`#FF1744`) at -1dB → Bright red + pulse at 0dB
- **Phase correlation:** Red (-1) → Yellow (0) → Green (+1) — continuous gradient
- **Reduction meters** (if compression added later): Amber (`#FF9100`), fills from right to left

### Spacing Rhythm

Base unit: **4px.** All spacing is multiples of 4.

- Knob-to-knob: 16px
- Knob-to-label: 4px
- Module internal padding: 12px
- Module-to-module gap: 8px
- Section separators: 1px line `#222230` with 16px vertical margin
- Column gaps: 12px

### Shadows / Highlights

- Drop shadows only on elevated elements (popups, expanded detail views): `0 4px 16px rgba(0,0,0,0.5)`
- Knobs: no box shadow, depth comes from the lit arc
- Buttons: 1px inset shadow on press (`inset 0 1px 2px rgba(0,0,0,0.3)`)
- Master Display: subtle inner shadow on all four edges (`inset 0 0 12px rgba(0,0,0,0.3)`) — creates "recessed screen" feel

---

## UX Workflow Hacks

### 1. Auto-Tune to Key — One-Click Pitch Lock

**The feature:** A "KEY" button in the top bar. Click → opens a dropdown: note selector (C through B) + scale type (Major/Minor/Chromatic). Once set:
- Sub oscillator snaps to the nearest note in that key
- Pitch envelope hold/end points snap to scale degrees
- All tuning knobs show **note names relative to the key** (root, 5th, octave below, etc.)
- Importing a project via DAW host API auto-detects key if the DAW provides it

**Why producers pay for this:** Every kick needs to be in key with the track. Currently this means opening a tuner, calculating, adjusting. This makes it instant. Especially valuable for 808-style kicks where the sustained pitch must be musical.

**Implementation:** Top bar, right of plugin name. Small button reading `KEY: --` when unset, `KEY: E min` when active. Cyan text when active. Dropdown is a 2-row grid: top row = note buttons (C C# D ... B), bottom row = scale type toggle.

### 2. Drag-and-Drop WAV Export

**The feature:** A **drag handle icon** in the Output section (bottom-right). Click-and-drag it directly into your DAW arrangement, file browser, or desktop.

**Behavior:**
- Renders the current kick as a one-shot WAV (44.1kHz/24-bit by default)
- Render includes all processing (saturation, transient shaping, mono maker)
- Hold **Shift** while dragging = renders at project sample rate
- Hold **Alt** while dragging = renders each layer as a separate file (multi-file drop)
- File auto-named: `KickSynth_[key]_[bpm]_[timestamp].wav`
- A small render progress appears (usually instant for one-shot kicks <2s)

**Why producers pay for this:** Eliminates the bounce→find file→import loop. Producers can A/B dozens of kick variations by just dragging them into arrangement lanes. This is the feature they'll tweet about.

### 3. Section Randomize with Lock

**The feature:** Each module section (Sub Engine, Click Designer, Sample layers, Transient Shaper, Punch/Body/Air) has a tiny **dice icon** (🎲) in its header. Click = randomize that section's parameters within musical ranges. **But**: any parameter with a **lock icon** (🔒, toggled by right-click on any knob) stays fixed.

**Typical workflow:**
1. Dial in the perfect sub tuning and pitch envelope → lock those
2. Hit dice on Sample layers → cycles through presets/random settings
3. Hit dice on Click Designer → varies the transient character
4. Hit dice on Saturation → finds new harmonic flavors
5. When you find something close, fine-tune manually

**Additional:** A **Global Dice** button at top = randomizes ALL unlocked sections simultaneously. Next to it, **←** undo and **→** redo buttons specifically for randomization history (separate from DAW undo). You can scroll through 50 random variations and pick the best.

**Why producers pay for this:** Creative exploration at zero friction. The lock system means you never lose what's working. Producers discover sounds they'd never dial in manually. This is how "happy accidents" happen on demand.

---

## DSP Architecture Notes

### Signal Flow

```
┌──────────┐     ┌──────────┐
│ Sub Osc  │     │ Click    │
│ + Sat    │     │ Designer │
└────┬─────┘     └────┬─────┘
     │                │
     └──────┬─────────┘
            │ Mix
     ┌──────▼──────┐
     │  Sub Bus    │ ← Phase Rotation (sub)
     └──────┬──────┘
            │
     ┌──────▼──────────────────────────┐
     │        Layer Mixer              │
     │  Sub Bus + Sample1 + Sample2    │
     │  + Sample3                      │
     │  (each with: gain, phase rot,   │
     │   micro-shift, polarity)        │
     └──────┬──────────────────────────┘
            │
     ┌──────▼──────┐
     │  Transient  │
     │  Shaper     │
     └──────┬──────┘
            │
     ┌──────▼──────┐
     │ Punch/Body  │
     │ /Air EQ     │
     └──────┬──────┘
            │
     ┌──────▼──────┐
     │  Mono Maker │
     │  (< freq)   │
     └──────┬──────┘
            │
     ┌──────▼──────┐
     │  Low-End    │
     │  Focus      │
     └──────┬──────┘
            │
     ┌──────▼──────┐
     │  Output     │
     │  Limiter    │
     │  + Gain     │
     └──────┬──────┘
            │
            ▼ OUT
```

### Key DSP Considerations

1. **Pitch envelope resolution:** Interpolate at audio rate, not control rate. Kicks have sub-ms pitch transitions — block-rate modulation causes aliasing/zipper artifacts. Use per-sample linear interpolation minimum, ideally cubic.

2. **Sub oscillator anti-aliasing:** At high pitch (start of pitch envelope, 1-5kHz), naive waveforms alias badly. Use PolyBLEP for triangle/saw, or wavetable with mipmapping. Sine is fine.

3. **Phase correlation measurement:** Compute per-block (64-128 samples) using normalized cross-correlation. Display with 50ms smoothing for readability. The meter should update at 30fps minimum.

4. **Auto-align algorithm:** Cross-correlate each sample layer with the sub in the 20-200Hz band (bandpass first). Find the lag with maximum positive correlation. Apply as sample delay. This is a one-shot computation, not real-time.

5. **Saturation:** Implement as waveshaper lookup table for efficiency. Tape = soft cubic saturator with asymmetry. Tube = tanh with even harmonic emphasis (add DC offset before, remove after). Digital = hard clip. Fuzz = asymmetric fold-back. Oversample 4x minimum to avoid aliasing.

6. **Mono Maker:** Below the set frequency, sum L+R and distribute equally. Use a crossover filter (Linkwitz-Riley 24dB/oct) to split, mono the low band, recombine. Phase-linear if possible (FIR), or accept the latency.

7. **Transient Shaper:** Envelope follower approach: fast envelope (attack 0.1ms, release 5ms) and slow envelope (attack 10ms, release 100ms). Transient = fast/slow ratio. Apply gain based on ratio. Simple, CPU-cheap, effective.

8. **Latency budget:** Target < 3ms total plugin latency. All processing should be achievable with no lookahead except the Mono Maker (if FIR). Report latency to host accurately for PDC.

---

## Recommended Implementation Priority

### Phase 1 — Core Identity (v1.0 release)
| Priority | Feature | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | Master Display with interactive pitch envelope | High | Defines the product |
| 🔴 P0 | Style guide implementation (colors, knobs, typography) | Medium | Makes it look sellable |
| 🔴 P0 | Global ↔ Detail layer workflow | Medium | Makes it feel professional |
| 🟠 P1 | Amp envelope overlay in Master Display | Medium | Completes the display |
| 🟠 P1 | Click Designer module | Medium | Key differentiator |
| 🟠 P1 | Drag-and-drop WAV export | Low | Viral feature |

### Phase 2 — Pro Polish (v1.1)
| Priority | Feature | Effort | Impact |
|---|---|---|---|
| 🟠 P1 | Phase Correlation meter | Medium | Forum-post feature |
| 🟠 P1 | Harmonic Saturation with visual feedback | Medium | Sound quality leap |
| 🟡 P2 | Transient Shaper | Low | Expected pro feature |
| 🟡 P2 | Punch/Body/Air macro strip | Low | Fast workflow |
| 🟡 P2 | Auto-tune to key | Low | Quality of life |

### Phase 3 — Premium Tier (v1.5)
| Priority | Feature | Effort | Impact |
|---|---|---|---|
| 🟡 P2 | Phase Rotation (continuous) | Low | Pro mixing tool |
| 🟡 P2 | Auto-Align | Medium | Magic moment |
| 🟡 P2 | Section Randomize with Lock | Medium | Creative exploration |
| 🟢 P3 | Mono Maker + Low-End Focus | Low | Mastering convenience |
| 🟢 P3 | Spectrum view mode | Medium | Nice to have |

### Estimated Timeline
- **Phase 1:** 4-6 weeks (assuming one developer + one designer)
- **Phase 2:** 3-4 weeks
- **Phase 3:** 3-4 weeks
- **Total to v1.5:** ~12-14 weeks

---

*This document is a living blueprint. Update as implementation reveals constraints or new opportunities. The north star: every interaction should make a producer think "this was made by someone who actually makes kicks."*
