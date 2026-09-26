// Brings everything saved in the Doodle Studio into src/art/doodles, where the site's doodle spots
// pick them up. A doodle saved for a spot lands in that spot; others keep the name they were given.
//
// Needs your owner link's key in .env.studio (never committed), as STUDIO_OWNER_KEY=...
// See supabase/studio.sql for making that link.
import { mkdirSync, writeFileSync } from 'node:fs';
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

// Oldest first, so when two doodles share a name, the newest one wins.
const doodles = await res.json();
const slug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const byName = new Map();
const replaced = [];
for (const doodle of doodles) {
  const name = slug(doodle.name) || `studio-${doodle.id.slice(0, 8)}`;
  if (byName.has(name)) replaced.push(name);
  byName.set(name, doodle);
}

const dir = join(root, 'src/art/doodles');
mkdirSync(dir, { recursive: true });
for (const [name, doodle] of byName) {
  writeFileSync(join(dir, `${name}.png`), Buffer.from(doodle.image.replace(/^data:image\/png;base64,/, ''), 'base64'));
  // The strokes and their timing, so the site can redraw it the way it was drawn.
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(doodle.strokes));
  console.log(`  ${name}  (by ${doodle.artist})`);
}

console.log(`\nSaved ${byName.size} doodle${byName.size === 1 ? '' : 's'} to src/art/doodles.`);
if (replaced.length) {
  console.log(`More than one doodle is named ${[...new Set(replaced)].join(', ')}. The newest of each is the one used.`);
}
