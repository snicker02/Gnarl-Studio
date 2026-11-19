import { FLOATS, INTS, COLORS, lin3 } from './uniforms.js';
import { VS, buildFragment, VARIATIONS } from './glsl.js';
import { camPos } from './state.js';

// Halton(2,3) sub-pixel jitter in [-0.5,0.5]; k=0 is the pixel centre.
export function jitter(k) {
  if (k === 0) return [0, 0];
  const h = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  return [h(k, 2) - 0.5, h(k, 3) - 0.5];
}

// One renderer, one entry point: renderTile(). The live viewer is a single full-frame tile;
// HQ export is many tiles x many jittered samples through the exact same shader and uniforms.
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('WebGL not available');
    this.programs = new Map();
    this.cur = null;
    this.lost = false;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.programs.clear(); this.cur = null; this._init(); this.onRestored && this.onRestored(); });
    this._init();
  }
  _init() {
    const gl = this.gl;
    this.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255]));
    this.imgAspect = 1; this.hasImage = false;
    if (this.pendingImage) this.setImage(this.pendingImage);
  }
  maxDim() { return Math.min(this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE), 8192); }

  compile(fold, plane) {
    const key = fold + ':' + (plane ? 1 : 0);
    if (this.programs.has(key)) return this.programs.get(key);
    const gl = this.gl;
    const mk = (type, src) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('Shader compile (' + VARIATIONS[fold].name + (plane ? ' plane' : '') + '): ' + gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, buildFragment(fold, plane)));
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(prog));
    const loc = {};
    const names = ['u_res','u_origin','u_jit','u_cam_pos','u_cam_target','u_tex',
      ...FLOATS.map(k => 'u_' + k), ...INTS.map(k => 'u_' + k), ...COLORS.map(k => 'u_' + k)];
    gl.useProgram(prog);
    for (const n of names) loc[n] = gl.getUniformLocation(prog, n);
    const p = { prog, loc };
    this.programs.set(key, p); return p;
  }

  setImage(img) {
    if (this.lost) { this.pendingImage = img; return; }
    const gl = this.gl, N = 1024;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, N, N);
    this.imgAspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    this.hasImage = true; this.pendingImage = img;
  }

  // e: effective state. o: {W,H (full frame), x,y,w,h (tile), jx,jy (-0.5..0.5), steps}
  renderTile(e, o) {
    const gl = this.gl, cv = this.canvas;
    const { W, H } = o, x = o.x || 0, y = o.y || 0, w = o.w || W, h = o.h || H;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    const { prog, loc } = this.compile(e.fold, e.plane);
    if (this.cur !== prog) { gl.useProgram(prog); this.cur = prog; }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(loc.u_res, W, H); gl.uniform2f(loc.u_origin, x, y); gl.uniform2f(loc.u_jit, o.jx || 0, o.jy || 0);
    gl.uniform3f(loc.u_cam_pos, ...camPos(e)); gl.uniform3f(loc.u_cam_target, e.tx, e.ty, e.tz);
    const ev = { ...e, imgaspect: this.imgAspect, steps: o.steps || e.steps };
    for (const k of FLOATS) gl.uniform1f(loc['u_' + k], ev[k]);
    for (const k of INTS) gl.uniform1i(loc['u_' + k], k === 'useimg' ? (this.hasImage ? ev.useimg : 0) : ev[k] | 0);
    for (const k of COLORS) gl.uniform3f(loc['u_' + k], ...lin3(ev[k]));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(loc.u_tex, 0);
    // progressive refinement: blend this jittered sample over the framebuffer with weight 1/(k+1)
    if (o.blend !== undefined && o.blend < 1) { gl.enable(gl.BLEND); gl.blendColor(0, 0, 0, o.blend); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); }
    else gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
  }

  // Full converged frame: sample 0 opaque, samples 1..n-1 blended with 1/(k+1). Same jitter sequence everywhere.
  renderRefined(e, W, H, n, o = {}) {
    for (let k = 0; k < n; k++) { const j = jitter(k); this.renderTile(e, { W, H, ...o, jx: j[0], jy: j[1], blend: k ? 1 / (k + 1) : 1 }); }
  }

  // Viewer / snapshot path: full frame, one tile.
  renderScene(e, W, H, o = {}) { this.renderTile(e, { W, H, ...o }); }

  readTile(w, h) { const b = new Uint8Array(w * h * 4); this.gl.readPixels(0, 0, w, h, this.gl.RGBA, this.gl.UNSIGNED_BYTE, b); return b; }
}
