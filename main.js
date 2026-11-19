import { VERSION, DEFAULTS, makeState, effective, serialize, deserialize } from './engine/state.js';
import { Renderer, jitter } from './engine/renderer.js';
import { VARIATIONS } from './engine/glsl.js';
import { PRESETS } from './engine/presets.js';
import { exportImage, toPNGBlob } from './engine/exporter.js';
import { buildUI } from './ui/controls.js';
import { TABS } from './ui/schema.js';
import { exportVideo, frameState, frameCount } from './engine/video.js';
import { initVideoUI } from './ui/videoui.js';

const BUILD = 'gnarl-studio v' + VERSION;
console.log('[' + BUILD + '] init');
document.getElementById('ver').textContent = 'v' + VERSION;

const $ = id => document.getElementById(id);
const canvas = $('gl'), errBox = $('err');
const S = makeState();
let renderer;
try { renderer = new Renderer(canvas); } catch (e) { showErr(e); throw e; }
function showErr(e) { errBox.textContent = String(e && e.message || e); errBox.classList.remove('hide'); console.error(e); }

let dirty = true, paused = false, busy = false, lastInteract = 0, lastT = performance.now();
const markDirty = () => { dirty = true; };

// ---------- UI ----------
let ui;
const api = {
  changed(key) { if (key === 'fold' || key === 'plane') tryCompile(); markDirty(); },
  loadPreset(i) { Object.assign(S, DEFAULTS, PRESETS[i].s); tryCompile(); ui.refresh(); markDirty(); },
  openExport: () => openModal(),
  pickImage: () => $('fImg').click(),
  setImgMode(m) { S.useimg = m; ui.refresh(); markDirty(); },
  saveFile() { download(new Blob([serialize(S)], { type: 'application/json' }), 'gnarl-settings-v' + VERSION + '.json'); },
  loadFile: () => $('fJson').click(),
};
ui = buildUI($('ui'), S, api);
// start on the approved Mandala Relief look
{ const i = PRESETS.findIndex(p => p.n === 'Mandala Azure Lattice'); if (i >= 0) { Object.assign(S, DEFAULTS, PRESETS[i].s); ui.refresh(); } }

function tryCompile() {
  try { renderer.compile(S.fold, S.plane); errBox.classList.add('hide'); } catch (e) { showErr(e); }
}
tryCompile();

// ---------- image ----------
function loadImageFile(f) {
  if (!f || !f.type.startsWith('image/')) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => { renderer.setImage(img); URL.revokeObjectURL(url); if (!S.useimg) S.useimg = 1; ui.refresh(); markDirty(); };
  img.onerror = () => showErr('Could not read that image.');
  img.src = url;
}
$('fImg').onchange = e => { loadImageFile(e.target.files[0]); e.target.value = ''; };
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); loadImageFile(e.dataTransfer.files[0]); });
$('fJson').onchange = e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  f.text().then(t => { Object.assign(S, deserialize(t)); tryCompile(); ui.refresh(); markDirty(); }).catch(showErr);
};

// ---------- camera ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ptrs = new Map(); let lastPinch = 0;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }); lastInteract = performance.now(); });
canvas.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); lastPinch = 0; markDirty(); });
canvas.addEventListener('pointercancel', e => ptrs.delete(e.pointerId));
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  lastInteract = performance.now();
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (lastPinch) S.camDist = clamp(S.camDist * lastPinch / d, 0.05, 50); lastPinch = d;
  } else if (p.b === 2 || p.shift || e.shiftKey) {
    const k = S.camDist * 0.0016, th = S.camTheta;
    S.tx -= (Math.cos(th) * dx) * k; S.tz += (Math.sin(th) * dx) * k; S.ty += dy * k;
  } else { S.camTheta -= dx * 0.006; S.camPhi = clamp(S.camPhi + dy * 0.006, -1.5, 1.5); }
  ui.refresh(); markDirty();
});
canvas.addEventListener('wheel', e => { e.preventDefault(); S.camDist = clamp(S.camDist * Math.exp(e.deltaY * 0.0012), 0.05, 50); lastInteract = performance.now(); ui.refresh(); markDirty(); }, { passive: false });

