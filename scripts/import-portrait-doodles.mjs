// Turns an export of Portrait Studio strokes (one JSON file per stroke) into src/art/portrait/doodles.json.
// Usage: node scripts/import-portrait-doodles.mjs <folder-with-stroke-json-files>
import fs from 'node:fs';
import path from 'node:path';

const WIDTH = 1147;
const HEIGHT = 1200;

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('Pass the folder that holds the exported stroke JSON files.');
  process.exit(1);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const strokes = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return raw.data ?? raw;
  })
  .filter((d) => d && typeof d.points === 'string')
  .map((d) => ({
    ink: d.ink === 'accent' ? 'accent' : 'black',
    size: clamp(Number(d.size) || 8, 1, 60),
    createdAt: Number(d.createdAt) || 0,
    points: d.points
      .trim()
      .split(/\s+/)
      .map((p) => p.split(',').map(Number))
      .filter((p) => p.length === 2 && p.every(Number.isFinite))
      .map(([x, y]) => [Math.round(clamp(x, 0, WIDTH) * 10) / 10, Math.round(clamp(y, 0, HEIGHT) * 10) / 10]),
  }))
  .filter((s) => s.points.length > 0)
  .sort((a, b) => a.createdAt - b.createdAt)
  .map(({ createdAt, ...stroke }) => stroke);

fs.mkdirSync('src/art/portrait', { recursive: true });
fs.writeFileSync('src/art/portrait/doodles.json', JSON.stringify({ width: WIDTH, height: HEIGHT, strokes }));
console.log(`Wrote ${strokes.length} strokes (${strokes.reduce((n, s) => n + s.points.length, 0)} points).`);
