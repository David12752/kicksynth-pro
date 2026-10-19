# KickSynth Pro — UI/UX Redesign Plan
**Version:** 1.0 | **Author:** UI/UX Architecture Document | **Date:** 2026-03-29

---

## Table of Contents

1. [Executive Summary & Design Philosophy](#1-executive-summary--design-philosophy)
2. [Current State Audit](#2-current-state-audit)
3. [Architecture & Layout Restructuring](#3-architecture--layout-restructuring)
4. [Component Breakdown & Specifications](#4-component-breakdown--specifications)
5. [Interactive Elements Specifications](#5-interactive-elements-specifications)
6. [Styling & Typography Guide](#6-styling--typography-guide)
7. [Data Binding & Rendering Hierarchy](#7-data-binding--rendering-hierarchy)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Executive Summary & Design Philosophy

### Vision
Transform KickSynth Pro from a static parameter editor into a **living instrument** — one where every action produces immediate, readable visual feedback. The UI should feel closer to Arturia's Pigments or u-he's Zebra 3 than a generic JUCE template.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Motion = Meaning** | Every parameter change animates. Envelopes redraw in real-time, meters react instantly. |
| **Hierarchy by Importance** | The most-reached-for controls (pitch envelope, body tune, click/transient) sit at the top. Utility controls (routing, FX) sit below. |
| **Module Identity** | Each signal section has a distinct color identity. A musician never wonders "which knob belongs to what." |
| **Density Without Clutter** | Use whitespace aggressively. Group related parameters inside bordered module cards. Never place a knob without a label. |
| **Glanceability** | A performer should understand the full patch state in under 2 seconds by looking at the UI. |

---

## 2. Current State Audit

### Identified Problems

1. **Static Filter Graph (40% screen real estate)** — A large, non-interactive EQ/filter curve that provides read-only data with no draggable nodes.
2. **Unlabeled Knobs** — Multiple knobs with no parameter name below or beside them.
3. **Cluttered Sample Layers** — All sample slots stacked without visual separation, no per-layer metering, no solo/mute per layer.
4. **Sub Oscillator Buried** — Sub Osc is treated as a secondary thought, despite being the foundational element of a kick drum.
5. **No Envelope Visualization** — Amplitude and pitch envelopes are pure numeric/knob-based with no graphical curve representation.
6. **No Live Metering** — No visual feedback that the instrument is producing audio at any stage of the signal chain.
7. **No Phase Correlation Display** — Critical for kick drums; phase issues between layers are completely invisible.
8. **Monolithic Layout** — Everything lives at the same visual depth; no sense of "primary" vs "secondary" controls.

---

## 3. Architecture & Layout Restructuring

### 3.1 Overall Canvas Dimensions

- **Recommended Plugin Window:** `1280 × 820 px` (scalable: 75%, 100%, 125%, 150%)
- **Minimum Supported:** `960 × 615 px`
- **Aspect Ratio:** Fixed 1.56:1

### 3.2 Grid System

Adopt a **12-column, 8-row grid** with `12px` gutters.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR  [Logo] [Preset Browser ▼] [Undo/Redo] [Settings] [Panic] [CPU]│  Row 1 (48px)
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │   SUB OSCILLATOR     │  │  CLICK / TRANS. │  │   BODY OSCILLATOR    │   │  Rows 2–4
│  │   (cols 1–4)         │  │  (cols 5–8)     │  │   (cols 9–12)        │   │  (220px)
│  └──────────────────────┘  └─────────────────┘  └──────────────────────┘   │
│                                                                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────┐  ┌─────────────────────────────┐    │
│  │   SAMPLE LAYERS  (cols 1–7)       │  │   FOCUS WINDOW  (cols 8–12) │    │  Rows 5–7
│  │   (Sample A / B / C with meters)  │  │   [Envelope / EQ / Spec /   │    │  (260px)
│  └───────────────────────────────────┘  │    Phase tabs]              │    │
│                                          └─────────────────────────────┘    │
│                                                                              │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │   MASTER MIXER + FX CHAIN + OUTPUT METER  (cols 1–12)               │   │  Row 8
│  └──────────────────────────────────────────────────────────────────────┘   │  (100px)
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Step-by-Step Migration from Boxed to Modular Layout

**Step 1 — Remove the static filter graph as a standalone section.**
- The filter graph is relocated as a *tab* inside the new "Focus Window" (right column, rows 5–7).
- It becomes interactive (draggable nodes) instead of a static read-only display.
- This reclaims approximately 300px × 260px of prime screen real estate.

**Step 2 — Promote Sub Oscillator to the top-left module.**
- Previously buried below or beside the sample section.
- Now occupies columns 1–4 in the second major row, immediately below the header.
- Give it a dedicated pitch envelope mini-preview within the card.

**Step 3 — Create a dedicated Click / Transient module.**
- Extract transient shaping (attack click, noise burst, body punch) from wherever it currently lives.
- Place it center-top (columns 5–8), as the transient defines the kick's character as much as the body.

**Step 4 — Restructure Sample Layers into a horizontal strip.**
- Move from a vertical stacked list to a **horizontal three-slot strip** (Sample A, B, C).
- Each slot is a self-contained card with: waveform display, gain knob, pan knob, solo/mute buttons, pitch offset, VU meter.

**Step 5 — Build the Focus Window.**
- A multi-tab panel occupying the right side (columns 8–12, rows 5–7).
- Tabs: `ENV` | `EQ` | `SPEC` | `PHASE`
- This replaces the static filter graph and gives it five times more functionality.

**Step 6 — Collapse the master section into a single footer bar.**
- Master volume, output meter (L/R), limiter toggle, and FX send sit in a single 100px footer row.
- Use a horizontal strip layout — no wasted vertical space.

---

## 4. Component Breakdown & Specifications

### 4.1 Header Bar

| Element | Spec |
|---------|------|
| Plugin logo | Left-aligned, 32px height, SVG vector |
| Preset browser | Center, dropdown with search field, shows: `Bank / Preset Name`, prev/next arrows |
| Undo / Redo | Icon buttons, 24×24px, with tooltip on hover |
| CPU / Voice meter | Right-aligned, small horizontal bar + percentage text, updates at 10fps |
| Panic button | Red-tinted, clears all active voices |

---

### 4.2 Sub Oscillator Module

**Module Color Identity:** `#1A6EFF` (Electric Blue)

**Card Dimensions:** `~390px × 220px`

**Parameters (all must be labeled):**

| Parameter | Control Type | Range | Notes |
|-----------|-------------|-------|-------|
| Tune (coarse) | Large knob | -24 to +24 semitones | Center = 0, label below |
| Tune (fine) | Small knob | -100 to +100 cents | Right of coarse knob |
| Waveform Select | Icon button row | Sine / Triangle / Sine² / Custom | 4 buttons, active state highlighted |
| Phase Offset | Small knob | 0–360° | **NEW** — was missing previously |
| Phase Rotation | Toggle + knob | On/Off + 0–360° | **NEW** — critical for sub alignment |
| Drive | Knob | 0–100% | Soft saturation on the sub |
| Sub Level | Vertical fader or large knob | -∞ to 0 dB | |
| Pitch Envelope Amount | Knob | -100 to +100% | How much pitch env affects this osc |
| Mini Pitch Envelope Preview | Inline curve display | read-only preview | 120px × 40px, redraws when ENV tab edited |

**Visual layout within card:**
```
┌─ SUB OSCILLATOR ──────────────────────────────────────────────┐
│  [~] [△] [∿] [⚙]   Phase ●   Phase Rot ●    Drive ●          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Pitch Env Preview (mini curve, 120×40px)              │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Tune (Coarse) ◎   Fine ◎      Level  ◎    PitchEnv Amt ◎    │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Click / Transient Module

**Module Color Identity:** `#FF6B1A` (Amber/Orange)

**Card Dimensions:** `~370px × 220px`

**Parameters:**

| Parameter | Control Type | Range | Notes |
|-----------|-------------|-------|-------|
| Click Type | Dropdown or button row | Noise / Sine Click / FM Click / Sample | **NEW** |
| Click Tune | Knob | 20Hz–1kHz | Frequency of click oscillator |
| Click Decay | Knob | 0.5ms–50ms | How fast the click fades |
| Click Level | Knob | -∞ to 0 dB | |
| Transient Attack | Knob | 0–20ms | **NEW** — shape the initial transient |
| Transient Punch | Knob | 0–100% | **NEW** — mid-body emphasis |
| Noise Color | Knob | White → Pink → Brown | **NEW** — noise burst tint |
| Noise Decay | Knob | 0.5ms–200ms | |
| Noise Level | Knob | -∞ to 0 dB | |
| Live Click Waveform | Mini waveform display | 180px × 50px | Shows rendered click burst in real-time |

---

### 4.4 Body Oscillator Module

**Module Color Identity:** `#9D4EDD` (Purple)

**Card Dimensions:** `~390px × 220px`

**Parameters:**

| Parameter | Control Type | Range | Notes |
|-----------|-------------|-------|-------|
| Tune (coarse) | Large knob | -24 to +24 semitones | |
| Tune (fine) | Small knob | -100 to +100 cents | |
| Waveform | Icon buttons | Sine / Saw / Square / FM | |
| FM Ratio | Knob | 0.5–16× | Visible only when FM waveform selected |
| FM Amount | Knob | 0–100% | Visible only when FM waveform selected |
| Phase | Knob | 0–360° | **NEW** |
| Distortion | Knob | 0–100% | Waveshaper on body osc |
| Distortion Type | Button row | Soft / Hard / Fold | |
| Body Level | Large knob | -∞ to 0 dB | |
| Pitch Env Amount | Knob | -100 to +100% | |

---

### 4.5 Sample Layers Module

**Module Color Identity:** `#2ECC71` (Green)

**Card Dimensions:** `~700px × 260px` (spans columns 1–7)

**Layout:** Three identical sample slot cards arranged horizontally (Sample A / B / C).

**Per-Slot Parameters:**

| Parameter | Control Type | Notes |
|-----------|-------------|-------|
| Sample Name / Load | Click-to-open file browser | Display filename, truncated with ellipsis |
| Waveform Display | Inline waveform renderer | 180px × 60px, shows actual audio waveform |
| Start Point | Draggable marker on waveform | |
| End Point | Draggable marker on waveform | |
| Gain | Knob | -∞ to +12 dB |
| Pan | Knob | L100–R100 |
| Pitch | Knob | -24 to +24 semitones |
| Reverse | Toggle button | Flips playback direction |
| Loop | Toggle button | |
| Solo | Icon button | Mutes all other layers |
| Mute | Icon button | |
| VU Meter | Vertical bar, per-slot | Real-time level, peak hold 2s |
| Tune Fine | Small knob | -100 to +100 cents |
| Saturation | Small knob | **NEW** — per-layer drive |

**Slot visual layout:**
```
┌─ SAMPLE A ─────────────────────────────────────┐
│  [Load] filename_truncated.wav   [S][M]         │
│  ┌──────────────────────────────────┐  ║        │
│  │  Waveform (with start/end marks) │  ║ VU     │
│  └──────────────────────────────────┘  ║ Meter  │
│  Gain ◎  Pan ◎  Pitch ◎  Fine ◎  Sat◎  ║        │
│  [◀Reverse] [↺Loop]                    ║        │
└────────────────────────────────────────────────┘
```

---

### 4.6 Focus Window (Multi-Tab Panel)

**Card Dimensions:** `~460px × 260px` (columns 8–12, rows 5–7)

**Tabs:**

#### Tab 1: ENV (Envelope Editor)
- **Dual-envelope view**: Amplitude envelope (top half) and Pitch envelope (bottom half), or switchable via sub-tab.
- Each envelope has 4–5 draggable nodes: Attack, Hold, Decay, Sustain, Release.
- Nodes render as filled circles (8px diameter), highlight on hover, show value tooltip on drag.
- Curve type selector per segment: Linear / Exponential / Logarithmic (right-click node).
- Time axis: 0–2000ms (auto-scales to envelope length).
- Y-axis: 0–100% (amplitude) or pitch amount.

#### Tab 2: EQ (Interactive Filter)
- **Replaces the current static filter graph.**
- 4-band parametric EQ with draggable nodes.
- Each node: frequency (x-axis) × gain (y-axis) × Q (scroll wheel or pinch).
- Band types selectable by right-clicking node: LP / HP / Bell / Shelf / Notch.
- Live frequency response curve drawn in real-time as nodes move.
- Grid overlay: frequency markers at 20, 100, 500, 1k, 5k, 20kHz.

#### Tab 3: SPEC (Spectrum Analyzer)
- Real-time FFT spectrum display, 60fps update rate.
- Frequency range: 20Hz–20kHz (log scale x-axis).
- Bar or smooth curve mode toggle.
- Peak hold lines (2s decay).
- Optional: Overlay multiple layers in different colors.

#### Tab 4: PHASE (Phase Correlation Meter)
- **NEW** — Lissajous/Goniometer display (circular, 200px diameter).
- Shows L vs R phase relationship.
- Correlation meter below: -1.0 (out of phase) to +1.0 (in phase), displayed as a horizontal bar.
- A kick drum should read near +1.0 in mono; this meter instantly reveals phase issues between layers.

---

### 4.7 Master / Footer Bar

**Height:** 100px | Full width

**Elements (left to right):**

| Element | Details |
|---------|---------|
| Master Volume | Large knob + numeric readout |
| Output L/R VU Meters | Two vertical bars, peak hold, clip indicator |
| Limiter Toggle | On/Off button, threshold knob when active |
| Mono Sum | Toggle — collapses to mono for phase checking |
| FX Chain | Three mini FX slots: Compressor / Saturator / Reverb tail (each with on/off, single macro knob) |
| MIDI Learn indicator | Small LED + "MIDI" label, blinks on incoming CC |

---

## 5. Interactive Elements Specifications

### 5.1 Draggable Envelope Nodes

**Data Structure per Node:**
```
EnvelopeNode {
  id: string           // "attack", "hold", "decay", "sustain", "release"
  time_ms: float       // x-axis position
  value: float         // y-axis position (0.0–1.0)
  curve_type: enum     // LINEAR | EXP | LOG
  is_dragging: bool    // internal state
}
```

**Interaction Model:**
1. On `mousedown` / `touchstart` over a node hit area (16×16px minimum): enter drag mode, capture pointer.
2. On `mousemove` / `touchmove`: update `time_ms` (x-constrained between adjacent nodes) and `value` (y-constrained 0.0–1.0).
3. Show a floating tooltip: `"Decay: 120ms"` — positioned 12px above the cursor.
4. On release: fire a `parameterChanged` event with the new value. Write to the audio engine.
5. Double-click a node: open a numeric text input field for precise entry.
6. Right-click a node: context menu for `Curve Type` selection.

**Curve Rendering Algorithm (Bezier approximation):**
- For `LINEAR`: straight line between points.
- For `EXP` (fast start, slow end): use a quadratic bezier with control point at `(t_start + 20%, v_start)`.
- For `LOG` (slow start, fast end): control point at `(t_end - 20%, v_end)`.
- Redraw the full curve path on every node move (not just the adjacent segments).

**Performance:** Use a `dirty flag`. Only re-render the envelope canvas when `dirty === true`. Clear the flag after each draw frame.

---

### 5.2 Live Waveform Displays

**Per-sample-slot waveform (static pre-computed):**
1. On sample load, compute a downsampled peak array: for each pixel column of the display width, store `{min, max}` amplitude across the corresponding audio frame range.
2. Draw as a mirrored bar chart: top half = max, bottom half = min (standard waveform convention).
3. Color: use the module's identity color at 60% opacity for the fill, 100% for the outline.
4. Start/End markers: render as vertical lines with triangular drag handles at the top.
5. On drag of start/end marker: re-render the overlay immediately (no need to re-compute peaks).

**Live oscillator waveform (animated):**
1. Maintain a circular audio buffer of the last 512 samples from the oscillator output.
2. On each render frame (~60fps): read the buffer, draw the waveform as a polyline.
3. Use `requestAnimationFrame` (or the framework equivalent) — never use a fixed timer.
4. Scope trigger: find the first zero-crossing with positive slope to stabilize the display.

---

### 5.3 VU Meters (Per Layer + Master)

**Visual Spec:**
- Segmented bar design: 24 segments vertically.
- Color bands:
  - Segments 1–16: `#2ECC71` (green)
  - Segments 17–21: `#F1C40F` (yellow)
  - Segments 22–24: `#E74C3C` (red / clip)
- Peak hold: highest reached segment stays lit for 2000ms, then decays at 6 dB/s.
- Clip indicator: top segment flashes red, stays red until clicked to reset.

**Update Rate:** 30fps is sufficient for VU meters (not 60fps — saves CPU).

**Data Binding:**
```
// Pseudo-code
onAudioProcessCallback(rms_db, peak_db) {
    meter.rms_level = rms_db
    meter.peak_level = peak_db
    meter.dirty = true
}

onRenderFrame() {
    if (meter.dirty) {
        drawMeterSegments(meter.rms_level, meter.peak_level)
        meter.dirty = false
    }
}
```

---

### 5.4 Spectrum Analyzer (Focus Window: SPEC Tab)

**FFT Parameters:**
- Size: 2048 points (good frequency resolution for kicks)
- Window function: Hanning
- Overlap: 50%
- Update rate: 60fps (use latest available FFT buffer)

**Rendering:**
- X-axis: log scale, 20Hz–20kHz. Map frequency bin `i` to pixel `x` via: `x = width × log10(freq[i] / 20) / log10(20000 / 20)`
- Y-axis: dB scale, -90 to 0 dBFS. Linear pixel mapping.
- Draw as a filled area path: path from bottom-left, up through all frequency magnitude points, back down to bottom-right, closed and filled.
- Fill: gradient from module color (top) to transparent (bottom).
- Stroke: solid line at module color, 1.5px.
- Peak lines: horizontal markers that decay 6dB/s after peak.

---

### 5.5 Phase Correlation Goniometer (Focus Window: PHASE Tab)

**Display:** Circular canvas, 200px diameter.

**Rendering Logic:**
1. For each audio frame pair `(L[i], R[i])`:
   - Rotate 45°: `M[i] = (L[i] + R[i]) / sqrt(2)`, `S[i] = (L[i] - R[i]) / sqrt(2)`
   - Map to canvas coordinates: `x = center_x + S[i] × scale`, `y = center_y - M[i] × scale`
   - Plot as a point.
2. Use a fade/decay approach: each new frame, fill the canvas with a semi-transparent background (`rgba(0,0,0,0.15)`) before drawing new points. This creates a natural persistence/decay effect.
3. Color: points colored by density (sparse = dim blue, dense = bright cyan/white).

**Correlation Meter bar (below the goniometer):**
- Formula: `correlation = Σ(L×R) / sqrt(Σ(L²) × Σ(R²))`, computed over 1024-sample window.
- Bar: -1.0 to +1.0, center at 0. Green fill toward +1 (in-phase), red fill toward -1 (out-of-phase).
- Numeric readout: `"+0.98"` displayed at right edge.

---

## 6. Styling & Typography Guide

### 6.1 Color Palette

**Background Layers:**

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#0D0D0F` | Overall plugin background |
| `bg-surface` | `#161619` | Module card backgrounds |
| `bg-elevated` | `#1E1E24` | Input fields, dropdowns, inner panels |
| `bg-overlay` | `#252530` | Hover states, tooltips |

**Accent / Module Colors:**

| Module | Color Token | Hex | Usage |
|--------|-------------|-----|-------|
| Sub Oscillator | `accent-sub` | `#1A6EFF` | Borders, knob rings, active states |
| Click/Transient | `accent-click` | `#FF6B1A` | Borders, knob rings |
| Body Oscillator | `accent-body` | `#9D4EDD` | Borders, knob rings |
| Sample Layers | `accent-sample` | `#2ECC71` | Borders, waveforms, VU meters |
| Focus Window | `accent-focus` | `#E8C547` | Tab highlights, interactive EQ nodes |
| Master/Global | `accent-master` | `#E74C3C` | Output meter, clip indicators |

**Text Colors:**

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#F0F0F5` | Module titles, knob values |
| `text-secondary` | `#9090A0` | Parameter labels below knobs |
| `text-disabled` | `#505060` | Inactive/bypassed parameters |
| `text-accent` | Module color | Active/selected state labels |

**Contrast Ratios (WCAG compliance for accessibility):**
- `text-primary` on `bg-surface`: ≥ 7:1 (AAA)
- `text-secondary` on `bg-surface`: ≥ 4.5:1 (AA)
- All interactive elements: minimum 3:1 against adjacent non-interactive elements

---

### 6.2 Typography

**Font Stack:** `"Inter", "SF Pro Display", "Segoe UI", system-ui, sans-serif`

> Inter is the recommended primary font — it is designed for screen readability and has excellent numerics. Embed as a local asset; do not rely on system availability.

| Role | Size | Weight | Letter Spacing |
|------|------|--------|----------------|
| Module Title | 11px | 700 (Bold) | `0.08em` uppercase |
| Parameter Label | 10px | 400 (Regular) | `0.04em` |
| Knob Value Readout | 11px | 500 (Medium) | `0` |
| Preset Name | 14px | 600 (SemiBold) | `0` |
| Tab Labels | 11px | 600 | `0.06em` uppercase |
| Tooltip Text | 10px | 400 | `0` |
| Footer Labels | 10px | 400 | `0.04em` |

**Rules:**
- Module titles are ALL CAPS.
- Parameter labels are Title Case (not all-caps).
- Numeric readouts use tabular (monospaced) numerals (`font-variant-numeric: tabular-nums`) to prevent layout jitter as values change.
- Minimum label size: **10px** — never go below this, even in compact layouts.

---

### 6.3 Knob Design Specification

**Standard Knob (large, primary parameters):**
- Diameter: `48px`
- Track arc: 270° sweep (from 7 o'clock to 5 o'clock, clockwise)
- Track background: `#2A2A35` (dimmed), 3px stroke
- Track fill: Module accent color, 3px stroke, drawn from start position to current value
- Indicator line: 2px, white, pointing from center to current position
- Center dot: 4px filled circle, `bg-elevated` color
- Knob body: `bg-elevated` fill, subtle radial gradient (top-left lighter by 15%)
- Hover: track fill brightens by 20%, cursor changes to vertical resize or rotary
- Drag behavior: **vertical drag** (up = increase, down = decrease) — standard DAW behavior. Sensitivity: 200px drag = full range. Hold Shift for fine adjustment (2000px = full range).
- Double-click: open inline numeric text input, auto-select text, enter to confirm, Escape to cancel.
- Right-click: context menu: `Set to Default | Enter Value | MIDI Learn | Automation`

**Small Knob (secondary parameters):**
- Diameter: `32px`
- Same design rules, proportionally scaled.
- Track: 2px stroke.

**Knob Grouping:**
- Primary knobs sit in a row: large knob centered, label directly beneath (10px, centered, `text-secondary`).
- Value readout appears on a `bg-elevated` pill tag above the knob only while being edited or hovered.

---

### 6.4 Borders & Module Cards

- Module card border: 1px solid, module accent color at **25% opacity** (subtle, not harsh).
- On hover of card (not individual controls): border opacity increases to **60%**.
- Border radius: `8px` on outer cards, `4px` on inner elements (waveforms, meters).
- Card padding: `12px` all sides.
- Card header (module title): 10px padding-bottom, 1px separator line at 15% opacity of accent color.

---

### 6.5 Interaction States

| State | Visual Change |
|-------|------------|
| Default | Normal render |
| Hover | Element brightens 15%, cursor changes |
| Active/Pressed | Element dims 10%, slight scale 0.97 on buttons |
| Focus (keyboard) | 2px accent-colored outline, 2px offset |
| Disabled | 40% opacity, cursor: not-allowed |
| MIDI-Learned | Subtle glowing ring in gold (`#E8C547`) |
| Automating | Animated dashed border, module accent color |

---

## 7. Data Binding & Rendering Hierarchy

### 7.1 Conceptual Model

Use a **unidirectional data flow** pattern regardless of framework:

```
Audio Engine Parameters
        │
        ▼
  Parameter State Store  ◄── User Interaction (knob, drag, etc.)
        │
        ▼
  UI Component Tree
        │
        ├── Module Components (observe their slice of state)
        │       └── Re-render only when their parameters change
        │
        └── Visualizer Components (observe audio buffer)
                └── Re-render on animation frame if buffer is dirty
```

### 7.2 Parameter ID Convention

Every bindable parameter must have a unique string ID following this pattern:
```
{module}.{parameter}
Examples:
  "sub_osc.tune_coarse"
  "sub_osc.phase_rotation"
  "click.click_decay"
  "sample_a.gain"
  "sample_b.pitch"
  "master.volume"
  "eq.band1.frequency"
  "envelope_amp.decay_time"
```

This ID is used for:
- Serialization in preset files
- MIDI learn mapping
- Automation lane targeting
- Direct parameter access from audio thread

### 7.3 Rendering Layers

Separate your rendering into these independent layers to maintain performance:

| Layer | Update Trigger | Frame Rate |
|-------|---------------|------------|
| Static UI chrome (borders, labels, knob bodies) | Parameter change only | On-demand |
| Envelope editor canvas | Node drag / parameter change | On-demand |
| VU Meters | Audio callback (30fps throttled) | 30 fps |
| Waveform oscilloscope | Animation frame (audio dirty) | 60 fps |
| Spectrum analyzer | Animation frame (FFT dirty) | 60 fps |
| Goniometer | Animation frame (audio dirty) | 60 fps |

**Never render everything at 60fps.** Only visualizers need full frame rate. Static chrome should never re-render except on state change.

---

## 8. Implementation Roadmap

### Phase 1: Layout Skeleton
*Goal: Get the correct proportions and grid in place before adding any functionality.*

- [ ] 1.1 Define the plugin canvas size (1280×820) and implement scaling support (75/100/125/150%)
- [ ] 1.2 Implement the 12-column × 8-row grid system with 12px gutters
- [ ] 1.3 Create the five main layout zones: Header, Top Row (3 modules), Bottom-Left (Sample Layers), Bottom-Right (Focus Window), Footer
- [ ] 1.4 Render empty module cards with correct dimensions, border-radius, and accent-colored borders
- [ ] 1.5 Add module title text in the card headers (ALL CAPS, 11px Bold)
- [ ] 1.6 Implement the Focus Window tab bar (ENV / EQ / SPEC / PHASE) with tab switching logic
- [ ] 1.7 Implement the Header Bar with static logo placeholder, preset name display, and CPU indicator skeleton
- [ ] 1.8 Verify layout renders correctly at all four scale factors

---

### Phase 2: Core Routing UI
*Goal: All knobs, buttons, and text inputs are present, labeled, and bound to real parameters.*

- [ ] 2.1 Implement the standard knob component: drag interaction, value range, label, value readout
- [ ] 2.2 Implement small knob component (32px)
- [ ] 2.3 Build Sub Oscillator module: place all 9 parameters with correct knob sizes and labels
- [ ] 2.4 Build Click / Transient module: place all 10 parameters
- [ ] 2.5 Build Body Oscillator module: place all 10 parameters; implement conditional FM controls (show/hide based on waveform selection)
- [ ] 2.6 Build Sample Layers module: implement one slot, then clone for A/B/C; add Solo/Mute toggle logic
- [ ] 2.7 Build Master Footer: volume knob, FX slots, Mono Sum toggle
- [ ] 2.8 Bind all knob components to the parameter state store using the parameter ID convention
- [ ] 2.9 Implement double-click numeric entry on all knobs
- [ ] 2.10 Implement right-click context menu (Set Default, Enter Value, MIDI Learn)
- [ ] 2.11 Test: change a knob in the UI → verify the audio engine parameter updates correctly

---

### Phase 3: Interactive Visualizers
*Goal: All dynamic visual elements are live and fully interactive.*

- [ ] 3.1 Implement the Envelope Editor canvas (ENV tab): draw static nodes and curves first
- [ ] 3.2 Add drag interaction to envelope nodes (x/y constrained, adjacent node limits)
- [ ] 3.3 Implement curve type selection (right-click node → Linear/Exp/Log) and update bezier rendering
- [ ] 3.4 Add floating value tooltip on envelope node drag
- [ ] 3.5 Implement EQ tab: draggable frequency nodes on a dB/frequency grid
- [ ] 3.6 Implement EQ frequency response curve rendering (sum of filter transfer functions)
- [ ] 3.7 Implement per-sample-slot waveform display: peak-array pre-computation on load
- [ ] 3.8 Add start/end point drag markers to waveform display
- [ ] 3.9 Implement VU meters (per sample layer + master L/R): segmented bars with peak hold
- [ ] 3.10 Implement live oscillator waveform scope (oscilloscope with zero-crossing trigger)
- [ ] 3.11 Implement Spectrum Analyzer (SPEC tab): FFT consumer, log-scale rendering, peak hold
- [ ] 3.12 Implement Phase Correlation Goniometer (PHASE tab): Lissajous display + correlation bar
- [ ] 3.13 Implement mini pitch envelope preview inside Sub Oscillator card (read-only, reflects ENV tab state)
- [ ] 3.14 Implement live click waveform preview inside Click/Transient card

---

### Phase 4: Polish & Styling
*Goal: The UI looks and feels like a premium, shipping product.*

- [ ] 4.1 Apply the full dark mode color palette (all `bg-*` and `accent-*` tokens)
- [ ] 4.2 Embed Inter font; apply all typography rules (sizes, weights, letter-spacing, tabular numerals)
- [ ] 4.3 Style all knobs: radial gradient body, colored track fill, indicator line, hover/active states
- [ ] 4.4 Apply all module card accent borders at 25% opacity; hover state at 60%
- [ ] 4.5 Apply all interaction states (hover, active, focus, disabled, MIDI-learned, automating)
- [ ] 4.6 Add knob animation: smooth value transitions when changed programmatically (e.g., preset load) — use 120ms ease-out
- [ ] 4.7 Add preset load animation: brief module card flash (accent color, 200ms fade) on preset change
- [ ] 4.8 Implement MIDI learn UI: gold ring on armed knob, MIDI indicator LED in header
- [ ] 4.9 Add clip indicator to VU meters: click-to-reset behavior
- [ ] 4.10 Perform contrast ratio audit against WCAG AA standards; fix any failing text/background pairs
- [ ] 4.11 Test at 75%, 100%, 125%, 150% scale — verify no text clipping or layout overflow at any scale
- [ ] 4.12 Profile render performance: ensure 60fps visualizers do not cause CPU spikes > 5% on a mid-range machine
- [ ] 4.13 Test with a screen reader / keyboard-only navigation (focus ring, tab order)
- [ ] 4.14 Final QA pass: every knob has a label, every control has a tooltip, no orphaned UI elements

---

## Appendix A: Parameter Reference Table

Complete listing of all parameters introduced or renamed in this redesign:

| Module | Parameter ID | Old State | New State |
|--------|-------------|-----------|-----------|
| Sub Osc | `sub_osc.phase_offset` | Missing | Added |
| Sub Osc | `sub_osc.phase_rotation` | Missing | Added |
| Sub Osc | `sub_osc.drive` | Unlabeled | Labeled + named |
| Click | `click.click_type` | Missing | Added (new module) |
| Click | `click.transient_attack` | Missing | Added |
| Click | `click.transient_punch` | Missing | Added |
| Click | `click.noise_color` | Missing | Added |
| Body Osc | `body_osc.phase` | Missing | Added |
| Body Osc | `body_osc.fm_ratio` | Unlabeled | Labeled + conditional |
| Sample A/B/C | `sample_x.saturation` | Missing | Added |
| Sample A/B/C | `sample_x.start_point` | Non-visual | Waveform drag marker |
| Sample A/B/C | `sample_x.end_point` | Non-visual | Waveform drag marker |
| EQ | `eq.band{1-4}.q` | Non-interactive | Scroll wheel on node |
| EQ | `eq.band{1-4}.type` | Fixed | Right-click selectable |
| Master | `master.mono_sum` | Missing | Added |

---

## Appendix B: Recommended Asset Pipeline

1. **Icons:** Use a single SVG sprite sheet. All waveform type icons, solo/mute, loop/reverse — render as inline SVG for crisp scaling at any DPI.
2. **Knob Images:** Render knobs procedurally in code, not as image assets. This ensures they always look correct at any scale and can respond to color theming dynamically.
3. **Font:** Ship Inter (variable font, woff2 format) as an embedded asset. Subsetted to Latin + numeric characters to minimize file size (~30KB).
4. **Canvas Contexts:** Use one dedicated canvas per visualizer (envelope, EQ, scope, spectrum, goniometer). Shared canvases create repaint dependencies and reduce parallelism.
5. **Preset Format:** JSON, with schema version field. Example snippet:
```json
{
  "schema_version": 1,
  "preset_name": "Deep House Kick",
  "parameters": {
    "sub_osc.tune_coarse": 0,
    "sub_osc.phase_rotation": 45.0,
    "click.click_decay": 8.5,
    "envelope_amp.decay_time": 450
  }
}
```

---

*End of KickSynth Pro UI/UX Redesign Plan — v1.0*
