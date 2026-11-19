// Store-only (no compression) ZIP writer, for PNG sequences. files: [{name, blob}]
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; }
export async function zipStore(files) {
  const parts = [], central = []; let off = 0;
  const le = (n, bytes) => { const a = new Uint8Array(bytes); for (let i = 0; i < bytes; i++) a[i] = n / 2 ** (8 * i) & 255; return a; };
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer()), name = new TextEncoder().encode(f.name), crc = crc32(data);
    const common = [le(20, 2), le(0, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2)];
    parts.push(le(0x04034b50, 4), ...common, name, data);
    central.push(le(0x02014b50, 4), le(20, 2), ...common, le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), name);
    off += 30 + name.length + data.length;
  }
  const cdLen = central.reduce((a, p) => a + p.length, 0);
  return new Blob([...parts, ...central, le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(cdLen, 4), le(off, 4), le(0, 2)], { type: 'application/zip' });
}
