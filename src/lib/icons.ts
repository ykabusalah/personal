import fs from 'node:fs';
import sharp from 'sharp';

// The site's icons are made from my base head drawing at build time, so the drawing itself never
// sits in git or gets served at full size.
const SOURCE = 'src/art/seasonal/base.png';

/**
 * 'transparent' is just the head, for browser tabs and app icons. 'white' puts it on a white square,
 * for the iPhone home screen, which fills see-through areas with black and would swallow the outline.
 */
type Backdrop = 'transparent' | 'white';

async function iconPng(size: number, backdrop: Backdrop = 'transparent') {
  const background = backdrop === 'white' ? '#ffffff' : { r: 0, g: 0, b: 0, alpha: 0 };
  // No art on this machine: a blank icon keeps the build working.
  if (!fs.existsSync(SOURCE)) {
    return sharp({ create: { width: size, height: size, channels: 4, background } }).png().toBuffer();
  }
  const pad = backdrop === 'white' ? Math.round(size * 0.06) : 0;
  const icon = sharp(SOURCE)
    .trim()
    .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background });
  return (backdrop === 'white' ? icon.flatten({ background: '#ffffff' }) : icon).png().toBuffer();
}

export async function iconResponse(size: number, backdrop: Backdrop = 'transparent') {
  return new Response(new Uint8Array(await iconPng(size, backdrop)), { headers: { 'Content-Type': 'image/png' } });
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
