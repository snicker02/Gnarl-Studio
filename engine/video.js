// Video export: deterministic offline frame-by-frame render through the same path as HQ stills (exportImage),
// so every frame is as good as an HQ export and independent of how fast the machine is.
import { exportImage, toPNGBlob } from './exporter.js';
import { MP4Muxer } from './mp4.js';
import { zipStore } from './zip.js';
import { effective, followLight, applyRot } from './state.js';

export const VID_MODES = ['Scene animation', 'Turntable (follows Auto-rotate mode)', 'Scene + turntable'];
export const VID_QUALITY = [['Draft', 0.07], ['Standard', 0.14], ['High', 0.25], ['Maximum', 0.5]];   // bits per pixel per frame
export const VID_FORMATS = ['MP4 (H.264)', 'PNG sequence (.zip)'];

export const frameCount = S => Math.max(1, Math.round(S.vidDur * S.vidFps));
export function autoBitrate(S, W, H) { return Math.round(W * H * S.vidFps * VID_QUALITY[S.vidQ][1]); }

// Pure + deterministic: the effective render state for frame i of n. Frame n would equal frame 0, so it is never rendered => seamless loops.
export function frameState(S, i, n, t0) {
  const p = i / n, u = S.vidLoop ? (p < 0.5 ? 2 * p : 2 - 2 * p) : p;   // ping-pong plays the motion forward then back
  const turn = S.vidMode >= 1, scene = S.vidMode !== 1;
  const t = scene ? t0 + u * S.vidDur * S.animSpeed * S.vidSpeed : t0;
  const e = effective(turn ? { ...S, autoRot: 0 } : S, t);
  if (turn) { applyRot(e, S, S.vidTurns * 2 * Math.PI * p); followLight(e, S); }
  if (S.vidDolly !== 1) { const k = 1 + (S.vidDolly - 1) * u * u * (3 - 2 * u); if (S.ortho) e.orthoScale = S.orthoScale * k; else e.camDist = S.camDist * k; }
  return e;
}

