# DarkroomPro v1.3.2

**Kit mixing, dilution cleanup and timer fixes**

## Changes

- **Colour kit mixing is now explicit.** Every colour kit shows its actual mixing instructions and kit capacity. Bellini C41-RA now reads **500 ml concentrate + 500 ml water = 1 L, 16 rolls**.
- **Dilution ratio and volume input removed.** The ratio is printed on the developer bottle and named in the developer selector, and tank volume does not affect development time. The result card, mix line and “Working Solution Volume” field are gone.
- **Capacity corrections:** Kodak Flexicolor is listed at 20 rolls per 2.5 L kit (about 8 rolls/L one-shot), Bellini at 16 rolls per 1 L kit, Tetenal C-41 at 16 rolls/L (40 rolls per 2.5 L), CineStill at 24 max (8 rated), Unicolor at 8 rolls/L, Kodak E-6 at 20 rolls per 5 L batch (up to 50 with extended times), Tetenal E-6 at 30 rolls per 2.5 L, Unicolor E-6 at 8 rolls/L.
- **Agitation chimes:** the repeating tick now runs every ~1.1s at a lower, clearly audible pitch, so it is present over a tap or fan without being shrill. A distinct two-tone stop cue plays when the window ends. Only one sound sequence plays at a time; contiguous windows do not trigger an overlapping stop/start pair.
- **Timer cleanup:** pausing or resetting clears the pulsing orange dot, the “Agitate now” text and the completion flash immediately.
- **Kodak E-6 +2 push corrected** to 11:30 rotary / 11:45 manual, following the +5:30 correction in Kodak Z-119.
- Includes 1.3.1’s adjustable B&W rotary compensation and E-6 method-specific first-developer timing.

## Verification

- `cargo test`: 17 tests passing, including colour-kit mixing metadata.
- `npm run test:steps`: passing.
- Browser checks: no dilution card, volume field or mix line; Bellini kit mixing/capacity shown in developer info; 5 chime ticks in a 5s window at 1100 ms spacing and gain 0.12; stop cue plays at 700/520 Hz; pause/reset clears the dot, text and flash; Kodak E-6 +2 push is 11:30 rotary / 11:45 manual.

## Downloads

- **macOS**: `.dmg` (universal)
- **Windows**: `.msi` installer
- **Linux**: `.deb`, `.rpm` or `.AppImage`

> Release builds are unsigned. On macOS, right-click the app and choose **Open** the first time; on Windows, SmartScreen may ask you to confirm.

---

# DarkroomPro v1.3.1

**Adjustable rotary compensation and E-6 method-specific timing**

This is a focused accuracy update on top of 1.3.0.

## Changes

- **Adjustable B&W rotary compensation**: the rotary setting now exposes a compensation field from 0–35%, defaulting to 15%. The 15% figure remains the manufacturer/Massive Dev Chart starting point; independent testing shows 15–35% depending on film and developer, and pre-wetting or a diffusion enlarger can need less. The timer note explains this.
- **E-6 first-developer method switching**: Kodak Z-119 gives 6:15 for manual reels and 6:00 for rotary tubes. The app now applies that ±15s method difference (including push/pull times) for Kodak E-6 and Tetenal E-6. Unicolor E-6 remains at its published single time because no method-specific value is published.
- **Stock labels**: developer info and dilution selectors now show “Stock” instead of “1:0”.
- **Process notes**: explain the rotary percentage, E-6 method adjustment and colour method limitations.

## Verification

- `cargo test`: 17 tests passing, including E-6 agitation-adjustment metadata.
- `npm run test:steps`: passing.
- Checked in the browser: B&W rotary 15% → 4:53, 25% → 4:19; Kodak E-6 manual 6:15 / rotary 6:00; Tetenal E-6 manual 6:15 / rotary 6:00; D-76 labels now read “Stock, 1:1, 1:3”.
- Build and asset workflow are unchanged from 1.3.0.

## Downloads

- **macOS**: `.dmg` (universal)
- **Windows**: `.msi` installer
- **Linux**: `.deb`, `.rpm` or `.AppImage`

> Release builds are unsigned. On macOS, right-click the app and choose **Open** the first time; on Windows, SmartScreen may ask you to confirm.

---

# DarkroomPro v1.3.0

**Agitation, rotary processing and batch reuse**

This release makes the timer usable as a proper darkroom companion: custom agitation schedules, a quiet repeating cue, rotary/continuous processing compensation, and per-batch roll compensation for the colour kits that publish one. It also fixes several calculation and data issues found in a full audit.

## Highlights

