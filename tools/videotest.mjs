// Video export tests. Run: node tools/videotest.mjs   (needs playwright, chromium, ffprobe/ffmpeg)
import { createRequire } from 'node:module'; import { serve } from './serve.mjs'; import { writeFileSync, mkdtempSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const srv = await serve(8131);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8131/'); await page.waitForFunction(() => window.__gnarl);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const dir = mkdtempSync(join(tmpdir(), 'vt-'));
const probe = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]).toString());
const decode = (f) => execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });

// 1. frameState determinism + loop seamlessness
const fs = await page.evaluate(() => {
  const g = window.__gnarl, S = { ...g.S }; const o = {};
  S.vidDur = 8; S.vidFps = 30; S.vidMode = 2; S.vidLoop = 1; S.vidTurns = 1; S.vidDolly = 1.5; S.vidSpeed = 1; S.anim = 1; S.animSpeed = .3;
  const n = g.frameCount(S), A = g.frameState(S, 7, n, 1.25), B = g.frameState(S, 7, n, 1.25);
  o.det = JSON.stringify(A) === JSON.stringify(B);
  const f0 = g.frameState(S, 0, n, 1.25), fn = g.frameState(S, n, n, 1.25);   // frame n == frame 0 modulo a full turn
  o.timeLoop = Math.abs(f0.time - fn.time) < 1e-9; o.dollyLoop = Math.abs(f0.camDist - fn.camDist) < 1e-9;
  o.turnLoop = Math.abs(((fn.camTheta - f0.camTheta) / (2 * Math.PI)) - 1) < 1e-9;
  o.n = n; o.mid = g.frameState(S, n / 2, n, 1.25).time > f0.time;
  return o;
});
ok(fs.det, 'frameState deterministic'); ok(fs.timeLoop && fs.dollyLoop && fs.turnLoop, 'ping-pong + dolly + 360° turntable loop seamlessly'); ok(fs.n === 240 && fs.mid, '8 s @ 30 fps = 240 frames, scene time advances');

// 1b. lights follow the animated camera: light direction relative to camera is constant under auto-rotate
const lf = await page.evaluate(() => { const g = window.__gnarl, S = { ...g.S, autoRot: 1, lightFollow: 1 }; const a = g.effective(S, 0), b = g.effective(S, 7); const off = { ...S, lightFollow: 0 }; const c = g.effective(off, 0), d = g.effective(off, 7);
  return { rel: (b.laz + b.camTheta) - (a.laz + a.camTheta), rel2: (b.l2az + b.camTheta) - (a.l2az + a.camTheta), fixed: d.laz - c.laz }; });
ok(Math.abs(lf.rel) < 1e-9 && Math.abs(lf.rel2) < 1e-9 && lf.fixed === 0, 'lights keep their angle relative to the auto-rotating camera (and stay fixed when toggled off)');
// 1c. relief plates never rotate to their back during auto-rotate; solids still orbit; spin mode rotates in plane
const rm = await page.evaluate(() => { const g = window.__gnarl; const run = (fold, extra) => { const S = { ...g.S, fold, autoRot: 1, rotMode: 0, rotRange: 0.6, ...extra }; let mx = 0; for (let t = 0; t < 200; t += 0.5) mx = Math.max(mx, Math.abs(g.effective(S, t).camTheta - S.camTheta)); return { mx, rz: g.effective(S, 10).rz - S.rz }; };
  return { relief: run(9, {}), solid: run(0, {}), spin: run(9, { rotMode: 3 }), orbit: run(9, { rotMode: 2 }) }; });
