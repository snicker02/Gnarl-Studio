// Flat, JSON-serialisable state. Every key here is a real setting; DEFAULTS also feeds the per-control reset buttons.
export const VERSION = '1.6.0';

export const DEFAULTS = Object.freeze({
  // shape
  fold: 0, iters: 4, scale: 1.4, offx: 0.8, offy: 0.8, offz: 0.8, rx: 0, ry: 0, rz: 0,
  fx1: 3.5, fy1: 3.5, fx2: 2.0, fy2: 2.0, gmode: 1,
  sym: 0, plane: 0, planedepth: 2.0, mirror: 0, seed: 0, jitter: 0.6,
  eyecell: 2.0, eyedepth: 4.0, eyespin: 1.5, eyesq: 2.5,
  scrtile: 2.0, scrroll: 3.0, scrwave: 1.2,
  mpetals: 6, mflat: 0.18, meyeblend: 0.6, spiral: 0.6, twidth: 0.2, warp: 0,
  // march
  steps: 128, eps: 0.001, detail: 1.0, stepscale: 0.9, safe: 1.0,
  // light
  laz: 0.8, lel: 1.2, lint: 1.5, l2az: 2.2, l2el: 0.5, l2int: 0.25, fill: 0.12, sky: 0.4,
  rim: 0.15, shadows: 1, soft: 12, ao: 0.6, aor: 0.5, orbitLight: 0, lightFollow: 1, fog: 0.08,
  // material / colour
  pal: 4, ccyc: 2.5, cshift: 0, spec: 0.8, rough: 0.4, metal: 0, sss: 0.2, glow: 0.35,
  c0: '#1b1b3a', c1: '#c0392b', c2: '#f39c12', c3: '#fdf2c0', bg0: '#02020a', bg1: '#0a0a22',
  // image
  useimg: 0, imgblend: 1.0, imgscale: 1.0, imgrow: 0.5,
  // post
  tonemap: 0, exposure: 1.0, contrast: 1.0, sat: 1.0, vig: 0.0, grain: 0.2,
  // animation
  anim: 1, animSpeed: 0.3, autoRot: 0, rotMode: 0, rotRange: 0.6, drift: 0, driftSpeed: 0.15,
  // camera
  camTheta: 0.4, camPhi: 0.35, camDist: 4.5, camFov: 1.05, tx: 0, ty: 0, tz: 0, ortho: 0, orthoScale: 3.0,
  // viewer / export
  viewScale: 1.0, viewAA: 16, liveAA: 1, hqW: 2560, hqH: 1440, hqSteps: 400, hqAA: 2,
  vidW: 1920, vidH: 1080, vidFps: 30, vidDur: 8, vidMode: 0, vidLoop: 1, vidSpeed: 1, vidTurns: 1, vidDolly: 1, vidQ: 2, vidAA: 2, vidSteps: 200, vidFmt: 0,
});

export function makeState(over = {}) { return { ...DEFAULTS, ...over }; }

// Effective (time-dependent) parameters. Drift and auto-rotate are derived from a clock here
// instead of mutating state, so a viewer frame and an export of the same frame are identical.
// keep lights fixed relative to the camera while the camera is animated (auto-rotate / turntable), so the view never swings into shadow
export function followLight(e, S) {
  if (!S.lightFollow) return e;
  const d = e.camTheta - S.camTheta; e.laz = S.laz - d; e.l2az = S.l2az - d; return e;
}
// Camera/plate motion for auto-rotate and turntable. Mode 0 = auto: flat relief plates sway (never show their back), solids orbit.
export function applyRot(e, S, phase) {
  const m = S.rotMode || (S.fold >= 6 ? 1 : 2);
  if (m === 1) e.camTheta = S.camTheta + S.rotRange * Math.sin(phase);          // sway left/right, stays on the front face
  else if (m === 3) e.rz = S.rz + phase;                                           // spin in the plane of the plate
  else e.camTheta = S.camTheta + phase;                                            // full orbit
  return e;
}
export function effective(S, t) {
  const e = { ...S, time: t };
  if (S.autoRot) applyRot(e, S, t * 0.35);
  if (S.drift) {
    const k = t * S.driftSpeed * 6.28318 * 0.25, a = S.drift;
    // Fold offsets are amplified by ~scale^iters through the iteration, so a fixed drift turns chaotic (flicker) on deep/high-scale folds.
    // Damp the offset drift by that sensitivity so the apparent speed stays calm (1 for shallow folds).
    const df = Math.min(1, Math.sqrt(4 / Math.pow(Math.max(S.scale, 1), S.iters)));
    e.offx += 0.35 * a * df * Math.sin(k * 1.0 + 0.3);
    e.offy += 0.35 * a * df * Math.sin(k * 1.3 + 1.7);
    e.offz += 0.35 * a * df * Math.sin(k * 0.8 + 2.9);
    e.fx1 += 0.5 * a * Math.sin(k * 0.7 + 0.9);
    e.fy1 += 0.5 * a * Math.sin(k * 0.9 + 2.1);
    e.fx2 += 0.3 * a * Math.sin(k * 1.1 + 4.0);
    e.fy2 += 0.3 * a * Math.sin(k * 0.6 + 5.2);
  }
  return followLight(e, S);
}

export function camPos(e) {
  const t = e.camTheta, p = e.camPhi, d = e.camDist;
  return [d * Math.cos(p) * Math.sin(t) + e.tx, d * Math.sin(p) + e.ty, d * Math.cos(p) * Math.cos(t) + e.tz];
}

export function serialize(S) {
  const o = {}; for (const k of Object.keys(DEFAULTS)) o[k] = S[k]; return JSON.stringify({ app: 'gnarl-studio', version: VERSION, state: o }, null, 1);
}
export function deserialize(txt) {
  const j = JSON.parse(txt); const src = j.state || j; const o = {};
  for (const k of Object.keys(DEFAULTS)) if (k in src && typeof src[k] === typeof DEFAULTS[k]) o[k] = src[k];
  return makeState(o);
}
