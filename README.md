# Solid 3D Gnarl Studio v1.4.5

WebGL1 raymarched gnarl / eye-vortex / mandala-relief renderer. No runtime dependencies.

## Run
* **Easiest:** open `dist/gnarl-studio-standalone.html` (works from disk, one file).
* **Modular source:** `node tools/serve.mjs` then open http://localhost:8080 (ES modules need http, not file://).
* Rebuild the standalone file: `npm i esbuild && node tools/bundle.mjs`.

## Layout
```
index.html  style.css  main.js          app shell, viewer loop, camera, export UI
engine/state.js        flat JSON state, DEFAULTS, effective() (drift/auto-rotate derived from a clock)
engine/uniforms.js     single list that generates BOTH the GLSL declarations and the uniform pushes
engine/glsl.js         shader assembler: only the active variation (+plane flag) is compiled and cached
engine/variations/*.js one file per variation (Gnarly, Sine, FBM, Eye Vortex, Scroll, Mandala)
engine/renderer.js     renderTile(): the ONE render path used by viewer, snapshot and HQ export
engine/exporter.js     tiled, jitter-AA HQ export through renderTile
engine/video.js        offline video export (frameState, WebCodecs H.264, fallbacks)
engine/mp4.js          dependency-free MP4 muxer;  engine/zip.js  store-only zip for PNG sequences
ui/videoui.js          Video export dialog
engine/presets.js      presets (partial overrides on DEFAULTS)
ui/schema.js           every control declared once: key, real min/max, visibility rule
ui/controls.js         builds the sidebar; every control has a reset-to-default button
tools/validate.mjs     headless real-GL gate (see below)
```

## Why images are now consistent
* Viewer and HQ export call the same `renderTile()` with the same shader and uniforms. Export = many 256px tiles x N² sub-pixel jittered samples (jitter is a uniform, not a time nudge, so animation is never disturbed).
* Hit threshold and normal epsilon scale with the pixel footprint, so detail is resolution independent.
* Grain is a static per-pixel hash; drift/auto-rotate are pure functions of time, so a frozen frame re-renders identically.
* Only one variation is compiled at a time (the old uber-shader is gone), so shader compile is fast and GPU-limit errors are far less likely.
* Images upload power-of-two with REPEAT wrap and Y-flip at upload; one `matCol()` feeds surface and glow, so no palette leaks at blend 1.

## 1.4.5
Stability hardening for Mandala Relief and all per-cell randomness: sin-free hashes on exact integer cell ids (sin() of large arguments differs between GPUs and can flip whole cells between frames); cell jitter fades to a flat rim so cell borders no longer have height cliffs. Random layouts change slightly vs 1.4.4 (same style).

## 1.4.4
Live ⏺ Record: frame-stepped capture (a frame is pushed exactly when one is rendered) and constant resolution while recording. The old timer-based capture beat against the render loop and produced duplicated/skipped frames (visible stutter). For exact, glitch-free results use 🎬 Video.

## 1.4.3
Fixed animation flicker: Drift moved the fold offsets, which deep/high-scale folds (e.g. 8 iterations, scale 2.1) amplify chaotically; offset drift is now damped by that sensitivity. New Render setting **Samples per frame while animating** (supersampling for live view and live Record). For flicker-free output use 🎬 Video (offline, anti-aliased).

## 1.4.2
Auto-rotate and turntable no longer swing flat relief plates around to their back: new **Auto-rotate style** (Auto / Sway / Full orbit / Spin in plane). Auto sways plates +/- the sway range and orbits solids.

## 1.4.1
Lights now follow the animated camera (auto-rotate and turntable video), so the view no longer swings into shadow. Toggle: Light tab > "Lights follow animated camera".

## 1.4.0: video export
Click **🎬 Video**. Every frame is rendered offline through the same path as an HQ still (tiles x AA samples), so the result is independent of machine speed and never drops frames.
* **MP4 (H.264)**: WebCodecs encoder + built-in muxer (faststart, plays everywhere). High/Main/Baseline and level chosen automatically from size and frame rate.
* **PNG sequence (.zip)**: lossless frames for editors.
* **Compatibility recorder**: used automatically where WebCodecs H.264 is missing (frames are rendered first, then recorded at exact frame timing with MediaRecorder; MP4 or WebM).
* Options: resolution presets (incl. square/vertical) + custom size, 24/25/30/50/60 fps, duration, quality (bits per pixel), AA samples, march steps.
* Motion: scene animation, turntable orbit (turns, reversible), or both; animation speed; dolly in/out; **ping-pong seamless loop**.
* Start time is the viewer's current time; frame N always equals frame 0, so loops are exact.
* Tested by `tools/videotest.mjs`: frame determinism and loop closure, real H.264 encode verified with ffprobe + full ffmpeg decode, muxer layout, compatibility path, zip CRC.

