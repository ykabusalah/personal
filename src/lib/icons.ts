import fs from 'node:fs';
import sharp from 'sharp';

// The site's icons are made from my base head drawing at build time, so the drawing itself never
// sits in git or gets served at full size.
const SOURCE = 'src/art/seasonal/base.png';

async function iconPng(size: number) {
  // No art on this machine: a blank icon keeps the build working.
  if (!fs.existsSync(SOURCE)) {
    return sharp({ create: { width: size, height: size, channels: 3, background: '#ffffff' } }).png().toBuffer();
  }
  const pad = Math.round(size * 0.06);
  return sharp(SOURCE)
    .trim()
    .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background: '#ffffff' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

export async function iconResponse(size: number) {
  return new Response(new Uint8Array(await iconPng(size)), { headers: { 'Content-Type': 'image/png' } });
}

/** An .ico file can simply wrap a PNG: a 6-byte header, one 16-byte entry, then the PNG itself. */
export async function icoResponse(size = 48) {
  const png = await iconPng(size);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return new Response(new Uint8Array(Buffer.concat([header, entry, png])), { headers: { 'Content-Type': 'image/x-icon' } });
}