### Custom agitation
- Set your own initial agitation (30s by default), then agitate every N seconds for M seconds.
- The timer shows the active prompt and plays a soft, repeating tick during each agitation window - not a triple beep.
- Chimes no longer overlap: one sound sequence at a time; step/completion sounds cancel the agitation tick, and pausing/resetting stops it.
- The agitation controls lock while the timer is running.

### Rotary / continuous processing
- New **Agitation Method** setting: intermittent (inversion) or rotary/continuous.
- For black & white, rotary applies the published **-15%** developer-time adjustment (Ilford / Massive Dev Chart starting point).
- Colour times are **never** reduced by the rotary setting; colour processes already assume continuous agitation.
- Rotary mode suppresses intermittent agitation cues.

### Batch reuse compensation
- New **Rolls already developed** field and **batch capacity** readout.
- Applies only where the kit publishes a rule:
  - **CineStill CS41**: +2% per roll already developed (1 L standard solution; rated 8, up to 24 with added time).
  - **Tetenal Colortec C-41**: +15s per 4-roll block at 38C; +60s per 4-roll block at 30C.
  - **Bellini C41-RA**: +15s per 3-roll block at 38C.
- One-shot and replenished developers show **no published roll-count compensation** rather than a guessed value.
- Batch counts are stored per developer and can be reset from the UI.

### Colour temperature
- C-41/E-6 temperatures are **locked to the kit's standard** and never use the B&W temperature curve.
- Kits that publish an alternative time/temperature table (Tetenal 30C, CineStill low-temp, Tetenal E-6 39C) can opt in explicitly with **Use kit temperature table**.
- Standard values shown: Tetenal 38C, Unicolor 38.9C, CineStill 39C, Kodak Flexicolor 37.8C.

## Fixes and corrections

- **Dilution corrections**: HC-110 Dilution E is 1:47 (six combinations were 1:63/stock); T-Max Developer is 1:4 (five combinations were marked stock). At 500 ml this fixes amounts such as 10/490 ml and 100/400 ml.
- **Rust/JS dilution consistency**: the Rust engine now rounds developer/water amounts to the nearest ml, matching the web engine (e.g. 1:31 at 500 ml -> 16/484).
- **No fabricated colour push/pull**: unsupported combinations are marked "not published" and cannot be selected; forcing one returns an error. B&W still uses the documented Massive Dev Chart fallback.
- **Validation**: B&W temperatures outside 15-30C and volumes outside 100-2000 ml now report a clear error in both engines.
- **Data provenance**: 92 chart-linked rows now name the Massive Dev Chart in their source label; T-Max 400/P3200 datasheet references corrected (F-4043/F-4001); four `c41_development` process labels normalised to `c41`.
- **Tetenal E-6 39C** kept: the instructions specify 7:00 at 39C (vs 6:15 at 38C); this is the kit's published higher-temperature mode, not an inversion error.

## Interface

- Rounded card/control language, clearer Film & Developer / Process sections, and brighter muted text.
- Solid primary Calculate action; ghost buttons are visible; buttons no longer lift under the cursor and use short, stable transitions.
- Native controls follow the dark scheme; selects use a stable custom chevron; the Inter font is preloaded.
- Darkroom Mode no longer opens the fullscreen display automatically. Use the **Auto Fullscreen** option on Start, or press **F** at any time; **Esc** exits.
- The step name no longer pulses during agitation; a small amber dot next to "Agitate now" indicates the active cue.
- Single-step processes no longer show a redundant step chip/segment row.
- The dilution card now shows "Working Solution" for colour instead of repeating "Ready to use".
- Blocking alerts on start/completion/export were replaced with inline feedback.

## Verification

- `cargo test`: 16 tests passing, including bundled-database calculations, temperature tables, dilution metadata and rounding, and refusal of unpublished colour push/pull.
- `npm run test:steps`: all step/cue tests passing.
- Live checks: 47 films, 18 developers, 433 combinations; every combination has a source; rotary 5:45 -> 4:53; Tetenal 4 rolls 3:30, 8 rolls at 30C 10:00; CineStill 4 rolls 3:47; HC-110 E 10/490 ml; T-Max Developer 100/400 ml.

## Downloads

- **macOS**: `.dmg` (universal)
- **Windows**: `.msi` installer
- **Linux**: `.deb`, `.rpm` or `.AppImage`

> Release builds are unsigned. On macOS, right-click the app and choose **Open** the first time; on Windows, SmartScreen may ask you to confirm.

See the [README](https://github.com/Panolix/DarkroomPro/blob/main/README.md) for installation instructions and the full feature list.