// H.264 level from frame size + rate
function avcLevel(W, H, fps) {
  const L = [[0x1f, 921600, 27648000], [0x28, 2097152, 62914560], [0x2a, 2097152, 133693440], [0x33, 9437184, 251658240], [0x34, 9437184, 530841600], [0x3c, 35651584, 1069547520], [0x3e, 35651584, 4278190080]];
  return (L.find(l => W * H <= l[1] && W * H * fps <= l[2]) || L[L.length - 1])[0];
}
const hex = n => n.toString(16).padStart(2, '0');
async function pickConfig(W, H, fps, bitrate) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  for (const prof of ['64', '4d', '42']) {
    const cfg = { codec: 'avc1.' + prof + '00' + hex(avcLevel(W, H, fps)), width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch (_) {}
  }
  return null;
}
export async function videoSupport(S, W, H) {
  const mp4 = !!(await pickConfig(W & ~1, H & ~1, S.vidFps, autoBitrate(S, W, H)));
  const mr = typeof MediaRecorder !== 'undefined' && ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  return { mp4, compat: mr || null };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// opts: {W,H,fps,n,format:0|1,compat:bool,bitrate,aa,steps,t0}   hooks: {cancelled(), progress(info), preview(img)}
// returns {blob, ext, note} or null when cancelled
export async function exportVideo(renderer, S, opts, hooks = {}) {
  const W = opts.W & ~1, H = opts.H & ~1, { fps, n } = opts, t0 = opts.t0 ?? 0, started = performance.now();
  const renderFrame = i => exportImage(renderer, frameState(S, i, n, t0), { W, H, aa: opts.aa, steps: opts.steps, tile: 512 }, { cancelled: hooks.cancelled });
  const report = i => { const el = (performance.now() - started) / 1000, done = i + 1; hooks.progress && hooks.progress({ frame: done, n, elapsed: el, eta: el / done * (n - done) }); };
  const cancelled = () => hooks.cancelled && hooks.cancelled();

  // ---- PNG sequence ----
  if (opts.format === 1) {
    const files = [];
    for (let i = 0; i < n; i++) {
      const img = await renderFrame(i); if (!img || cancelled()) return null;
      hooks.preview && hooks.preview(img);
      files.push({ name: 'frame_' + String(i + 1).padStart(5, '0') + '.png', blob: await toPNGBlob(img) }); report(i);
    }
    return { blob: await zipStore(files), ext: 'zip', note: n + ' PNG frames @ ' + fps + ' fps, ' + W + '×' + H };
  }

  // ---- MP4 via WebCodecs + our muxer ----
  const cfg = opts.compat ? null : await pickConfig(W, H, fps, opts.bitrate);
  if (cfg) {
    let desc = null, err = null; const samples = [];
    const enc = new VideoEncoder({
      output: (chunk, meta) => { if (!desc && meta && meta.decoderConfig && meta.decoderConfig.description) { const q = meta.decoderConfig.description; desc = new Uint8Array(q instanceof ArrayBuffer ? q.slice(0) : q.buffer.slice(q.byteOffset, q.byteOffset + q.byteLength)); } const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({ d, ts: chunk.timestamp, key: chunk.type === 'key' }); },
      error: e => { err = e; }
    });
    enc.configure(cfg);
    const keyEvery = Math.max(1, Math.round(fps * 2));
    for (let i = 0; i < n; i++) {
      const img = await renderFrame(i); if (!img || cancelled()) { try { enc.close(); } catch (_) {} return null; }
      hooks.preview && hooks.preview(img);
      const vf = new VideoFrame(img.data, { format: 'RGBA', codedWidth: W, codedHeight: H, timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: i % keyEvery === 0 }); vf.close();
      while (enc.encodeQueueSize > 3 && !err) await sleep(4);
      if (err) throw err; report(i);
    }
    await enc.flush(); enc.close(); if (err) throw err;
    if (!desc || !samples.length) throw new Error('encoder produced no decoder configuration');
    for (let i = 1; i < samples.length; i++) if (samples[i].ts <= samples[i-1].ts) throw new Error('encoder reordered frames (B-frames); use compatibility mode');
    const mux = new MP4Muxer({ width: W, height: H, description: desc });
    for (const s of samples) mux.addSample(s.d, s.ts, s.key);
    return { blob: mux.finish(), ext: 'mp4', note: 'MP4 H.264 (' + cfg.codec + ') ' + W + '×' + H + ' @ ' + fps + ' fps, ' + (opts.bitrate / 1e6).toFixed(1) + ' Mbit/s' };
  }

  // ---- compatibility: frames -> JPEG store -> real-time frame-stepped MediaRecorder ----
  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('This browser can neither encode H.264 (WebCodecs) nor record video (MediaRecorder). Use PNG sequence.');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
  const jpgs = [];
  for (let i = 0; i < n; i++) {
    const img = await renderFrame(i); if (!img || cancelled()) return null;
    hooks.preview && hooks.preview(img);
    cx.putImageData(new ImageData(img.data, W, H), 0, 0);
    jpgs.push(await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95))); report(i);
  }
  const stream = cv.captureStream(0), track = stream.getVideoTracks()[0], chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: opts.bitrate });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(); const t1 = performance.now();
  for (let i = 0; i < n; i++) {                    // paced against the wall clock so the file has exact frame timing
    const bm = await createImageBitmap(jpgs[i]); cx.drawImage(bm, 0, 0); bm.close();
    if (track.requestFrame) track.requestFrame();
    const wait = t1 + (i + 1) * 1000 / fps - performance.now(); if (wait > 0) await sleep(wait);
    if (cancelled()) { rec.stop(); return null; }
  }
  rec.stop(); await stopped;
  const mp4 = mime.startsWith('video/mp4');
  return { blob: new Blob(chunks, { type: mp4 ? 'video/mp4' : 'video/webm' }), ext: mp4 ? 'mp4' : 'webm', note: 'Compatibility mode (' + mime + '), ' + W + '×' + H + ' @ ' + fps + ' fps' };
}
