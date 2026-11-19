// Dead-control gate: for every variation, every VISIBLE control must visibly change the picture when changed.
// Run: node tools/deadcontrols.mjs   (needs playwright + chromium)
import { createRequire } from 'node:module'; import { serve } from './serve.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const srv = await serve(8124);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.goto('http://localhost:8124/'); await page.waitForFunction(() => window.__gnarl);
const EXEMPT = ['lightFollow', 'liveAA', 'fold', 'hqSteps', 'hqAA', 'viewScale', 'viewAA', 'steps', 'eps', 'detail', 'stepscale', 'safe', 'animSpeed', 'driftSpeed', 'hqW', 'hqH'];
const res = await page.evaluate((EXEMPT) => {
  const g = window.__gnarl, R = g.renderer, out = [];
  const W = 80, H = 45, grab = () => { R.renderRefined(g.effective(g.S, 1), W, H, 1, { steps: 64 }); return R.readTile(W, H); };
  const differs = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d > 60; };
  for (let f = 0; f < g.VARIATIONS.length; f++) {
    const pi = g.PRESETS.findIndex(p => p.s.fold === f); const dead = new Set(), tested = new Set();
    for (const warp of (f >= 6 ? [0, 0.6] : [0])) {
      g.loadPreset(pi); Object.assign(g.S, { anim: 0, warp: f >= 6 ? warp : g.S.warp, safe: 1 });
      const base = grab();
      for (const tab of g.TABS) for (const it of tab.items) {
        if (!it.key || EXEMPT.includes(it.key) || !['s', 'select', 'toggle'].includes(it.t)) continue;
        if (it.when && !it.when(g.S)) continue;
        const key = it.key, orig = g.S[key]; let v;
        let cands;
        if (it.t === 's') { const up = Math.min(it.max, orig + (it.max - it.min) * 0.3), dn = Math.max(it.min, orig - (it.max - it.min) * 0.3); cands = [up, dn].map(x => it.step >= 1 ? Math.round(x) : x).filter(x => x !== orig); }
        else if (it.t === 'toggle') cands = [orig ? 0 : 1];
        else cands = it.opts.map(o => o[0]).filter(o => o !== orig);
        let now = base;                       // alive if ANY alternative value changes the picture
        for (const v of cands) { g.S[key] = v; const a = grab(); if (differs(base, a)) { now = a; break; } }
        g.S[key] = orig;
        tested.add(key); if (!differs(base, now)) dead.add(key); else dead.delete(key + '!'); if (differs(base, now)) tested.add(key + ':ok');
      }
    }
    // a control is dead only if it never changed the picture in any pass
    const okKeys = new Set([...tested].filter(k => k.endsWith(':ok')).map(k => k.slice(0, -3)));
    out.push({ f, name: g.VARIATIONS[f].name, dead: [...dead].filter(k => !okKeys.has(k)), n: [...tested].filter(k => !k.includes(':')).length });
  }
  return out;
}, EXEMPT);
let bad = 0;
for (const r of res) { const ok = r.dead.length === 0; if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + r.name + ` (${r.n} controls tried)` + (ok ? '' : ' DEAD: ' + r.dead.join(', '))); }
await browser.close(); srv.close(); console.log(bad ? `\n${bad} variation(s) with dead controls` : '\nNO DEAD CONTROLS'); process.exit(bad ? 1 : 0);
