// The Doodle Studio (studio/): a private drawing page for the site's doodles, hosted on its own.
//
//   node scripts/studio.mjs serve   try it on this computer (npm run studio)
//   node scripts/studio.mjs build   package it for Vercel (npm run studio:deploy does this, then uploads)
//
// Two files are made fresh each time instead of living in studio/: config.js (the public Supabase
// values from .env) and spots.js (every doodle spot on the site, from src/data/doodle-spots.js). Only the
// copy served on this computer gets the spots; the online studio gets an empty list, so artists
// never see where their doodles go.
import { createServer } from 'node:http';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readEnv } from './env.mjs';

const root = resolve(import.meta.dirname, '..');
const studio = join(root, 'studio');
const PORT = 4330;
const FILES = ['index.html', 'studio.css', 'studio.js', 'ink.js', 'api.js'];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

function configJs(local) {
  const env = readEnv(join(root, '.env'));
  const config = { supabaseUrl: env.PUBLIC_SUPABASE_URL, anonKey: env.PUBLIC_SUPABASE_ANON_KEY, local };
  if (!config.supabaseUrl || !config.anonKey) throw new Error('.env needs PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.');
  return `export default ${JSON.stringify(config, null, 2)};\n`;
}

/** Every doodle spot on the site (src/data/doodle-spots.js), read fresh so edits show up right away. */
async function findSpots() {
  const registry = pathToFileURL(join(root, 'src/data/doodle-spots.js'));
  const { DOODLE_SPOTS } = await import(`${registry}?t=${Date.now()}`);
  return DOODLE_SPOTS.map(({ id, idea, width, page }) => ({ name: id, note: idea, width, page: `the ${page} page` }));
}

const spotsJs = async () => `export default ${JSON.stringify(await findSpots(), null, 2)};\n`;

function serve() {
  createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = path === '/' ? 'index.html' : path.slice(1);
    const send = (status, type, body) => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(body);
    };
    try {
      if (file === 'config.js') return send(200, TYPES['.js'], configJs(true));
      if (file === 'spots.js') return send(200, TYPES['.js'], await spotsJs());
      if (!FILES.includes(file)) return send(404, 'text/plain', 'Not found');
      send(200, TYPES[extname(file)], readFileSync(join(studio, file)));
    } catch (err) {
      send(500, 'text/plain', String(err.message));
    }
  }).listen(PORT, () => console.log(`Doodle Studio: http://localhost:${PORT}/#key=local (practice mode, saves in your browser only)`));
}

// Vercel's prebuilt format, like the site's own deploy: the files, plus headers that keep the
// studio out of search engines and keep its address from leaking to other sites.
function build() {
  const out = join(studio, '.vercel/output');
  // Clear out old files one by one rather than deleting the folder, which OneDrive can hold open.
  mkdirSync(join(out, 'static'), { recursive: true });
  for (const old of readdirSync(join(out, 'static'))) rmSync(join(out, 'static', old), { recursive: true, force: true });
  for (const file of FILES) writeFileSync(join(out, 'static', file), readFileSync(join(studio, file)));
  writeFileSync(join(out, 'static/config.js'), configJs(false));
  // The online studio knows nothing about the site. Placing doodles happens on this computer only.
  writeFileSync(join(out, 'static/spots.js'), 'export default [];\n');
  writeFileSync(
    join(out, 'config.json'),
    JSON.stringify({
      version: 3,
      routes: [
        {
          src: '/(.*)',
          headers: {
            'X-Robots-Tag': 'noindex, nofollow, noai, noimageai',
            'Referrer-Policy': 'no-referrer',
            'X-Frame-Options': 'DENY',
            'Cache-Control': 'no-cache',
          },
          continue: true,
        },
      ],
    }, null, 2),
  );
  console.log(`Packaged the studio in ${relative(root, out)}.`);
}

const command = process.argv[2];
if (command === 'serve') serve();
else if (command === 'build') build();
else {
  console.error('Use: node scripts/studio.mjs serve | build');
  process.exit(1);
}
