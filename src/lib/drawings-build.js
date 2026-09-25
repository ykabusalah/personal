// Build-time only: turns approved visitor drawings into vector SVGs so they stay sharp at full-screen size.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import potrace from 'potrace';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Supersampling before tracing lets the outline follow soft stroke edges instead of pixel steps.
const SUPERSAMPLE = 3;
const PAD = 4;
const INK_THRESHOLD = 110;
const TRACE_OPTIONS = { threshold: 128, turdSize: 20, optTolerance: 0.4, alphaMax: 1, color: '#111' };

// Tracing all drawings takes several seconds, and a submitted drawing never changes, so each trace is
// saved and reused. Changing any tracing setting above changes the key, which retraces everything.
const CACHE_DIR = path.resolve('node_modules/.cache/drawings');
const SETTINGS_KEY = createHash('sha1')
  .update(JSON.stringify({ SUPERSAMPLE, PAD, INK_THRESHOLD, TRACE_OPTIONS }))
  .digest('hex')
  .slice(0, 8);

async function traceCached(drawing) {
  const file = path.join(CACHE_DIR, `${drawing.id}-${SETTINGS_KEY}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  const result = await trace(drawing.image_url);
  if (result) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(result)).catch(() => {});
  }
  return result;
}

async function fetchApproved() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/drawings?select=id,image_url&status=eq.approved`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function trace(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // Ink strength per pixel: dark and opaque. Works for transparent PNGs and black-on-white art.
  const ink = new Uint8Array(w * h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    const a = Math.min(data[p + 3], 255 - lum);
    ink[i] = a;
    if (a > INK_THRESHOLD) {
      const x = i % w, y = (i - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;

  const left = Math.max(0, x0 - PAD);
  const top = Math.max(0, y0 - PAD);
  const cw = Math.min(w, x1 + PAD + 1) - left;
  const ch = Math.min(h, y1 + PAD + 1) - top;
  const gray = Buffer.alloc(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) gray[y * cw + x] = 255 - ink[(y + top) * w + x + left];
  }
  const png = await sharp(gray, { raw: { width: cw, height: ch, channels: 1 } })
    .resize(cw * SUPERSAMPLE, ch * SUPERSAMPLE, { kernel: 'cubic' })
    .png()
    .toBuffer();
  const svg = await new Promise((resolve, reject) =>
    potrace.trace(png, TRACE_OPTIONS, (err, out) => (err ? reject(err) : resolve(out)))
  );
  return { svg, ratio: cw / ch };
}

let approvedCount;

/** How many drawings are approved, for the count on Home. The page updates it live after loading. */
export function getApprovedCount() {
  approvedCount ??= fetchApproved().then((drawings) => drawings.length);
  return approvedCount;
}

let traced;

/** Every approved drawing that has ink, traced once and then read from the cache. */
export function getTracedDrawings() {
  traced ??= (async () => {
    const drawings = await fetchApproved();
    const results = [];
    for (let i = 0; i < drawings.length; i += 4) {
      const batch = drawings.slice(i, i + 4);
      const out = await Promise.all(batch.map((d) => traceCached(d).catch(() => null)));
      out.forEach((t, j) => t && results.push({ id: batch[j].id, ...t }));
    }
    return results;
  })();
  return traced;
}
