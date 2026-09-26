// The Doodle Studio (studio/): a private drawing page for the site's doodles, hosted on its own.
//
//   node scripts/studio.mjs serve   try it on this computer (npm run studio)
//   node scripts/studio.mjs build   package it for Vercel (npm run studio:deploy does this, then uploads)
//
// Two files are made fresh each time instead of living in studio/: config.js (the public Supabase
// values from .env) and spots.js (every doodle spot on the site, read from the pages).
import { createServer } from 'node:http';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { readEnv } from './env.mjs';

const root = resolve(import.meta.dirname, '..');
const studio = join(root, 'studio');
const PORT = 4330;
const FILES = ['index.html', 'studio.css', 'studio.js', 'ink.js', 'api.js'];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

// Where each page's spots are, in the order the studio lists them.
const PAGES = [
  ['info', 'the Draw intro page'],
  ['about', 'the About page'],
  ['projects/index', 'the Projects page'],
  ['projects/[slug]', 'every project page'],
  ['art/index', 'the Art page'],
  ['art/[slug]', null], // one spot per art piece, named after it
  ['thank-you', 'the Thanks for drawing page'],
];

function configJs(local) {
  const env = readEnv(join(root, '.env'));
  const config = { supabaseUrl: env.PUBLIC_SUPABASE_URL, anonKey: env.PUBLIC_SUPABASE_ANON_KEY, local };
  if (!config.supabaseUrl || !config.anonKey) throw new Error('.env needs PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.');
  return `export default ${JSON.stringify(config, null, 2)};\n`;
}

/** Art pieces, from the work entries that aren't projects or drafts. */
function artPieces() {
  const dir = join(root, 'src/content/work');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const front = readFileSync(join(dir, file), 'utf8').split(/^---$/m)[1] ?? '';
      const field = (name) => front.match(new RegExp(`^${name}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1];
      return { id: file.replace(/\.md$/, ''), title: field('title'), kind: field('kind'), draft: field('draft') === 'true', order: Number(field('order') ?? 100) };
    })
    .filter((piece) => piece.kind !== 'project' && !piece.draft)
    .sort((a, b) => a.order - b.order);
}

/** Every doodle spot on the site: its file name, the idea for it, and how wide it shows. */
function findSpots() {
  const spots = [];
  for (const [page, label] of PAGES) {
    const src = readFileSync(join(root, 'src/pages', `${page}.astro`), 'utf8');
    for (const [, attrs] of src.matchAll(/<Doodle\b([^>]*?)\/>/g)) {
      if (/kind="image"/.test(attrs)) continue;
      const note = attrs.match(/note="([^"]*)"/)?.[1];
      const width = Number(attrs.match(/width=\{(\d+)\}/)?.[1] ?? 96);
      const name = attrs.match(/name="([^"]+)"/)?.[1];
      if (name && note) spots.push({ name, note, width, page: label });
      if (attrs.includes('name={`art-${entry.id}-side`}') && note) {
        for (const piece of artPieces()) {
          spots.push({ name: `art-${piece.id}-side`, note, width, page: `the page for ${piece.title}` });
        }
      }
    }
    // The Draw intro page lists its spots in an array instead.
    for (const [, name, note] of src.matchAll(/\{\s*name:\s*'([^']+)',\s*note:\s*'((?:[^'\\]|\\.)*)'/g)) {
      spots.push({ name, note: note.replace(/\\'/g, "'"), width: 96, page: label });
    }
  }
  return spots;
}

const spotsJs = () => `export default ${JSON.stringify(findSpots(), null, 2)};\n`;

function serve() {
  createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = path === '/' ? 'index.html' : path.slice(1);
    const send = (status, type, body) => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(body);
    };
    try {
      if (file === 'config.js') return send(200, TYPES['.js'], configJs(true));
      if (file === 'spots.js') return send(200, TYPES['.js'], spotsJs());
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
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'static'), { recursive: true });
  for (const file of FILES) writeFileSync(join(out, 'static', file), readFileSync(join(studio, file)));
  writeFileSync(join(out, 'static/config.js'), configJs(false));
  const spots = spotsJs();
  writeFileSync(join(out, 'static/spots.js'), spots);
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
  console.log(`Packaged the studio in ${relative(root, out)} with ${findSpots().length} doodle spots.`);
}

const command = process.argv[2];
if (command === 'serve') serve();
else if (command === 'build') build();
else {
  console.error('Use: node scripts/studio.mjs serve | build');
  process.exit(1);
}
