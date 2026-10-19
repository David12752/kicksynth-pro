# KickSynth Pro v1 — Manual QA Checklist
> **Target time:** 10–20 minutes | **Tester:** Human | **Build must be fresh before testing**
> Run `npm run build && npm start` (or `electron .` / `electron-vite preview`) before starting.

---

## Priority Order (Highest Risk → Lowest)

| # | Area | Risk |
|---|------|------|
| 1 | App Startup & JUCE Connection | Critical — no audio without it |
| 2 | Trigger / Preview Sound | Core value prop |
| 3 | Waveform Preview Display | Visual validation of audio |
| 4 | Load Sample | Sample-layer pipeline |
| 5 | Export WAV | Delivery feature |
| 6 | Loop Timing | Accuracy / usability |
| 7 | Presets | User workflow |
| 8 | Undo / Redo | Data integrity |
| 9 | Visual States (knobs, toggles, selects) | Polish |
| 10 | Resize / Minimum Window | Layout stability |
| 11 | Failure / Fallback Handling | Resilience |

---

## Test Cases

### 1. App Startup & JUCE Connection

**Steps:**
1. Launch the app from a cold start (no prior instance).
2. Wait up to 5 seconds for the UI to render.
3. Check the JUCE status indicator (top bar / status badge).

**PASS:** UI renders with no white screen. JUCE connection badge shows connected/green OR a clear "No JUCE" fallback state — not a crash.
**FAIL:** Blank/white window, unhandled JS error in devtools, or app hangs indefinitely.

---

### 2. Trigger / Preview Sound

**Steps:**
1. In the SYNTH tab, set Start Pitch ~200 Hz, End Pitch ~50 Hz, Decay ~0.06 s (defaults).
2. Click the **TRIGGER** button.
3. Listen: you should hear a short kick transient.
4. Repeat with different waveforms (SINE → TRI → SQR → TANH) using the waveform selector.

**PASS:** Audible kick sound plays on each trigger. Waveform change audibly alters timbre.
**FAIL:** Silence, error toast, or audio glitch/click that persists.

