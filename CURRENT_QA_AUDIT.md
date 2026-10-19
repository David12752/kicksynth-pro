# KickSynth Pro — Commercial QA Audit
**Date:** 2026-03-28  
**Auditor:** Copilot Claude Sonnet 4.6 (subagent)  
**Scope:** Synth tab only — post adaptive master display redesign

---

## ✅ What Already Feels Commercially Credible

- **Layout stability** — 3-column fixed grid with zero scroll is solid and professional. No jitter.
- **Adaptive master display** — OSC/AMP/FILTER/EQ/MIX modes are all drawing correctly. Mode switching on knob focus is a great UX touch.
- **Trigger feedback** — `is-triggering` + `is-success` CSS states in both the top-left quick strip and transport bar feel properly alive.
- **Knob component** — SVG knob renders well at both 34px (primary) and 32px (secondary), label + readout pattern is clean.
- **EQ** — draggable EQ points with frequency/gain display is a standout feature. The EQ VIEW shortcut button from the right column is clever.
- **Filter grid** — 10-type filter selector with visual active state is impressive for v1.
- **Transport bar** — TRIGGER / LOOP / SC / BPM / KEY / SNAP / EXPORT / Engine status / Status message all fit cleanly in one row.
- **Status messaging** — three-tone system (neutral/good/warning) with correct contextual text.
- **Preset system** — 5 presets + undo/redo + copy share text are genuinely useful.
- **Roadmap panel** — locked tabs showing the honest intent panel is a trust-positive choice.
- **Dark theme** — well-chosen CSS token palette; consistent border/elevation system.

---

## 🔴 P0 Issues (Trust-Blocking)

### 1. `--border-subtle` undefined CSS variable — **FIXED**
`pQuickStrip` and `pTrigBtn` referenced `var(--border-subtle)`, which is not defined in `:root`. This meant the quick-strip border and trigger button border fell back to transparent/invisible, making the quick strip look visually unmoored.
- **Fix applied:** Replaced both `var(--border-subtle)` with `var(--border)` in `index.css`.
- **Build:** ✅ Clean — 0 errors.

---

## 🟡 P1 Issues (Polish Blockers)

### 2. Knob double-click reset not implemented
There is no way to reset a knob to its default value. This is standard in every commercial synth (double-click = reset to default). The knob `onMouseDown` handler never fires a reset path. Without this, parameter recovery requires undo or preset reload — not production-acceptable.

### 3. AMP ENV canvas uses straight-line segments, not curves
`drawAMPENVMode` draws the ADSR shape with `lineTo` only. Real synth envelopes are curved (exponential decay, log attack). The visual misleads users about the actual envelope shape. At minimum, attack should curve upward and decay/release should curve downward using `bezierCurveTo`.

### 4. MOD section — LFO is unconnected / no visual confirmation
LFO RATE and LFO DEPTH knobs exist and are persisted, but the OSC display never shows any LFO modulation effect. If the audio engine ignores LFO (likely in fallback mode), the controls appear to do nothing and erode trust. Needs either a visual badge "LFO active" in OSC mode, or a clear greyed-out state when engine is in fallback.

### 5. EQ curve `eqScale` top label alignment bug
The `eqScaleTop` shows `+12 dB`, `0 dB`, `–12 dB` in a `justify-content: space-between` flex row — but these three labels map to top/middle/bottom of the canvas, not left/center/right. The labels therefore appear misaligned horizontally. Should use a vertical scale label bar on the left, or position them absolutely at the correct Y positions.

---

## 📋 Top 5 Next Fixes (Priority Order)

| # | Fix | Impact | Risk | Effort |
|---|-----|--------|------|--------|
| 1 | **~~`--border-subtle` undefined var~~** *(done)* | High — visual broken border | None | XS |
| 2 | **Knob double-click to reset to default** | High — standard pro UX | Low | S |
| 3 | **AMP ENV curved segments** (bezier A/D/R) | Medium — visual accuracy trust | Low | S |
| 4 | **EQ scale labels fix** (vertical left axis) | Medium — looks amateurish | Low | S |
| 5 | **LFO visual feedback** (badge or dim when inactive) | Medium — prevents confusion | Low | XS |

---

## Implementation Summary

**Change made this audit session:**
- `src/renderer/src/index.css`: Replaced two instances of `var(--border-subtle)` (undefined) with `var(--border)` in `.pQuickStrip` and `.pTrigBtn`. Build clean ✅.

---

## Notes for Next Session

- The `OSC_KNOBS` array and `OSC_ROW_ONE`/`OSC_ROW_TWO` split are duplicated — the full 5-knob row now uses `OSC_KNOBS` directly, so `OSC_ROW_ONE`/`OSC_ROW_TWO` are dead code and can be removed.
- `--success` CSS variable is referenced in `.pTrigBtn.is-success` but not defined in `:root`; it falls back to the inline `#22c55e` in the rule itself which works, but is inconsistent.
- Phase knob appears in both the OSC section and the SUB OSC strip (right column) — this is intentional but could confuse users. Consider labelling the SUB OSC one `SUB PHASE` to disambiguate.