// ---------- transport ----------
$('bPlay').onclick = () => { paused = !paused; $('bPlay').textContent = paused ? '▶' : '⏸'; };
$('bCam').onclick = () => { for (const k of ['camTheta','camPhi','camDist','camFov','tx','ty','tz']) S[k] = DEFAULTS[k]; ui.refresh(); markDirty(); };
$('bRand').onclick = () => { S.seed = Math.floor(Math.random() * 100); ui.refresh(); markDirty(); };
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
$('bSnap').onclick = () => {
  const { w, h } = viewSize(false); renderFrame(w, h); while (acc < S.viewAA) refineStep();
  canvas.toBlob(b => download(b, 'gnarl-snapshot-' + stamp() + '.png'));
};
let rec = null, recTrack = null;
$('bRec').onclick = () => {
  if (rec) { rec.stop(); return; }
  // frame-stepped capture: a frame is pushed exactly when one has been rendered (no timer beating against the render loop => no duplicated/skipped frames)
  const stream = canvas.captureStream(0), chunks = []; recTrack = stream.getVideoTracks()[0];
  const mime = ['video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => { download(new Blob(chunks, { type: 'video/webm' }), 'gnarl-' + stamp() + '.webm'); rec = null; recTrack = null; $('bRec').textContent = '⏺ Record'; };
  rec.start(); markDirty(); $('bRec').textContent = '⏹ Stop';
};
const stamp = () => VARIATIONS[S.fold].name.replace(/\W+/g, '') + '-' + Date.now().toString(36);

// ---------- render loop ----------
function viewSize(interacting) {
  const d = Math.min(devicePixelRatio || 1, 2), k = S.viewScale * (interacting ? 0.5 : 1);
  return { w: Math.max(16, Math.round(canvas.clientWidth * d * k)), h: Math.max(16, Math.round(canvas.clientHeight * d * k)) };
}
let acc = 0, accW = 0, accH = 0;
function renderFrame(w, h) {            // sample 0 (opaque); refinement samples are added by the loop when idle
  const e = effective(S, S.t || 0);
  renderer.renderScene(e, w, h); acc = 1; accW = w; accH = h;
  hud(w, h);
}
function hud(w, h) { $('hud').textContent = VARIATIONS[S.fold].name + '  ' + w + '×' + h + '  dist ' + S.camDist.toFixed(2) + (acc > 1 || acc < S.viewAA ? '  ·  ' + acc + '/' + S.viewAA + ' samples' : ''); }
function refineStep() {                  // one more jittered sample blended over the frame
  const e = effective(S, S.t || 0), j = jitter(acc);
  renderer.renderTile(e, { W: accW, H: accH, jx: j[0], jy: j[1], blend: 1 / (acc + 1) }); acc++; hud(accW, accH);
}
S.t = 0;
let wasInteracting = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (busy || renderer.lost) return;
  const clock = !paused && (S.anim || S.autoRot || S.drift || S.orbitLight);
  if (clock) { S.t += dt * S.animSpeed; dirty = true; }
  const interacting = !recTrack && (ptrs.size > 0 || now - lastInteract < 180);   // constant resolution while recording
  if (interacting !== wasInteracting) { wasInteracting = interacting; dirty = true; }
  if (!dirty) {
    if (!clock && !interacting && acc > 0 && acc < S.viewAA) { try { refineStep(); } catch (e) { showErr(e); } }
    return;
  }
  dirty = false;
  try { const { w, h } = viewSize(interacting); renderFrame(w, h); if (clock && !interacting) for (let i = 1; i < S.liveAA; i++) refineStep(); if (recTrack && recTrack.requestFrame) recTrack.requestFrame(); } catch (e) { showErr(e); }
}
new ResizeObserver(markDirty).observe(canvas);
renderer.onRestored = () => { tryCompile(); markDirty(); };
requestAnimationFrame(frame);

// ---------- HQ export ----------
const RES = [['1080p', 1920, 1080], ['1440p', 2560, 1440], ['4K', 3840, 2160], ['5K', 5120, 2880], ['Square 2K', 2048, 2048], ['Square 4K', 4096, 4096], ['8K', 7680, 4320]];
let cancelled = false;
function openModal() {
  $('modal').classList.remove('hide'); $('hqW').value = S.hqW; $('hqH').value = S.hqH; noteUpdate();
  const box = $('resBtns'); box.innerHTML = '';
  RES.forEach(([n, w, h]) => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { $('hqW').value = w; $('hqH').value = h; noteUpdate(); }; box.append(b); });
}
function dims() {
  const m = renderer.maxDim();
  return { W: clamp(parseInt($('hqW').value) || 1920, 64, m), H: clamp(parseInt($('hqH').value) || 1080, 64, m) };
}
function noteUpdate() {
  const { W, H } = dims(), n = S.hqAA * S.hqAA;
  $('hqNote').textContent = W + '×' + H + ' · ' + n + ' samples/pixel · ' + S.hqSteps + ' march steps. Renders in tiles through the same shader as the viewer; frame ' + (S.t || 0).toFixed(2) + 's is frozen.';
}
$('hqW').oninput = $('hqH').oninput = noteUpdate;
$('bHQ').onclick = openModal;
$('hqCancel').onclick = () => { cancelled = true; if (!busy) $('modal').classList.add('hide'); };
$('hqGo').onclick = async () => {
  if (busy) return;
  const { W, H } = dims(); S.hqW = W; S.hqH = H;
  busy = true; cancelled = false; $('hqGo').disabled = true; $('progBar').style.width = '0';
  const e = effective(S, S.t || 0);
  try {
    const t0 = performance.now();
    const img = await exportImage(renderer, e, { W, H, aa: S.hqAA, steps: S.hqSteps, tile: 256 },
      { cancelled: () => cancelled, progress: p => { $('progBar').style.width = (p * 100).toFixed(1) + '%'; $('hqNote').textContent = 'Rendering ' + Math.round(p * 100) + '% · ' + ((performance.now() - t0) / 1000).toFixed(0) + 's'; } });
    if (img) { const blob = await toPNGBlob(img); download(blob, 'gnarl-' + stamp() + '-' + W + 'x' + H + '-v' + VERSION + '.png'); $('hqNote').textContent = 'Done in ' + ((performance.now() - t0) / 1000).toFixed(1) + 's.'; }
    else $('hqNote').textContent = 'Cancelled.';
  } catch (err) { showErr(err); }
  busy = false; $('hqGo').disabled = false; markDirty();
  if (cancelled) $('modal').classList.add('hide');
};

initVideoUI({ S, renderer, setBusy: b => { busy = b; }, after: markDirty, download, stamp, VERSION });

// ---------- test/debug hook (used by tools/validate.mjs) ----------
window.__gnarl = { TABS, jitter, S, renderer, VARIATIONS, PRESETS, DEFAULTS, effective, exportImage, exportVideo, frameState, frameCount, loadPreset: api.loadPreset, BUILD };