> ⚠️ *If JUCE is not connected, the app should fall back gracefully (see test #11). Do NOT mark as FAIL if JUCE is absent and fallback message is shown.*

---

### 3. Waveform Preview Display

**Steps:**
1. Trigger a sound.
2. Observe the waveform display in the center panel.
3. Change Decay knob — waveform envelope should update.
4. Change waveform type — waveform shape should update.

**PASS:** Waveform visually reacts to parameter changes within ~100 ms. No visual corruption or frozen frame.
**FAIL:** Waveform doesn't update, shows broken/garbled rendering, or overlaps UI elements.

---

### 4. Load Sample

**Steps:**
1. Click the **folder / load sample** button.
2. Browse to any `.wav` or `.mp3` file and confirm selection.
3. Verify file name appears in the sample slot.
4. Trigger — sample should blend or replace synth layer per current mix.

**PASS:** File dialog opens, file loads without error, name is displayed, sample plays on trigger.
**FAIL:** Dialog doesn't open, app crashes on file select, name not shown, no audio from sample.

---

### 5. Export WAV

**Steps:**
1. Dial in any sound you like.
2. Click **Export** (or equivalent save button).
3. Choose a save location when prompted.
4. Verify file is written to disk and is non-zero bytes.
5. Open exported file in any DAW or media player and confirm audio is correct.

**PASS:** File saved, >0 bytes, audio is audible and matches in-app preview.
**FAIL:** No file written, file is 0 bytes, export silently fails, or exported audio is silent/corrupt.

---

### 6. Loop Timing

**Steps:**
1. Enable loop mode (if available) or trigger repeated playback at a set BPM.
2. Set BPM to 120, verify triggers align to the beat grid within ±5 ms (use a DAW or metronome to verify).
3. Change BPM — timing should scale correctly.

**PASS:** Triggers are rhythmically consistent, no drift over 8 bars, BPM change takes immediate effect.
**FAIL:** Visible or audible timing drift, BPM change ignored, loop skips or doubles.

---

### 7. Presets

**Steps:**
1. Open the **PresetBar** (preset selector at top or bottom).
2. Load any factory preset — all knobs should snap to preset values.
3. Modify a parameter, then load a different preset — values should fully reset.
4. Save a new user preset, close and reopen, confirm it persists.

**PASS:** Preset loading snaps all parameters correctly. Save → reload cycle persists the preset.
**FAIL:** Values don't change on load, preset name shows wrong values, or saved preset is lost on restart.

---

### 8. Undo / Redo

**Steps:**
1. Change 3 different parameters (e.g., Start Pitch, Decay, Filter Type).
2. Press **UNDO** 3 times — each press should revert one parameter change.
3. Press **REDO** 3 times — changes should be re-applied in order.
4. Make a change after undoing (branching) — redo history should clear.

**PASS:** Each undo/redo step maps 1:1 to a parameter change. Branching clears redo stack.
**FAIL:** Undo reverts multiple steps at once, history is lost, or redo stack is not cleared after new change.

---

### 9. Visual States

**Steps:**
1. Hover over each knob — tooltip or value readout should appear.
2. Click+drag a knob — value should update smoothly.
3. Toggle each Toggle control — active state visually differs from inactive.
4. Open each SelectField (Waveform, Distortion, Filter Type, LFO Target) — options render, selection sticks.
5. Check all labels are readable (no clipping, no overflow).

**PASS:** All interactive states (hover, active, selected, disabled) are visually distinct and correct.
**FAIL:** Knob doesn't respond to drag, toggle has no visual state change, select options are clipped/invisible.

---

### 10. Resize / Minimum Window

**Steps:**
1. Drag the window to various sizes — from max to near-minimum.
2. Try to resize below the minimum window size.
3. Verify layout doesn't break at any size within allowed range.

**PASS:** Layout reflows or clamps cleanly. No overlapping panels, hidden controls, or scroll bars where none are expected.
**FAIL:** Controls overlap, text becomes unreadable, or app crashes on resize.

---

### 11. Failure / Fallback Handling

**Steps:**
1. **No JUCE:** Launch with JUCE backend stopped. Verify a non-crashing fallback state (e.g., status indicator = red/offline, controls still render, no JS crash).
2. **Bad file:** Attempt to load a non-audio file (e.g., `.txt`). Verify graceful rejection (error toast or dialog, no crash).
3. **Cancel export:** Open export dialog and cancel — verify no partial file is written and app remains stable.

**PASS:** Each failure mode shows a clear, non-crashing feedback state.
**FAIL:** App crashes, white-screens, or silently continues in an undefined state.

---

## Quick Sign-off Matrix

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Startup & JUCE Connection | ☐ PASS / ☐ FAIL | |
| 2 | Trigger / Preview Sound | ☐ PASS / ☐ FAIL | |
| 3 | Waveform Preview Display | ☐ PASS / ☐ FAIL | |
| 4 | Load Sample | ☐ PASS / ☐ FAIL | |
| 5 | Export WAV | ☐ PASS / ☐ FAIL | |
| 6 | Loop Timing | ☐ PASS / ☐ FAIL | |
| 7 | Presets | ☐ PASS / ☐ FAIL | |
| 8 | Undo / Redo | ☐ PASS / ☐ FAIL | |
| 9 | Visual States | ☐ PASS / ☐ FAIL | |
| 10 | Resize / Min Window | ☐ PASS / ☐ FAIL | |
| 11 | Failure / Fallback Handling | ☐ PASS / ☐ FAIL | |

**Tester:** ___________________  
**Date:** ___________________  
**Build hash / version:** ___________________  
**Overall:** ☐ SHIP  ☐ HOLD — Blockers: ___________________

---

*Generated for KickSynth Pro v1 — Synth Tab. Update this checklist when FX, Mixer, and Settings tabs are activated.*
