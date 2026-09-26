// Brings the Doodle Studio's placed doodles into src/art/doodles, each named after its spot, so the
// site's doodle spots pick them up. (Place them by running `npm run studio` and opening it with your
// own link.) Every doodle, placed or not, is also copied to src/art/studio-archive.
//
// Needs your owner link's key in .env.studio (never committed), as STUDIO_OWNER_KEY=...
// See supabase/studio.sql for making that link.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readEnv } from './env.mjs';

const root = resolve(import.meta.dirname, '..');
const env = { ...readEnv(join(root, '.env')), ...readEnv(join(root, '.env.studio')) };
const { PUBLIC_SUPABASE_URL: url, PUBLIC_SUPABASE_ANON_KEY: anon, STUDIO_OWNER_KEY: key } = env;

if (!key) {
  console.error("Add your owner link's key to .env.studio as STUDIO_OWNER_KEY=... (see supabase/studio.sql).");
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/rpc/studio_export`, {
  method: 'POST',
  headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ key }),
});
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  console.error(`Couldn't get the doodles: ${body.message ?? res.status}`);
  process.exit(1);
}

// Oldest first, so when two doodles are in the same spot, the newest one wins.
const doodles = await res.json();
const bySpot = new Map();
const doubled = new Set();
for (const doodle of doodles.filter((d) => d.spot)) {
  if (bySpot.has(doodle.spot)) doubled.add(doodle.spot);
  bySpot.set(doodle.spot, doodle);
}

const dir = join(root, 'src/art/doodles');
mkdirSync(dir, { recursive: true });

// Remember which files came from the studio, so a doodle moved to another spot doesn't linger in
// its old one. Only these files are ever removed; doodles added by hand are never touched.
const manifest = join(dir, '.from-studio.json');
const before = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : [];
for (const spot of before) {
  if (bySpot.has(spot)) continue;
  rmSync(join(dir, `${spot}.png`), { force: true });
  rmSync(join(dir, `${spot}.json`), { force: true });
  console.log(`  ${spot}  (emptied: nothing is placed there anymore)`);
}

for (const [spot, doodle] of bySpot) {
  writeFileSync(join(dir, `${spot}.png`), Buffer.from(doodle.image.replace(/^data:image\/png;base64,/, ''), 'base64'));
  // The strokes and their timing, so the site can redraw it the way it was drawn.
  writeFileSync(join(dir, `${spot}.json`), JSON.stringify(doodle.strokes));
  console.log(`  ${spot}  "${doodle.name}" by ${doodle.artist}`);
}
writeFileSync(manifest, JSON.stringify([...bySpot.keys()], null, 2));

// A copy of every doodle, placed or not, so nothing is lost once the studio is taken down.
const archive = join(root, 'src/art/studio-archive');
mkdirSync(archive, { recursive: true });
const slug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
for (const doodle of doodles) {
  const file = join(archive, `${slug(doodle.name)}-${doodle.id.slice(0, 8)}`);
  writeFileSync(`${file}.png`, Buffer.from(doodle.image.replace(/^data:image\/png;base64,/, ''), 'base64'));
  writeFileSync(`${file}.json`, JSON.stringify({ name: doodle.name, artist: doodle.artist, saved: doodle.updated_at, ...doodle.strokes }));
}

const unplaced = doodles.filter((d) => !d.spot).length;
console.log(`\nPlaced ${bySpot.size} doodle${bySpot.size === 1 ? '' : 's'} in src/art/doodles.`);
console.log(`Copied all ${doodles.length} to src/art/studio-archive.`);
if (doubled.size) console.log(`More than one doodle is in ${[...doubled].join(', ')}. The newest is the one used.`);
if (unplaced > 0) console.log(`${unplaced} more ${unplaced === 1 ? "isn't" : "aren't"} placed yet.`);
