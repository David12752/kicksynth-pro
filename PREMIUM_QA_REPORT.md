# KickSynth Pro — Premium QA Report

**Date:** 2026-03-27  
**Reviewer:** Design QA Lead  
**Verdict:** Not shippable yet. Close — but the gaps are the kind customers notice in the first 30 seconds.

---

## 1. Layout Failures / Structural Risks

- **Fixed pixel heights on sections are a time bomb.** `oscSection: 200px`, `ampSection: 160px`, `modSection: 144px`, `characterSection: 200px` — these work at exactly 720px tall. At 900px, 1080px, or 1440px, you get dead space at the bottom or content crammed at the top. No commercial plugin ships with hardcoded section heights that don't flex.
- **`min-width: 1200px` / `min-height: 720px` is too rigid for 2026.** Laptop users on 1366×768 with OS scaling will hit horizontal scroll. The layout should degrade gracefully below 1200px, not clip.
- **Three-column synth grid uses percentage-based columns (`24% / 36% / 40%`) but children have fixed pixel widths.** At narrow widths, knobs overflow their containers. At wide widths, knobs float in empty space with no redistribution.
- **Right column sample slots use `height: calc((100% - 32px) / 3)` with `min-height: 150px`.** If the window is short, three slots × 150px = 450px minimum, which overflows the available space. No scroll fallback exists on this column.
- **`leftCol` has `overflow-y: auto` but `centerCol` and `rightCol` do not.** Inconsistent scroll behavior — content will clip silently in center/right at certain heights.

## 2. Visual Hierarchy Problems

- **Everything is the same visual weight.** Section titles are 8–9px muted text. Knob labels are 9px. Readouts are 9px. There's no clear "look here first" signal. Premium plugins guide the eye: the pitch section or the trigger button should dominate, not compete equally with the drift mode dropdown.
- **The waveform display is undersized.** 120px total height (including padding) for the primary visual feedback of a kick synth is stingy. Serum, Vital, Kick 2 — all give the waveform significant real estate. This should be at least 160–180px or resizable.
- **Tab labels (SYNTH / FX / MIXER / SETTINGS) have no visual distinction from section content.** They're small, unweighted, and buried. The active tab indicator is just a border color change — easy to miss.
- **FX and Mixer tabs are placeholder shells.** The FX grid shows text descriptions with no interactive controls. The mixer faders are default `<input type="range">` with no custom styling on the track. These tabs actively damage perceived quality.

## 3. Spacing / Alignment Issues

- **`characterFooter` grid is `108px 86px 52px 110px` — magic numbers that don't align with anything above.** The knob row above it uses flex with 3px gap. The footer items visually misalign with the knobs they relate to.
- **Filter knobs use 48px width while all other knobs use 52px.** This creates a subtle but noticeable inconsistency in the visual rhythm. The 4px difference cascades into misaligned labels below.
- **`eqFrequencyLabels` is a 4-column grid but the EQ knobs above are in a flex row with 10px gap.** The frequency labels don't align under their respective knobs — they align to a grid that doesn't match the flex layout.
- **Transport bar is a 9-column grid with hardcoded pixel widths.** At 1200px it's fine. At 1600px+ the status text stretches into an awkward void. At exactly 1200px some elements are tight.
- **Knob readouts clip on long values** (e.g., `20000 Hz` at 52px width with 9px font). No `text-overflow` handling.

## 4. What Feels Premium vs Amateur

### Premium ✓
- **Color palette is restrained and professional.** The muted blue accent, dark grays, and subtle borders are genuinely good. No garish neon.
- **Knob component is well-built.** SVG-based, smooth drag interaction, proper arc rendering. This is the quality bar the rest should match.
- **Custom window chrome with minimize/maximize/close.** Correct for a plugin-style app.
- **Undo/redo system with 24-step history.** Thoughtful feature for sound design workflow.
- **Web Audio fallback when JUCE is unavailable.** Smart resilience.

### Amateur ✗
- **Default `<select>` dropdowns everywhere.** The preset selector, filter type, LFO target, drift mode, settings — all use unstyled native selects. These scream "Electron hobby project."
- **Default `<input type="range">` for mixer faders.** The volume slider in Character has custom styling, but the mixer tab faders are raw browser defaults. Inconsistent.
- **Emoji for UI icons** (🎲, 📂, ▶, ↶, ↷). Real products use SVG icon sets. Emoji rendering varies across platforms and looks unpolished.
- **No loading/transition states.** Switching tabs is instant DOM swap with no animation. Triggering a kick has no visual feedback (button press state, waveform flash). It feels static.
- **Settings tab is a grid of dummy selects with single options.** It's clearly non-functional placeholder content shipped as a "tab."

