import { exportVideo, frameCount, autoBitrate, videoSupport, VID_MODES, VID_QUALITY, VID_FORMATS } from '../engine/video.js';
const RES = [['720p', 1280, 720], ['1080p', 1920, 1080], ['1440p', 2560, 1440], ['4K', 3840, 2160], ['Square 1080', 1080, 1080], ['Vertical 1080×1920', 1080, 1920]];
export function initVideoUI(ctx) {
  const { S, renderer, setBusy, after, download, stamp, VERSION } = ctx, $ = id => document.getElementById(id);
  let running = false, cancelled = false, support = { mp4: false, compat: null };
  const F = [   // [key, label, kind, options]
    ['vidFmt', 'Format', 'sel', VID_FORMATS], ['vidFps', 'Frame rate', 'sel', [24, 25, 30, 50, 60], true],
    ['vidW', 'Width', 'num', [64, 8192, 2]], ['vidH', 'Height', 'num', [64, 8192, 2]],
    ['vidDur', 'Duration (s)', 'num', [0.5, 120, 0.5]], ['vidMode', 'Motion', 'sel', VID_MODES],
    ['vidSpeed', 'Animation speed ×', 'num', [0.05, 10, 0.05]], ['vidTurns', 'Turntable turns (− = reverse)', 'num', [-8, 8, 0.25]],
    ['vidDolly', 'Dolly: end distance ×', 'num', [0.2, 4, 0.05]], ['vidQ', 'Quality', 'sel', VID_QUALITY.map(q => q[0])],
    ['vidAA', 'Anti-alias (N×N)', 'num', [1, 5, 1]], ['vidSteps', 'March steps', 'num', [48, 400, 1]],
    ['vidLoop', 'Ping-pong: scene motion plays forward then back (seamless loop)', 'chk'], ['_compat', 'Force compatibility recorder (real-time MediaRecorder)', 'chk']
  ];
  const inputs = {}, form = $('vForm');
  for (const [key, label, kind, opt, numeric] of F) {
    const l = document.createElement('label'); let el;
    if (kind === 'chk') { l.className = 'chk'; el = document.createElement('input'); el.type = 'checkbox'; l.append(el, label); }
    else {
      l.append(label);
      if (kind === 'sel') { el = document.createElement('select'); opt.forEach((o, i) => { const op = document.createElement('option'); op.value = numeric ? o : i; op.textContent = o; el.append(op); }); }
      else { el = document.createElement('input'); el.type = 'number'; [el.min, el.max, el.step] = opt; }
      l.append(el);
    }
    el.oninput = el.onchange = () => { read(); note(); }; inputs[key] = el; form.append(l);
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function read() {
    for (const [key, , kind, opt] of F) {
      if (key === '_compat') continue; const el = inputs[key];
      if (kind === 'chk') S[key] = el.checked ? 1 : 0;
      else { let v = parseFloat(el.value); if (!isFinite(v)) continue; if (kind === 'num') v = clamp(v, opt[0], opt[1]); S[key] = v; }
    }
  }
  function write() { for (const [key, , kind] of F) { if (key === '_compat') continue; const el = inputs[key]; if (kind === 'chk') el.checked = !!S[key]; else el.value = S[key]; } }
  const dims = () => { const m = renderer.maxDim(); return { W: clamp(Math.round(S.vidW) & ~1, 64, m & ~1), H: clamp(Math.round(S.vidH) & ~1, 64, m & ~1) }; };
  function note() {
    const { W, H } = dims(), n = frameCount(S), bps = autoBitrate(S, W, H), mp = S.vidFmt === 0;
    const mode = !mp ? 'PNG sequence' : (support.mp4 && !inputs._compat.checked) ? 'MP4 H.264 (WebCodecs)' : support.compat ? 'compatibility recorder (' + (support.compat.includes('mp4') ? 'MP4' : 'WebM') + ', real-time, slower)' : 'NOT SUPPORTED by this browser — use PNG sequence';
    $('vNote').textContent = W + '×' + H + ' · ' + n + ' frames · ' + S.vidAA ** 2 + ' samples/px · ' + mode + (mp ? ' · ~' + (bps * S.vidDur / 8e6).toFixed(0) + ' MB at ' + (bps / 1e6).toFixed(1) + ' Mbit/s' : '') + '. Start time ' + (S.t || 0).toFixed(2) + 's. Frames render offline, so playback is always smooth.';
  }
  async function open() {
    $('vmodal').classList.remove('hide'); write();
    const box = $('vRes'); box.innerHTML = '';
    RES.forEach(([n, w, h]) => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { S.vidW = w; S.vidH = h; write(); note(); }; box.append(b); });
    support = await videoSupport(S, S.vidW, S.vidH); note();
  }
  $('bVid').onclick = open;
  $('vCancel').onclick = () => { cancelled = true; if (!running) $('vmodal').classList.add('hide'); };
  $('vGo').onclick = async () => {
    if (running) return; read(); const { W, H } = dims(), n = frameCount(S), t0 = S.t || 0;
    running = true; cancelled = false; setBusy(true); $('vGo').disabled = true; $('vBar').style.width = '0';
    const pv = $('vPrev'), pc = pv.getContext('2d'), tmp = document.createElement('canvas');
    try {
      support = await videoSupport(S, W, H);
      const r = await exportVideo(renderer, S, { W, H, fps: S.vidFps, n, format: S.vidFmt, compat: inputs._compat.checked || !support.mp4, bitrate: autoBitrate(S, W, H), aa: S.vidAA, steps: S.vidSteps, t0 }, {
        cancelled: () => cancelled,
        progress: p => { $('vBar').style.width = (p.frame / p.n * 100).toFixed(1) + '%'; $('vNote').textContent = 'Frame ' + p.frame + ' / ' + p.n + ' · ' + p.elapsed.toFixed(0) + 's elapsed · ~' + Math.ceil(p.eta) + 's left'; },
        preview: img => { if (tmp.width !== img.W) { tmp.width = img.W; tmp.height = img.H; } tmp.getContext('2d').putImageData(new ImageData(img.data, img.W, img.H), 0, 0); pc.drawImage(tmp, 0, 0, pv.width, pv.height); }
      });
      if (r) { download(r.blob, 'gnarl-' + stamp() + '-' + W + 'x' + H + '-' + S.vidFps + 'fps-v' + VERSION + '.' + r.ext); $('vNote').textContent = 'Done: ' + r.note + ' · ' + (r.blob.size / 1e6).toFixed(1) + ' MB.'; }
      else $('vNote').textContent = 'Cancelled.';
    } catch (err) { $('vNote').textContent = 'Error: ' + (err && err.message || err); console.error(err); }
    const wasCancelled = cancelled; running = false; setBusy(false); $('vGo').disabled = false; after();
    if (wasCancelled) $('vmodal').classList.add('hide');
  };
  return { open };
}
