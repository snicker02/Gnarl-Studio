// Headless validation against real WebGL. Run: node tools/validate.mjs   (needs playwright + chromium)
import { createRequire } from 'node:module'; import { serve } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
// static gate: relief variations must measure depth in the ROTATED frame (pr.z), never the raw pos.z -- that bug tears tilted plates
{ const { VARIATIONS } = await import('../engine/glsl.js');
  for (const V of VARIATIONS) if (V.ownPlane) { const bad = /\bpos\.z\b/.test(V.glsl.replace(/vec3 pr=[^;]*pos;/, '')); console.log((bad ? 'FAIL ' : 'PASS ') + 'relief variation "' + V.name + '" uses rotated depth'); if (bad) process.exitCode = 1; } }
const srv = await serve(8123);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8123/'); await page.waitForFunction(() => window.__gnarl);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const res = await page.evaluate(async () => {
  const g = window.__gnarl, R = g.renderer, out = { compile: [], presets: [], dom: [] };
  const W = 160, H = 90;
  const stats = (b) => { let hit = 0, lum = 0, nan = 0, n = W * H; for (let i = 0; i < n; i++) { const r = b[i*4], gg = b[i*4+1], bb = b[i*4+2]; lum += (r+gg+bb)/3; } return { lum: lum / n }; };
  // 1. compile every variation x plane
  for (let f = 0; f < g.VARIATIONS.length; f++) for (const p of [0, 1]) {
    const t0 = performance.now();
    try { R.compile(f, p); out.compile.push({ f, p, ok: true, ms: Math.round(performance.now() - t0) }); } catch (e) { out.compile.push({ f, p, ok: false, err: e.message.slice(0, 400) }); }
  }
  // 2. every preset renders something sensible and deterministically
  for (let i = 0; i < g.PRESETS.length; i++) {
    g.loadPreset(i); const e = g.effective(g.S, 1.0);
    R.renderScene(e, W, H, { steps: 96 }); const a = R.readTile(W, H);
    R.renderScene(e, W, H, { steps: 96 }); const b = R.readTile(W, H);
    let same = true, bg = 0; const c0 = [a[0], a[1], a[2]];
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) { same = false; break; }
    let distinct = new Set(); for (let k = 0; k < W * H; k += 7) distinct.add((a[k*4] >> 4) + ',' + (a[k*4+1] >> 4) + ',' + (a[k*4+2] >> 4));
    let cov = 0; for (let k = 0; k < W * H; k++) if (a[k*4] + a[k*4+1] + a[k*4+2] > 45) cov++;
    out.presets.push({ n: g.PRESETS[i].n, cov: cov / (W * H), same, distinct: distinct.size, lum: stats(a).lum, glErr: R.gl.getError() });
  }
  // 3. viewer vs tiled export parity (aa=1, awkward tile size, steps equal)
  g.loadPreset(14); const e = g.effective(g.S, 2.5);
  R.renderScene(e, 200, 120, { steps: 128 }); const v = R.readTile(200, 120);
  const ex = await g.exportImage(R, e, { W: 200, H: 120, aa: 1, steps: 128, tile: 64 });
  let maxd = 0; for (let y = 0; y < 120; y++) for (let x = 0; x < 200; x++) for (let c = 0; c < 3; c++) { const d = Math.abs(v[((119 - y) * 200 + x) * 4 + c] - ex.data[(y * 200 + x) * 4 + c]); if (d > maxd) maxd = d; }
  out.parity = maxd;
  // 4. image modes change the output; blend=1 mode 2 differs from palette
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; const cx = cv.getContext('2d');
  cx.fillStyle = '#0f0'; cx.fillRect(0, 0, 32, 32); cx.fillStyle = '#f0f'; cx.fillRect(32, 0, 32, 32);
  R.setImage(cv); out.aspect = R.imgAspect;
  const sig = () => { R.renderScene(g.effective(g.S, 1), 96, 54, { steps: 96 }); const b = R.readTile(96, 54); let r = 0, gg = 0, bb = 0; for (let i = 0; i < 96 * 54; i++) { r += b[i*4]; gg += b[i*4+1]; bb += b[i*4+2]; } return [r, gg, bb]; };
  g.loadPreset(14); g.S.useimg = 0; const s0 = sig(); g.S.useimg = 1; g.S.imgblend = 1; const s1 = sig(); g.S.useimg = 2; const s2 = sig();
  out.img = { s0, s1, s2 };
  // 4b. consistency gate on a chaotic user setting (Eye Vortex, 8 iters, tiny cells): coverage + resolution agreement
  const brad = { fold: 3, iters: 8, scale: 2.1, offx: 1, offy: 1, offz: 1, fx1: 4.5, fy1: 4.5, fx2: 2.5, fy2: 2.5, eyecell: 0.4, eyedepth: 7, eyespin: -0.35, eyesq: 3.2, jitter: 0.6, camDist: 3, camTheta: 0.3, camPhi: 0.3, anim: 0 };
  const cons = (n, safe) => { g.loadPreset(0); Object.assign(g.S, brad, { safe }); const e = g.effective(g.S, 1), w = 120, h = 68;
    R.renderRefined(e, w, h, n, { steps: 160 }); const lo = R.readTile(w, h); R.renderRefined(e, w * 2, h * 2, n, { steps: 160 }); const hi = R.readTile(w * 2, h * 2);
    let d = 0, cov = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { for (let c = 0; c < 3; c++) { let s = 0; for (const [dx, dy] of [[0,0],[1,0],[0,1],[1,1]]) s += hi[((2*y+dy)*w*2 + 2*x+dx)*4 + c]; d += Math.abs(lo[(y*w+x)*4+c] - s/4); } const i = (y*w+x)*4; if (lo[i]+lo[i+1]+lo[i+2] > 45) cov++; }
    return { diff: d / (w*h*3), cov: cov / (w*h) }; };
  out.legacy = cons(1, 0); out.fixed1 = cons(1, 1); out.fixed8 = cons(8, 1);
  // refinement with n=1 must equal the plain viewer path
  g.loadPreset(14); { const e = g.effective(g.S, 1); R.renderScene(e, 96, 54, { steps: 96 }); const a = R.readTile(96, 54); R.renderRefined(e, 96, 54, 1, { steps: 96 }); const b2 = R.readTile(96, 54); let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b2[i])); out.refine1 = m; }
  // 5. UI sliders: declared min/max contain defaults and live values
  document.querySelectorAll('.pane input[type=range]').forEach(r => out.dom.push({ min: +r.min, max: +r.max, v: +r.value }));
  return out;
});
for (const c of res.compile) ok(c.ok, `compile variation ${c.f} plane=${c.p}` + (c.ok ? ` (${c.ms}ms)` : ' :: ' + c.err));
for (const p of res.presets) ok(p.same && p.distinct > 3 && p.cov > 0.15 && p.glErr === 0, `preset "${p.n}" deterministic, coverage=${(p.cov*100).toFixed(0)}%, colours=${p.distinct}`);
ok(res.fixed1.cov > 0.9 && res.legacy.cov < res.fixed1.cov, `distance safety fills holes on chaotic setting: coverage ${(res.legacy.cov*100).toFixed(0)}% -> ${(res.fixed1.cov*100).toFixed(0)}%`);
ok(res.fixed1.diff < res.legacy.diff, `distance safety improves resolution agreement: ${res.legacy.diff.toFixed(1)} -> ${res.fixed1.diff.toFixed(1)}`);
ok(res.fixed8.diff < res.fixed1.diff * 0.75, `progressive refinement converges: ${res.fixed1.diff.toFixed(1)} -> ${res.fixed8.diff.toFixed(1)} (8 samples)`);
ok(res.refine1 === 0, 'refined n=1 == plain viewer frame');
ok(res.parity === 0, `viewer == tiled export pixel parity (max diff ${res.parity})`);
const d = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);
ok(d(res.img.s0, res.img.s1) > 1000, 'image colour-ramp mode changes output');
ok(d(res.img.s0, res.img.s2) > 1000, 'image surface-map mode changes output');
ok(Math.abs(res.aspect - 2) < 1e-6, 'image aspect recorded');
ok(res.dom.length > 40 && res.dom.every(r => r.max > r.min), `all ${res.dom.length} sliders declare real min/max`);
ok(logs.length === 0, 'no console/page errors' + (logs.length ? ' :: ' + logs.join(' | ') : ''));
await page.screenshot({ path: process.argv[2] || 'validate-shot.png' });
await browser.close(); srv.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