## 5. Resize Behavior Assessment

**Unacceptable for a paid product.**

- Horizontal: works okay from 1200px to ~1600px. Above 1600px, the three-column layout becomes wasteful with too much whitespace in knob rows.
- Vertical: broken. Fixed section heights mean the layout doesn't redistribute vertical space. At 1080p, there's ~300px of unused space that the sections don't claim. At 768p (laptops), the filter section and mod section collide.
- No responsive breakpoints. A $50+ plugin should handle at least 1200–1920px width and 720–1200px height gracefully.
- The `leftCol` scroll fallback is a bandaid, not a solution. Users shouldn't need to scroll to see the oscillator and amp envelope simultaneously.

## 6. Must Fix Before Sale (Blockers)

1. **Replace fixed section heights with flex-grow proportional layout.** Sections must fill available space.
2. **Style or replace native `<select>` elements.** Custom dropdown component or at minimum heavy CSS override.
3. **Replace emoji icons with SVG icons.** 🎲→dice SVG, 📂→folder SVG, etc.
4. **Add visual feedback on trigger.** Button press animation + waveform display flash/pulse.
5. **Fix right column overflow.** Add scroll or reduce minimum heights so 3 sample slots fit at 720px.
6. **Either finish FX/Mixer tabs or hide them.** Shipping placeholder tabs destroys trust. If they're not ready, gate them with "Coming Soon" or remove.
7. **Fix transport bar responsiveness.** It must not break at common widths.

## 7. Can Wait Until Later (Post-v1)

- Resizable waveform display (nice-to-have, not a blocker if increased to 160px)
- Keyboard shortcuts for trigger, undo/redo, tab switching
- Drag-and-drop sample loading
- Dark/light theme toggle (settings tab lists it but it's non-functional)
- Preset save/load/rename to disk
- MIDI learn overlay
- Tooltip system for knobs (hover to see full parameter name + range)
- A/B comparison toggle

## 8. Top 10 Recommendations (Prioritized)

| # | Priority | Recommendation |
|---|----------|---------------|
| 1 | **P0** | Replace all fixed section heights with `flex: <ratio>` proportional growth. Test at 720p, 900p, 1080p, 1440p. |
| 2 | **P0** | Build a custom dropdown component to replace native `<select>`. Every visible select must use it. |
| 3 | **P0** | Replace emoji with a cohesive SVG icon set (Lucide, Phosphor, or custom). |
| 4 | **P0** | Add trigger feedback: button pulse animation, waveform canvas brief highlight, peak meter spike animation. |
| 5 | **P0** | Hide or gate FX/Mixer/Settings tabs if they're non-functional. Ship 1 polished tab, not 4 half-baked ones. |
| 6 | **P1** | Increase waveform display height to 160–180px. It's the visual centerpiece of a kick synth. |
| 7 | **P1** | Add subtle transitions between tabs (opacity fade, 120ms). Static DOM swaps feel cheap. |
| 8 | **P1** | Fix `characterFooter` and `eqFrequencyLabels` alignment to match their parent knob rows. |
| 9 | **P2** | Add a custom-styled scrollbar to all overflow columns, not just `leftCol`. |
| 10 | **P2** | Implement proper resize behavior: sections redistribute space, transport bar adapts, knob rows reflow at extreme widths. |

## 9. Minimum Bar for v1 Commercial Release

A paying customer who opens this app must experience:

1. **Zero layout breakage** at any supported resolution (1200×720 through 1920×1200).
2. **No visible browser/Electron artifacts** — no native selects, no emoji icons, no default range inputs.
3. **Immediate audio + visual feedback** when they click Trigger. The waveform must react. The button must respond.
4. **Only functional tabs visible.** If FX processing isn't wired up, don't show the tab. Customers don't pay for mockups.
5. **Consistent visual language.** Every interactive element must share the same design system: same border radii, same hover states, same typography scale.
6. **The Synth tab must be flawless.** It's 90% of the product. Every knob, every button, every label — pixel-aligned and responsive.

### The Honest Assessment

The synth engine architecture is solid. The knob component is good. The color palette is professional. The parameter model is well-designed with proper undo/redo, presets, and state management.

But the UI has ~15 hours of polish work standing between "impressive side project" and "I'd pay $49 for this." The issues are all surface-level — layout rigidity, unstyled native elements, missing feedback animations, placeholder tabs. None require architectural changes.

**Fix the P0 items. Ship with only the Synth tab if necessary. A focused, polished single-view product beats a multi-tab product with visible seams.**

---

*Report generated for internal QA review. Not for distribution.*