## 1.3.0: no dead controls
* The Fold sliders only drove the classic variations; the relief variations (6-13) ignored them. Relief variations now share a **Domain** section: Pan X/Y (Offset X/Y), Zoom (Scale), **Warp amount** plus Warp iterations / Warp freq X1-Y2 (a gnarl-style domain warp of the pattern, with its stretch folded into the distance bound), and Rotate X/Y/Z tilts the whole plate.
* Sine Warp now uses Freq Y1/Y2; FBM Warp uses Freq Y2 (z-displacement gain); the fill light now defaults to the front of the plate; Raindrops' Cell randomness no longer saturates; Seed only shows when it can matter.
* `tools/deadcontrols.mjs` tries every visible control on every variation and fails if the picture doesn't change. `npm run validate` runs it after the main gate.

## 1.2.0: wave variations (14 total) + tilt fix
* **Fixed plate tearing / ghosting** when Rotate X/Y was non-zero on any relief variation (incl. Mandala): the slab thickness was measured along the unrotated Z, so the height depended on depth. The whole plate is now tilted as one rigid slab. `tools/validate.mjs` lints for this.
* Ripple Interference spiral arms are whole numbers now (no angular seam).
* **Chladni Plate** - standing-wave modes cos(mx)cos(ny)-cos(nx)cos(my); Petals = m, Ring frequency = n; Blend = sand-line ridges on nodal lines; animation morphs modes.
* **Quasicrystal Waves** - N plane waves at even angles (5, 7, 8 give quasicrystal tilings); Squareness = terrace levels, Blend = terracing.
* **Drum Modes** - vibrating circular membrane cos(F r)cos(m theta); Spiral twist blends standing modes into travelling spiral waves.
* **Raindrops** - random ripple source per cell with decaying circular waves that expand when animated.

## 1.1.0: four new variations (10 total)
All four are bounded relief height-fields (like Mandala), so they keep the distance-safety and consistency guarantees. Plane mode is built in; rotation, symmetry fold, seed and cell randomness all work.
* **Log-Spiral Eyes** - log-polar lattice; cells grow outward along interwoven spiral arms (Petals = arm count, Spiral arm twist).
* **Honeycomb Eyes** - hexagonal lattice of domed, ringed eyes; Squareness morphs round to hex; Spiral spin = whole number of arms.
* **Truchet Weave** - random quarter-arc tiles make endless interwoven ribbons (Ribbon width, Relief height, Ring frequency = ridges).
* **Ripple Interference** - N wave sources (Petals) interfere into moire eyes; Spiral spin twists the waves.

## 1.0.1: stability fixes
* **Distance safety** (Render tab): every variation now reports an honest stretch (Lipschitz) bound and the marcher divides its step by it, so swirl / z-wave / trig-warp stretching no longer makes rays overshoot. On a chaotic Eye Vortex setting (8 iters, tiny cells) coverage went 81% -> 99% and the streaky black bands disappeared. Slider 0 = legacy behaviour.
* Rays that run out of steps right beside a surface now count as hits instead of black holes.
* **Viewer refinement**: when you stop moving, the viewer accumulates up to N jittered samples (default 16), so what you see converges to the same anti-aliased image HQ export produces. Sampling uses the same Halton jitter as export.
* Honest caveat: very high iteration counts on Eye/Scroll/Gnarly solids are intrinsically chaotic. If a look is noisy, drop iterations to 3-5 or use Plane mode for clean relief.

## New in 1.0
Symmetry fold (any variation), cell randomness + seed (Eye Vortex, Mandala), orthographic camera, second fill light, rim light, metallic, custom 4-colour palette, background colours, 4 tonemaps, exposure/contrast/saturation/vignette, ramp-row picker for image ramps, settings save/load (.json), tiled 8K export, render-scale control, viewer drops to half-res while you drag.

## Validation
`node tools/validate.mjs` (needs playwright + chromium) checks: every variation x plane compiles in real WebGL; every preset renders deterministically with real coverage; viewer == tiled-export pixel parity (max diff 0); image modes change output; every slider declares real min/max; no console errors.

Tips: Plane/relief views use camera elevation 0 (head-on to the XY plane). Solid Gnarly/FBM want low iteration counts (2-4) to keep a valid distance estimate.

---
Created with help from Claude AI
