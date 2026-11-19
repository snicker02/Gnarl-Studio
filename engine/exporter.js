// HQ export: tiles x jittered AA samples, all through Renderer.renderTile (same shader/uniforms as the viewer).
// The canvas only ever holds one tile, so large exports cannot exhaust the GPU or lose the context.
export async function exportImage(renderer, e, opts, hooks = {}) {
  const { W, H, aa = 1, steps, tile = 256 } = opts;
  const out = new Uint8ClampedArray(W * H * 4);
  const n = aa * aa, tilesX = Math.ceil(W / tile), tilesY = Math.ceil(H / tile), total = tilesX * tilesY;
  let done = 0;
  for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
    if (hooks.cancelled && hooks.cancelled()) return null;
    const x = tx * tile, y = ty * tile, w = Math.min(tile, W - x), h = Math.min(tile, H - y);
    const acc = new Float32Array(w * h * 3);
    for (let sy = 0; sy < aa; sy++) for (let sx = 0; sx < aa; sx++) {
      renderer.renderTile(e, { W, H, x, y, w, h, steps, jx: (sx + 0.5) / aa - 0.5, jy: (sy + 0.5) / aa - 0.5 });
      renderer.gl.finish();
      const b = renderer.readTile(w, h);
      for (let i = 0, j = 0; i < w * h; i++, j += 4) { acc[i*3] += b[j]; acc[i*3+1] += b[j+1]; acc[i*3+2] += b[j+2]; }
    }
    // write into the output image, flipping Y (GL origin is bottom-left)
    for (let r = 0; r < h; r++) {
      const dstRow = H - 1 - (y + r);
      for (let c = 0; c < w; c++) {
        const s = (r * w + c) * 3, d = (dstRow * W + x + c) * 4;
        out[d] = acc[s] / n; out[d+1] = acc[s+1] / n; out[d+2] = acc[s+2] / n; out[d+3] = 255;
      }
    }
    done++;
    if (hooks.progress) hooks.progress(done / total);
    await new Promise(r => setTimeout(r, 0));   // keep UI responsive, let the GPU breathe
  }
  return { W, H, data: out };
}

export async function toPNGBlob({ W, H, data }) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('PNG encode failed (image too large for this browser)')), 'image/png'));
}
