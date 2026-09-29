// Stand-in doodles, to see the site filled in while the real ones get drawn. They're only ever
// shown while developing (see Doodle.astro): the live site shows hand-drawn doodles only.
//
//   npm run doodles:mock     makes src/art/doodles-mock/<spot>.png for the pokédream page's Poké Balls
//   npm run doodles:unmock   deletes them all, so every empty spot shows its placeholder again
//
// Each is drawn like a quick pen sketch: wobbly lines that overshoot where they started, and
// hatching where the real ball has color.
import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { spotsFor } from '../src/data/doodle-spots.js';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'src/art/doodles-mock');
const INK = '#1a1a1a';
const f = (n) => Math.round(n * 10) / 10;
const pt = ([x, y]) => `${f(x)},${f(y)}`;

function randomFrom(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth line through points (Catmull-Rom as cubic Béziers). */
function smooth(points, closed = false) {
  if (points.length < 3) return `M${pt(points[0])} L${pt(points[1])}`;
  const p = closed ? [points.at(-1), ...points, points[0], points[1]] : [points[0], ...points, points.at(-1)];
  let d = `M${pt(p[1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [a, b, c, e] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    d += ` C${pt([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${pt([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${pt(c)}`;
  }
  return closed ? `${d} Z` : d;
}

/** A pen that draws with a slightly unsteady hand. Drawings are 200 x 200 units. */
class Pen {
  constructor(seed) {
    this.random = randomFrom(seed);
    this.defs = [];
    this.parts = [];
  }
  jit(amount) {
    return (this.random() * 2 - 1) * amount;
  }
  shake(points, amount) {
    return points.map(([x, y]) => [x + this.jit(amount), y + this.jit(amount)]);
  }
  stroke(d, width = 4.2, color = INK) {
    this.parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  /** An open line through points. */
  line(points, { width = 4.2, shake = 1.2 } = {}) {
    this.stroke(smooth(this.shake(points, shake)), width);
  }
  /** A closed shape, filled white so it covers any hatching under it. */
  shape(points, { width = 3.6, shake = 1, fill = '#fff' } = {}) {
    this.parts.push(`<path d="${smooth(this.shake(points, shake), true)}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round"/>`);
  }
  /** A circle drawn in one go: it wanders a little and overshoots where it started. */
  circle(cx, cy, r, { width = 4.2, wobble = 0.025, fill = 'none', overshoot = 0.35 } = {}) {
    const start = this.random() * Math.PI * 2;
    const phase = [this.random() * 6, this.random() * 6];
    const drift = this.jit(0.03);
    const points = [];
    const steps = 28;
    const turn = Math.PI * 2 + overshoot;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = start + turn * t;
      const rr = r * (1 + wobble * Math.sin(2 * a + phase[0]) + wobble * 0.6 * Math.sin(3 * a + phase[1]) + drift * t);
      points.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    if (fill !== 'none') this.parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`);
    this.stroke(smooth(points), width);
  }
  /** Keep everything drawn since `from` inside a region. */
  clipSince(from, region) {
    const id = `c${this.defs.length}`;
    this.defs.push(`<clipPath id="${id}"><path d="${region}"/></clipPath>`);
    this.parts.push(`<g clip-path="url(#${id})">${this.parts.splice(from).join('')}</g>`);
  }
  dot(cx, cy, r) {
    this.parts.push(`<circle cx="${f(cx + this.jit(0.6))}" cy="${f(cy + this.jit(0.6))}" r="${r}" fill="${INK}"/>`);
  }
  /** Quick parallel pen lines filling a region, standing in for color. */
  hatch(region, { angle = 35, gap = 9, width = 2.2 } = {}) {
    const id = `c${this.defs.length}`;
    this.defs.push(`<clipPath id="${id}"><path d="${region}"/></clipPath>`);
    const a = (angle * Math.PI) / 180;
    const [dx, dy] = [Math.cos(a), Math.sin(a)];
    const [nx, ny] = [-dy, dx];
    const lines = [];
    for (let o = -150; o <= 150; o += gap + this.jit(gap * 0.2)) {
      const [cx, cy] = [100 + nx * o, 100 + ny * o];
      const bend = this.jit(2);
      const from = [cx - dx * 150, cy - dy * 150];
      const to = [cx + dx * 150, cy + dy * 150];
      const mid = [cx + nx * bend, cy + ny * bend];
      lines.push(`<path d="M${pt(from)} Q${pt(mid)} ${pt(to)}"/>`);
    }
    this.parts.push(`<g clip-path="url(#${id})" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round">${lines.join('')}</g>`);
  }
  svg(tilt) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 200 200"><defs>${this.defs.join('')}</defs><g transform="rotate(${f(tilt)} 100 100)">${this.parts.join('')}</g></svg>`;
  }
}

// The ball's top and bottom halves, just inside the outline, for hatching.
const TOP = 'M22,98 A78,78 0 0 1 178,98 Z';
const BOTTOM = 'M22,102 A78,78 0 0 0 178,102 Z';
const mirror = (points) => points.map(([x, y]) => [200 - x, y]);
const star = (cx, cy, r) => [[cx, cy - r], [cx + r * 0.25, cy - r * 0.25], [cx + r, cy], [cx + r * 0.25, cy + r * 0.25], [cx, cy + r], [cx - r * 0.25, cy + r * 0.25], [cx - r, cy], [cx - r * 0.25, cy - r * 0.25]];
const blob = (pen, cx, cy, r) => Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2;
  const rr = r * (0.75 + pen.random() * 0.5);
  return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
});
const wave = (y, amp, x0 = 30, x1 = 170) => Array.from({ length: 9 }, (_, i) => [x0 + ((x1 - x0) * i) / 8, y + (i % 2 ? amp : -amp)]);

// What makes each ball its own, drawn on its top half (and sometimes the bottom).
const DESIGNS = {
  'Poké Ball': (p) => p.hatch(TOP, { gap: 8 }),
  'Great Ball': (p) => {
    p.hatch(TOP, { angle: -30, gap: 12, width: 1.8 });
    const patch = [[30, 90], [36, 62], [52, 42], [64, 58], [58, 82]];
    for (const side of [patch, mirror(patch)]) p.shape(side);
    p.hatch(`M${patch.map(pt).join(' L')} Z`, { angle: 40, gap: 5 });
    p.hatch(`M${mirror(patch).map(pt).join(' L')} Z`, { angle: 40, gap: 5 });
  },
  'Ultra Ball': (p) => {
    p.hatch(TOP, { angle: 40, gap: 4.5 });
    const stripe = [[50, 96], [48, 62], [56, 32], [70, 24], [66, 60], [66, 96]];
    p.shape(stripe);
    p.shape(mirror(stripe));
  },
  'Master Ball': (p) => {
    p.hatch(TOP, { angle: 30, gap: 7 });
    p.circle(56, 58, 11, { fill: '#fff', width: 3.4 });
    p.circle(144, 58, 11, { fill: '#fff', width: 3.4 });
    const m = [[76, 84], [80, 50], [100, 70], [120, 50], [124, 84]];
    p.stroke(smooth(p.shake(m, 0.8)), 13, '#fff');
    p.line(m, { width: 4.5, shake: 0.6 });
  },
  'Safari Ball': (p) => {
    for (const [x, y, r] of [[60, 52, 12], [104, 40, 10], [140, 62, 13], [84, 78, 9], [124, 86, 8], [44, 82, 8]]) {
      const shape = blob(p, x, y, r);
      p.shape(shape, { width: 3 });
      p.hatch(`M${shape.map(pt).join(' L')} Z`, { angle: 60, gap: 4 });
    }
  },
  'Fast Ball': (p) => {
    const bolt = [[26, 84], [60, 62], [72, 76], [100, 48], [128, 76], [140, 62], [174, 84]];
    p.hatch(`M${[[22, 98], ...bolt, [178, 98]].map(pt).join(' L')} Z`, { angle: 30, gap: 6 });
    p.line(bolt, { shake: 1 });
    p.hatch(TOP, { angle: -40, gap: 14, width: 1.6 });
  },
  'Level Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 12, width: 1.6 });
    p.hatch('M22,98 L22,74 L178,74 L178,98 Z', { angle: 35, gap: 4.5 });
    p.line([[26, 74], [100, 71], [174, 74]]);
    for (const x of [60, 100, 140]) p.line([[x, 48], [x, 62]], { width: 3.6 });
  },
  'Lure Ball': (p) => {
    p.hatch(TOP, { angle: -35, gap: 10, width: 1.8 });
    p.line(wave(62, 6, 34, 166));
    p.line([[112, 30], [112, 54], [106, 62], [96, 58], [94, 50]], { width: 3.8 });
  },
  'Heavy Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 9, width: 2 });
    for (const x of [50, 88, 126]) p.shape([[x, 50], [x + 24, 48], [x + 25, 72], [x + 1, 74]], { width: 3.4 });
    for (const [x, y] of [[56, 55], [68, 55], [94, 54], [106, 54], [132, 54], [144, 54]]) p.dot(x, y, 2.4);
    p.circle(100, 100, 73, { width: 2.6, wobble: 0.015 });
  },
  'Love Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 11, width: 1.8 });
    const heart = 'M100,82 C66,58 78,32 100,50 C122,32 134,58 100,82 Z';
    p.parts.push(`<path d="${heart}" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
    p.hatch(heart, { angle: -40, gap: 5 });
  },
  'Friend Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 11, width: 1.8 });
    const leaf = [[40, 82], [48, 52], [72, 40], [70, 66]];
    for (const side of [leaf, mirror(leaf)]) {
      p.shape(side, { width: 3.4 });
      p.line([side[0], side[2]], { width: 2.4, shake: 0.6 });
    }
  },
  'Moon Ball': (p) => {
    p.hatch(TOP, { angle: 40, gap: 4.5 });
    p.parts.push(`<path d="M86,32 A28,28 0 1 0 118,74 A22,22 0 1 1 86,32 Z" fill="#fff" stroke="${INK}" stroke-width="3.6"/>`);
    p.shape(star(140, 44, 8), { width: 2.4, shake: 0.4 });
    p.shape(star(56, 60, 6), { width: 2.4, shake: 0.4 });
  },
  'Sport Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 10, width: 1.8 });
    for (const x of [62, 138]) {
      const seam = [[x - 6, 96], [x + (x < 100 ? 4 : -4), 64], [x + (x < 100 ? 16 : -16), 30]];
      p.line(seam, { width: 3.4 });
      for (let t = 0.2; t < 0.9; t += 0.22) {
        const y = 96 - 66 * t;
        const cx = x - 6 + (x < 100 ? 20 : -20) * t;
        p.line([[cx - 5, y - 2], [cx + 5, y + 2]], { width: 2.2, shake: 0.4 });
      }
    }
  },
  'Premier Ball': (p) => {
    p.hatch('M20,92 L180,92 L180,108 L20,108 Z', { angle: 35, gap: 3.5 });
    p.shape(star(62, 46, 9), { width: 2.4, shake: 0.4 });
  },
  'Repeat Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 11, width: 1.8 });
    p.hatch('M40,98 A60,60 0 0 1 160,98 L140,98 A40,40 0 0 0 60,98 Z', { angle: -35, gap: 4.5 });
    p.line([[40, 96], [48, 62], [100, 38], [152, 62], [160, 96]]);
    p.line([[60, 96], [66, 74], [100, 58], [134, 74], [140, 96]]);
  },
  'Timer Ball': (p) => {
    for (const x of [46, 78, 110, 142]) {
      const bar = `M${x},98 L${x},22 L${x + 14},22 L${x + 14},98 Z`;
      p.hatch(`${bar}`, { angle: 35, gap: 4.5 });
    }
    for (const x of [46, 60, 78, 92, 110, 124, 142, 156]) p.line([[x, 96], [x, 36 + Math.abs(100 - x) * 0.4]], { width: 2.4, shake: 0.6 });
  },
  'Nest Ball': (p) => {
    p.hatch(BOTTOM, { angle: 35, gap: 11, width: 1.8 });
    p.hatch(TOP, { angle: -35, gap: 9, width: 1.8 });
    p.line([[30, 70], [66, 52], [100, 48], [134, 52], [170, 70]]);
    p.shape([[92, 50], [100, 28], [112, 22], [110, 40]], { width: 3.2 });
  },
  'Net Ball': (p) => {
    p.hatch(TOP, { angle: 45, gap: 16, width: 3 });
    p.hatch(TOP, { angle: -45, gap: 16, width: 3 });
    p.hatch(TOP, { angle: 0, gap: 10, width: 1.4 });
  },
  'Dive Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 10, width: 1.8 });
    p.line(wave(46, 5, 40, 160));
    p.line(wave(70, 5, 28, 172));
    for (const [x, y, r] of [[128, 30, 5], [140, 22, 3.5], [70, 32, 4]]) p.circle(x, y, r, { width: 2.4, fill: '#fff' });
  },
  'Luxury Ball': (p) => {
    p.hatch(TOP, { angle: 40, gap: 4.5 });
    p.shape([[24, 88], [100, 84], [176, 88], [176, 82], [100, 76], [24, 82]], { width: 2.8, shake: 0.5 });
    p.shape([[34, 66], [100, 60], [166, 66], [162, 58], [100, 52], [38, 58]], { width: 2.8, shake: 0.5 });
  },
  'Dusk Ball': (p) => {
    p.hatch(TOP, { angle: 40, gap: 4.5 });
    p.shape([[26, 70], [50, 56], [74, 70], [100, 54], [126, 70], [150, 56], [174, 70], [172, 80], [150, 66], [126, 80], [100, 64], [74, 80], [50, 66], [28, 80]], { width: 2.8, shake: 0.4 });
  },
  'Heal Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 11, width: 1.8 });
    p.shape([[92, 30], [108, 30], [108, 46], [124, 46], [124, 62], [108, 62], [108, 78], [92, 78], [92, 62], [76, 62], [76, 46], [92, 46]], { width: 3.4, shake: 0.5 });
  },
  'Quick Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 8, width: 2 });
    for (const side of [1, -1]) {
      p.line([[100 + side * 22, 92], [100 + side * 36, 60], [100 + side * 30, 26]], { width: 7 });
      p.line([[100 + side * 22, 92], [100 + side * 36, 60], [100 + side * 30, 26]].map(([x, y]) => [x, y]), { width: 2.6, shake: 0.3 });
    }
    p.line([[60, 50], [100, 36], [140, 50]], { width: 3.4 });
  },
  'Cherish Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 10, width: 1.8 });
    p.line([[40, 84], [52, 60], [72, 56], [78, 70], [66, 74], [62, 66]]);
    p.line([[160, 84], [148, 60], [128, 56], [122, 70], [134, 74], [138, 66]]);
    p.line([[84, 40], [100, 30], [116, 40]]);
  },
  'Park Ball': (p) => {
    p.hatch(TOP, { angle: -35, gap: 10, width: 1.8 });
    p.shape(star(100, 52, 20), { width: 3.4, shake: 0.5 });
    for (const [x, y] of [[54, 70], [146, 70]]) p.shape(star(x, y, 9), { width: 2.6, shake: 0.4 });
  },
  'Dream Ball': (p) => {
    for (const [x, y, r] of [[60, 56, 13], [96, 38, 9], [134, 52, 15], [80, 80, 7], [120, 84, 6], [46, 84, 5], [156, 82, 5]]) {
      p.circle(x, y, r, { width: 2.8 });
      if (r > 8) p.line([[x - r * 0.4, y - r * 0.2], [x - r * 0.1, y - r * 0.5]], { width: 2, shake: 0.2 });
    }
  },
  'Beast Ball': (p) => {
    p.hatch(TOP, { angle: 40, gap: 5 });
    p.shape([[34, 92], [58, 40], [82, 72], [100, 28], [118, 72], [142, 40], [166, 92]], { width: 3.2, shake: 0.6 });
    p.hatch('M34,92 L58,40 L82,72 L100,28 L118,72 L142,40 L166,92 Z', { angle: -40, gap: 11, width: 1.6 });
  },
  'Strange Ball': (p) => {
    p.hatch('M100,98 L22,98 A78,78 0 0 1 100,20 Z', { angle: 40, gap: 4.5 });
    p.hatch('M100,98 L178,98 A78,78 0 0 0 100,20 Z', { angle: -35, gap: 9, width: 2 });
    p.line([[100, 22], [96, 50], [104, 70], [100, 96]], { width: 3 });
    p.parts.push(`<path d="M126,40 C126,28 146,28 146,40 C146,50 136,50 136,60" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/>`);
    p.line([[126, 40], [128, 30], [138, 28], [146, 36], [142, 48], [136, 52], [136, 60]], { width: 3.6, shake: 0.4 });
    p.dot(136, 71, 3.2);
  },
};

/** The parts every ball shares: band, button, outline, and a little shine. */
function ball(name, pen) {
  DESIGNS[name]?.(pen);
  pen.clipSince(0, 'M21,100 A79,79 0 1 0 179,100 A79,79 0 1 0 21,100 Z'); // designs stay inside the ball
  const bandTop = Array.from({ length: 6 }, (_, i) => [22 + i * 12.4, 94 + i * 0.6]);
  const bandBottom = bandTop.map(([x, y]) => [x, y + 11]);
  pen.hatch('M20,94 L80,97 L80,108 L20,106 Z', { angle: 35, gap: 3.5 });
  pen.hatch('M120,97 L180,94 L180,106 L120,108 Z', { angle: 35, gap: 3.5 });
  for (const band of [bandTop, bandBottom]) {
    pen.line(band);
    pen.line(mirror(band).reverse());
  }
  pen.circle(100, 100, 80, { width: 4.6 });
  pen.circle(100, 100, 20, { fill: '#fff', width: 4.2 });
  pen.circle(100, 100, 10, { width: 3.2, overshoot: 0.2 });
  pen.stroke(`M${pt([46 + pen.jit(2), 58])} Q${pt([52, 40])} ${pt([70 + pen.jit(2), 32])}`, 6, '#fff');
  return pen;
}

// This folder only ever holds stand-ins made here; real doodles live in src/art/doodles.
if (process.argv.includes('--remove')) {
  rmSync(out, { recursive: true, force: true });
  console.log('Removed the stand-in doodles. Empty spots show their placeholders again.');
  process.exit(0);
}

mkdirSync(out, { recursive: true });
const spots = spotsFor('project:pokedream');
await Promise.all(
  spots.map(async (spot) => {
    if (!DESIGNS[spot.idea]) console.warn(`No design for ${spot.idea}; drawing a plain ball.`);
    const pen = ball(spot.idea, new Pen(spot.id));
    const svg = pen.svg(pen.jit(10));
    await sharp(Buffer.from(svg)).png().toFile(join(out, `${spot.id}.png`));
  }),
);
console.log(`Drew ${spots.length} stand-in Poké Balls in src/art/doodles-mock (shown only while developing).`);
