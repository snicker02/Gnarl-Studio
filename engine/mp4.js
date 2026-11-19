// Minimal dependency-free MP4 (ISO BMFF) muxer for ONE H.264 track in 'avc' (length-prefixed) sample format.
// Layout: ftyp | moov | mdat  (moov first = "faststart", plays/streams before fully downloaded). Single chunk, <4 GB.
const T = 90000;   // media + movie timescale
const u8 = (...a) => Uint8Array.from(a);
const u16 = n => u8(n >> 8 & 255, n & 255);
const u32 = (...ns) => { const o = new Uint8Array(ns.length * 4); ns.forEach((n, i) => { n = n >>> 0; o[i*4] = n >>> 24; o[i*4+1] = n >>> 16 & 255; o[i*4+2] = n >>> 8 & 255; o[i*4+3] = n & 255; }); return o; };
const str = s => Uint8Array.from(s, c => c.charCodeAt(0));
const zeros = n => new Uint8Array(n);
function cat(parts) { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }
const box = (type, ...parts) => { const body = cat(parts); return cat([u32(body.length + 8), str(type), body]); };
const full = (type, ver, flags, ...parts) => box(type, u8(ver, flags >> 16 & 255, flags >> 8 & 255, flags & 255), ...parts);
const MATRIX = u32(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000);

export class MP4Muxer {
  constructor({ width, height, description }) {
    if (!description || !description.length) throw new Error('MP4 muxer needs the avcC decoder description');
    this.w = width; this.h = height; this.avcC = new Uint8Array(description); this.s = [];
  }
  // data: length-prefixed H.264 access unit; ts in microseconds (decode order == presentation order, no B-frames)
  addSample(data, tsUs, isKey) { this.s.push({ d: data, ts: Math.round(tsUs * T / 1e6), key: !!isKey }); }
  get duration() { const s = this.s; if (!s.length) return 0; const last = s.length > 1 ? s[s.length-1].ts - s[s.length-2].ts : T / 30; return s[s.length-1].ts - s[0].ts + last; }
  _moov(offset) {
    const s = this.s, n = s.length, dur = this.duration, w = this.w, h = this.h;
    const deltas = s.map((x, i) => i + 1 < n ? s[i+1].ts - x.ts : (n > 1 ? s[i].ts - s[i-1].ts : T / 30));
    const stts = []; for (let i = 0; i < n;) { let j = i; while (j < n && deltas[j] === deltas[i]) j++; stts.push(j - i, deltas[i]); i = j; }
    const keys = []; s.forEach((x, i) => { if (x.key) keys.push(i + 1); });
    const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(w), u16(h), u32(0x480000, 0x480000, 0), u16(1), zeros(32), u16(0x18), u16(0xffff), box('avcC', this.avcC));
    const stbl = box('stbl',
      full('stsd', 0, 0, u32(1), avc1),
      full('stts', 0, 0, u32(stts.length / 2), u32(...stts)),
      full('stss', 0, 0, u32(keys.length), u32(...keys)),
      full('stsc', 0, 0, u32(1), u32(1, n, 1)),
      full('stsz', 0, 0, u32(0, n), u32(...s.map(x => x.d.length))),
      full('stco', 0, 0, u32(1), u32(offset)));
    const minf = box('minf', full('vmhd', 0, 1, zeros(8)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
    const mdia = box('mdia', full('mdhd', 0, 0, u32(0, 0, T, dur), u16(0x55c4), u16(0)), full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('VideoHandler\0')), minf);
    const trak = box('trak', full('tkhd', 0, 3, u32(0, 0, 1, 0, dur), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(w << 16, h << 16)), mdia);
    const mvhd = full('mvhd', 0, 0, u32(0, 0, T, dur, 0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(2));
    return box('moov', mvhd, trak);
  }
  finish() {
    if (!this.s.length) throw new Error('no video samples');
    const ftyp = box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str('avc1'), str('mp41'));
    const mdatSize = this.s.reduce((a, x) => a + x.d.length, 0) + 8;
    if (mdatSize > 0xfffffff0) throw new Error('video larger than 4 GB: lower resolution, duration or quality');
    const moovLen = this._moov(0).length, moov = this._moov(ftyp.length + moovLen + 8);
    return new Blob([ftyp, moov, u32(mdatSize), str('mdat'), ...this.s.map(x => x.d)], { type: 'video/mp4' });
  }
}