ok(rm.relief.mx <= 0.6 + 1e-9 && rm.relief.mx > 0.5, 'relief plate auto-rotate sways within +/-0.6 rad (max ' + rm.relief.mx.toFixed(2) + ')');
ok(rm.solid.mx > 6 && rm.orbit.mx > 6, 'solids / forced orbit still go all the way round');
ok(rm.spin.mx === 0 && Math.abs(rm.spin.rz - 3.5) < 1e-9, 'spin mode rotates in the plane, camera fixed');
// 2. MP4 muxer: synthetic H.264 from ffmpeg -> demux with our own parser? Instead: encode real frames via WebCodecs, mux with our muxer, verify with ffprobe + full decode
const hasVE = await page.evaluate(() => typeof VideoEncoder !== 'undefined');
async function runVideo(name, o) {
  const b64 = await page.evaluate(async (o) => {
    const g = window.__gnarl; g.loadPreset(14); g.S.anim = 0; g.S.autoRot = 0; g.S.drift = 0; Object.assign(g.S, o.S);
    const n = g.frameCount(g.S); let prog = 0;
    const r = await g.exportVideo(g.renderer, g.S, { W: g.S.vidW, H: g.S.vidH, fps: g.S.vidFps, n, format: o.format, compat: o.compat, bitrate: o.bitrate, aa: 1, steps: 64, t0: 0 }, { progress: () => prog++ });
    const buf = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
    return { b64: btoa(s), ext: r.ext, note: r.note, prog, n };
  }, o);
  const f = join(dir, name + '.' + b64.ext); writeFileSync(f, Buffer.from(b64.b64, 'base64')); return { f, ...b64 };
}
if (hasVE) {
  const v = await runVideo('h264', { S: { vidW: 320, vidH: 180, vidFps: 12, vidDur: 1, vidMode: 1, vidLoop: 0, vidQ: 2 }, format: 0, compat: false, bitrate: 2e6 });
  const p = probe(v.f), st = p.streams[0];
  ok(v.ext === 'mp4' && st.codec_name === 'h264', 'real WebCodecs H.264 encode -> .mp4 (' + v.note + ')');
  ok(+st.width === 320 && +st.height === 180 && st.r_frame_rate === '12/1' && +st.nb_frames === 12, `ffprobe: ${st.width}x${st.height} ${st.r_frame_rate} ${st.nb_frames} frames`);
  ok(Math.abs(+p.format.duration - 1) < 0.05, 'duration ' + p.format.duration + ' s');
  let dec = ''; try { dec = decode(v.f).toString(); } catch (e) { dec = 'ERR ' + e.stderr; } ok(dec === '', 'ffmpeg decodes every frame without errors' + (dec ? ' :: ' + dec.slice(0, 200) : ''));
  // faststart: moov before mdat
  const bytes = (await import('node:fs')).readFileSync(v.f); ok(bytes.indexOf('moov') < bytes.indexOf('mdat'), 'faststart (moov before mdat)');
  // frame content: decode frame 0 and frame 24 and make sure they differ (turntable) and are not blank
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', v.f, '-vf', 'select=eq(n\\,0)', '-frames:v', '1', join(dir, 'a.png')]); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', v.f, '-vf', 'select=eq(n\\,6)', '-frames:v', '1', join(dir, 'b.png')]);
  const sz = ['a', 'b'].map(k => (execFileSync('ffmpeg', ['-v', 'error', '-i', join(dir, k + '.png'), '-f', 'rawvideo', '-pix_fmt', 'gray', '-']).length)); 
  const raw = k => execFileSync('ffmpeg', ['-v', 'error', '-i', join(dir, k + '.png'), '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1e8 }); const ra = raw('a'), rb = raw('b'); let df = 0, mx = 0, mn = 255; for (let i = 0; i < ra.length; i++) { df += Math.abs(ra[i] - rb[i]); mx = Math.max(mx, ra[i]); mn = Math.min(mn, ra[i]); }
  ok(df / ra.length > 1 && mx - mn > 60, `decoded frames are real images and differ over time (mean diff ${(df / ra.length).toFixed(1)}, range ${mn}-${mx})`);
} else console.log('SKIP real WebCodecs H.264 encode: VideoEncoder unavailable in this browser');
// compat path
const c = await runVideo('compat', { S: { vidW: 160, vidH: 90, vidFps: 12, vidDur: 1, vidMode: 0, vidLoop: 1 }, format: 0, compat: true, bitrate: 1e6 });
{ const p = probe(c.f); ok(p.streams[0].codec_name && +p.streams[0].width === 160, `compatibility recorder output decodes (${c.ext}, ${p.streams[0].codec_name}, ${p.format.duration}s)`); }
// png sequence
const z = await runVideo('seq', { S: { vidW: 96, vidH: 54, vidFps: 4, vidDur: 1, vidMode: 2 }, format: 1, compat: false, bitrate: 1e6 });
{ const lst = execFileSync('unzip', ['-l', z.f]).toString(); ok(/frame_00004\.png/.test(lst) && !/frame_00005/.test(lst), 'PNG sequence zip has exactly 4 frames'); execFileSync('unzip', ['-tq', z.f]); ok(true, 'zip passes integrity test (CRC)'); }
ok(logs.length === 0, 'no console errors' + (logs.length ? ' :: ' + logs.join(' | ') : ''));
await browser.close(); srv.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
