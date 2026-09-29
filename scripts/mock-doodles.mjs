// Stand-in doodles for every doodle spot, drawn like quick pen sketches, to fill the site until
// the real ones are drawn. A real doodle in src/art/doodles always takes the place of its stand-in.
//
//   npm run doodles:mock     makes the stand-ins
//   npm run doodles:unmock   deletes them all, so empty spots go back to showing nothing
//
// Each one is made twice:
//   src/art/doodles-mock/<spot>.png     the finished drawing, shown on the page
//   public/doodle-strokes/<spot>.svg    the same drawing, stroke by stroke, with each stroke's
//                                       start and length in time, so the page can draw it in the
//                                       way a person would (see Doodle.astro)
//
// The pen is slightly unsteady: lines wobble, circles overshoot where they started, and quick
// back-and-forth hatching stands in for color.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { DOODLE_SPOTS, spotsFor } from '../src/data/doodle-spots.js';

const root = resolve(import.meta.dirname, '..');
const pngs = join(root, 'src/art/doodles-mock');
const strokes = join(root, 'public/doodle-strokes');
const INK = '#1a1a1a';
const WHITE = '#fff';
const f = (n) => Math.round(n * 10) / 10;
const pt = ([x, y]) => `${f(x)},${f(y)}`;
const deg = (d) => (d * Math.PI) / 180;
const at = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const lengthOf = (points) => points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i][0], y - points[i][1]), 0);

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
  if (points.length < 3) return `M${pt(points[0])} L${pt(points[1])}${closed ? ' Z' : ''}`;
  const p = closed ? [points.at(-1), ...points, points[0], points[1]] : [points[0], ...points, points.at(-1)];
  let d = `M${pt(p[1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [a, b, c, e] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    d += ` C${pt([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${pt([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${pt(c)}`;
  }
  return closed ? `${d} Z` : d;
}

const straight = (points, closed = false) => `M${points.map(pt).join(' L')}${closed ? ' Z' : ''}`;
const ellipsePath = (cx, cy, rx, ry) => `M${f(cx - rx)},${f(cy)} a${rx},${ry} 0 1 0 ${2 * rx},0 a${rx},${ry} 0 1 0 ${-2 * rx},0 Z`;
const arc = (cx, cy, rx, ry, a0, a1, n = 16) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
const ellipsePoly = (cx, cy, rx, ry) => arc(cx, cy, rx, ry, 0, Math.PI * 2, 36).slice(0, -1);
const mirror = (points, axis = 100) => points.map(([x, y]) => [2 * axis - x, y]);
/** Turn points around the origin by `turn` degrees, then move them to x, y. */
const place = (points, { x = 0, y = 0, turn = 0, scale = 1 } = {}) => {
  const a = deg(turn);
  return points.map(([px, py]) => [x + scale * (px * Math.cos(a) - py * Math.sin(a)), y + scale * (px * Math.sin(a) + py * Math.cos(a))]);
};
const roundedRect = (x, y, w, h, r) => [
  [x + r, y], [x + w / 2, y], [x + w - r, y], [x + w, y + r], [x + w, y + h / 2], [x + w, y + h - r],
  [x + w - r, y + h], [x + w / 2, y + h], [x + r, y + h], [x, y + h - r], [x, y + h / 2], [x, y + r],
];
/** A four-point sparkle, sides curving in. */
const sparkle = (cx, cy, r) => [[cx, cy - r], [cx + r * 0.22, cy - r * 0.22], [cx + r, cy], [cx + r * 0.22, cy + r * 0.22], [cx, cy + r], [cx - r * 0.22, cy + r * 0.22], [cx - r, cy], [cx - r * 0.22, cy - r * 0.22]];
/** A five-point star. */
const star5 = (cx, cy, R, r = R * 0.45) => Array.from({ length: 10 }, (_, i) => at(cx, cy, i % 2 ? r : R, deg(-90 + i * 36)));
const heartPath = (cx, cy, s) =>
  `M${pt([cx, cy + 18 * s])} C${pt([cx - 34 * s, cy - 6 * s])} ${pt([cx - 22 * s, cy - 26 * s])} ${pt([cx, cy - 10 * s])} C${pt([cx + 22 * s, cy - 26 * s])} ${pt([cx + 34 * s, cy - 6 * s])} ${pt([cx, cy + 18 * s])} Z`;
const bezier = (p0, p1, p2, p3, t) => [0, 1].map((k) => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * p1[k] + 3 * (1 - t) * t ** 2 * p2[k] + t ** 3 * p3[k]);
const heartPoly = (cx, cy, s) => {
  const [bottom, top] = [[cx, cy + 18 * s], [cx, cy - 10 * s]];
  const left = Array.from({ length: 12 }, (_, i) => bezier(bottom, [cx - 34 * s, cy - 6 * s], [cx - 22 * s, cy - 26 * s], top, i / 12));
  const right = Array.from({ length: 12 }, (_, i) => bezier(top, [cx + 22 * s, cy - 26 * s], [cx + 34 * s, cy - 6 * s], bottom, i / 12));
  return [...left, ...right];
};

/** Where a line crosses into and out of a polygon: pairs of distances along the line. */
function crossings(region, offset, [dx, dy], [nx, ny]) {
  const hits = [];
  for (let i = 0; i < region.length; i++) {
    const [[x1, y1], [x2, y2]] = [region[i], region[(i + 1) % region.length]];
    const v1 = x1 * nx + y1 * ny - offset;
    const v2 = x2 * nx + y2 * ny - offset;
    if (v1 > 0 === v2 > 0) continue;
    const u1 = x1 * dx + y1 * dy;
    const u2 = x2 * dx + y2 * dy;
    hits.push(u1 + (u2 - u1) * (v1 / (v1 - v2)));
  }
  hits.sort((a, b) => a - b);
  const spans = [];
  for (let i = 0; i + 1 < hits.length; i += 2) spans.push([hits[i], hits[i + 1]]);
  return spans;
}

// A tiny pen alphabet, for currency symbols and codes. Each glyph is strokes in a box 100 tall;
// w is its width. A stroke with one point is a dot.
const GLYPHS = {
  A: { w: 76, s: [[[6, 100], [38, 0], [70, 100]], [[20, 62], [56, 62]]] },
  B: { w: 70, s: [[[10, 100], [10, 0], [42, 0], [56, 8], [58, 24], [50, 40], [34, 47], [10, 48]], [[34, 47], [56, 54], [64, 72], [58, 90], [42, 100], [10, 100]]] },
  C: { w: 76, s: [[[70, 16], [58, 4], [40, 0], [22, 8], [10, 26], [6, 50], [10, 74], [22, 92], [40, 100], [58, 96], [70, 84]]] },
  D: { w: 74, s: [[[10, 0], [10, 100], [34, 100], [54, 92], [66, 74], [70, 50], [66, 26], [54, 8], [34, 0], [10, 0]]] },
  E: { w: 66, s: [[[60, 0], [10, 0], [10, 100], [60, 100]], [[10, 50], [50, 50]]] },
  F: { w: 64, s: [[[10, 100], [10, 0], [58, 0]], [[10, 48], [48, 48]]] },
  G: { w: 78, s: [[[70, 16], [58, 4], [40, 0], [22, 8], [10, 26], [6, 50], [10, 74], [22, 92], [40, 100], [58, 96], [70, 84], [70, 56], [46, 56]]] },
  H: { w: 72, s: [[[10, 0], [10, 100]], [[62, 0], [62, 100]], [[10, 50], [62, 50]]] },
  I: { w: 40, s: [[[20, 0], [20, 100]], [[4, 0], [36, 0]], [[4, 100], [36, 100]]] },
  J: { w: 62, s: [[[52, 0], [52, 74], [46, 92], [30, 100], [14, 94], [8, 82]]] },
  K: { w: 68, s: [[[10, 0], [10, 100]], [[60, 0], [10, 60]], [[28, 40], [62, 100]]] },
  L: { w: 62, s: [[[10, 0], [10, 100], [58, 100]]] },
  M: { w: 82, s: [[[8, 100], [8, 0], [41, 64], [74, 0], [74, 100]]] },
  N: { w: 72, s: [[[10, 100], [10, 0], [62, 100], [62, 0]]] },
  O: { w: 80, s: [[[40, 0], [20, 8], [8, 28], [6, 50], [8, 72], [20, 92], [40, 100], [60, 92], [72, 72], [74, 50], [72, 28], [60, 8], [40, 0]]] },
  P: { w: 66, s: [[[10, 100], [10, 0], [40, 0], [54, 8], [58, 24], [52, 40], [38, 48], [10, 48]]] },
  R: { w: 68, s: [[[10, 100], [10, 0], [40, 0], [54, 8], [58, 24], [52, 38], [38, 46], [10, 46]], [[32, 46], [62, 100]]] },
  S: { w: 70, s: [[[62, 14], [52, 3], [34, 0], [18, 8], [12, 24], [20, 38], [38, 48], [54, 56], [64, 70], [62, 86], [48, 98], [28, 100], [12, 92], [6, 82]]] },
  T: { w: 70, s: [[[4, 0], [66, 0]], [[35, 0], [35, 100]]] },
  U: { w: 72, s: [[[10, 0], [10, 70], [16, 88], [36, 100], [56, 88], [62, 70], [62, 0]]] },
  W: { w: 84, s: [[[4, 0], [22, 100], [42, 32], [62, 100], [80, 0]]] },
  X: { w: 70, s: [[[8, 0], [62, 100]], [[62, 0], [8, 100]]] },
  Y: { w: 72, s: [[[6, 0], [36, 50], [66, 0]], [[36, 50], [36, 100]]] },
  Z: { w: 72, s: [[[8, 0], [64, 0], [8, 100], [66, 100]]] },
  k: { w: 58, s: [[[12, 0], [12, 100]], [[50, 42], [12, 74]], [[26, 64], [54, 100]]] },
  r: { w: 54, s: [[[12, 100], [12, 42]], [[12, 60], [22, 46], [36, 40], [50, 44]]] },
  z: { w: 60, s: [[[10, 42], [50, 42], [10, 100], [52, 100]]] },
  ł: { w: 54, s: [[[28, 0], [28, 100]], [[10, 64], [46, 36]]] },
  $: { w: 76, s: [[[62, 20], [52, 9], [36, 7], [22, 14], [18, 30], [28, 42], [46, 50], [60, 60], [64, 76], [54, 90], [36, 93], [20, 86], [14, 76]], [[40, -4], [40, 104]]] },
  '€': { w: 78, s: [[[72, 16], [60, 4], [42, 2], [26, 12], [16, 32], [14, 56], [20, 78], [36, 94], [56, 98], [72, 88]], [[2, 40], [56, 40]], [[2, 60], [52, 60]]] },
  '£': { w: 74, s: [[[64, 18], [58, 6], [44, 2], [30, 10], [26, 28], [28, 52], [26, 72], [18, 88], [8, 98]], [[8, 98], [30, 92], [52, 98], [70, 96]], [[10, 54], [50, 54]]] },
  '¥': { w: 80, s: [[[6, 2], [40, 48], [74, 2]], [[40, 48], [40, 100]], [[16, 58], [64, 58]], [[16, 76], [64, 76]]] },
  '₹': { w: 76, s: [[[4, 4], [72, 4]], [[4, 26], [72, 26]], [[22, 4], [46, 6], [60, 16], [58, 34], [44, 46], [14, 48], [64, 100]]] },
  '₩': { w: 84, s: [[[2, 4], [20, 100], [42, 36], [64, 100], [82, 4]], [[0, 42], [84, 42]], [[2, 64], [82, 64]]] },
  '₽': { w: 70, s: [[[22, 100], [22, 4], [48, 4], [64, 14], [66, 32], [54, 46], [22, 48]], [[4, 48], [22, 48]], [[4, 72], [54, 72]]] },
  '₺': { w: 70, s: [[[28, 2], [28, 96], [44, 98], [60, 88], [66, 68]], [[10, 50], [52, 32]], [[10, 70], [52, 52]]] },
  '₱': { w: 80, s: [[[20, 100], [20, 4], [48, 4], [64, 14], [64, 34], [50, 46], [20, 46]], [[4, 18], [76, 18]], [[4, 32], [76, 32]]] },
  '฿': { w: 72, s: [[[16, 4], [16, 96]], [[16, 4], [44, 4], [58, 12], [58, 32], [46, 44], [16, 46]], [[16, 46], [48, 46], [64, 58], [64, 82], [50, 96], [16, 96]], [[32, -8], [32, 108]]] },
  '?': { w: 76, s: [[[16, 26], [22, 8], [40, 0], [58, 6], [64, 22], [56, 38], [40, 50], [38, 70]], [[38, 92]]] },
  // The UAE dirham, as written: alef with hamza below, a dot, and dal.
  'د.إ': { w: 88, s: [[[12, 6], [12, 82]], [[4, 96], [14, 90], [8, 100], [20, 98]], [[40, 80]], [[58, 38], [72, 56], [72, 74], [66, 80], [46, 80]]] },
};

/**
 * A pen that draws with a slightly unsteady hand, in a 200 x 200 box. Every ink stroke is noted
 * as a "move", so the drawing can later be played back stroke by stroke. White (paper-colored)
 * fills and strokes only ever cover what's under them, so they're there from the start.
 */
class Pen {
  constructor(seed) {
    this.random = randomFrom(seed);
    this.name = seed; // keeps ids unique when several doodles share a page
    this.defs = [];
    this.parts = [];
    this.moves = [];
    // What gets drawn first: outlines (0), then details (1), then hatching (2). Within the same
    // phase, strokes go in the order they were drawn here.
    this.phase = 1;
  }
  jit(amount) {
    return (this.random() * 2 - 1) * amount;
  }
  shake(points, amount) {
    return points.map(([x, y]) => [x + this.jit(amount), y + this.jit(amount)]);
  }
  /** Note a stroke for playback; returns the attributes that tie the element to it. */
  move(kind, length, fill = false) {
    const id = this.moves.length;
    this.moves.push({ id, kind, length, fill, phase: kind === 'hatch' ? 2 : this.phase });
    return ` data-m="${id}"${kind === 'dot' ? '' : ' pathLength="1"'}`;
  }
  stroke(d, width = 4.2, color = INK, length = 60) {
    const move = color === INK ? this.move('line', length) : '';
    this.parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${move}/>`);
  }
  /** Any path, drawn in one stroke. */
  path(d, { width = 3.6, fill = 'none', length = 100 } = {}) {
    this.parts.push(`<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${this.move('line', length, fill === INK)}/>`);
  }
  /** An open line through points; `straight` keeps its corners sharp. */
  line(points, { width = 4.2, shake = 1.2, straight: sharp = false } = {}) {
    const shaken = this.shake(points, shake);
    this.stroke(sharp ? straight(shaken) : smooth(shaken), width, INK, lengthOf(shaken));
  }
  /** A closed shape, filled white so it covers anything drawn under it. */
  shape(points, { width = 3.6, shake = 1, fill = WHITE, straight: sharp = false } = {}) {
    const shaken = this.shake(points, shake);
    const d = sharp ? straight(shaken, true) : smooth(shaken, true);
    this.path(d, { width, fill, length: lengthOf([...shaken, shaken[0]]) });
  }
  rect(x, y, w, h, { r = 6, ...rest } = {}) {
    this.shape(roundedRect(x, y, w, h, r), rest);
  }
  /** An ellipse drawn in one go: it wanders a little and overshoots where it started. */
  ellipse(cx, cy, rx, ry, { width = 4.2, wobble = 0.025, fill = 'none', overshoot = 0.35 } = {}) {
    const start = this.random() * Math.PI * 2;
    const phase = [this.random() * 6, this.random() * 6];
    const drift = this.jit(0.03);
    const points = [];
    const steps = 28;
    const turn = Math.PI * 2 + overshoot;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = start + turn * t;
      const k = 1 + wobble * Math.sin(2 * a + phase[0]) + wobble * 0.6 * Math.sin(3 * a + phase[1]) + drift * t;
      points.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
    }
    if (fill !== 'none') this.parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`);
    this.stroke(smooth(points), width, INK, lengthOf(points));
  }
  circle(cx, cy, r, options) {
    this.ellipse(cx, cy, r, r, options);
  }
  dot(cx, cy, r) {
    this.parts.push(`<circle cx="${f(cx + this.jit(0.6))}" cy="${f(cy + this.jit(0.6))}" r="${r}" fill="${INK}"${this.move('dot', 0)}/>`);
  }
  /** A line broken into dashes, like a trail. */
  dashed(points, { width = 2.4, on = 6, off = 5 } = {}) {
    const dense = [];
    for (let i = 1; i < points.length; i++) {
      const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
      for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
    dense.push(points.at(-1));
    for (let s = 0; s < dense.length; s += on + off) {
      const dash = this.shake(dense.slice(s, s + on + 1), 0.4);
      if (dash.length > 1) this.stroke(straight(dash), width, INK, lengthOf(dash));
    }
  }
  /**
   * Quick parallel pen strokes filling a region (a polygon), standing in for color. Each line
   * starts and stops at the region's edge, going back and forth like a real hand hatching.
   */
  hatch(region, { angle = 35, gap = 9, width = 2.2 } = {}) {
    const a = deg(angle);
    const along = [Math.cos(a), Math.sin(a)];
    const across = [-along[1], along[0]];
    const offsets = region.map(([x, y]) => x * across[0] + y * across[1]);
    const [lo, hi] = [Math.min(...offsets), Math.max(...offsets)];
    let back = this.random() < 0.5;
    for (let o = lo + gap * (0.3 + 0.4 * this.random()); o < hi; o += gap + this.jit(gap * 0.2)) {
      for (const [t0, t1] of crossings(region, o, along, across)) {
        if (t1 - t0 < 1.5) continue;
        const [s0, s1] = [t0 - 0.2 + this.jit(0.6), t1 + 0.2 + this.jit(0.6)];
        let from = [across[0] * o + along[0] * s0, across[1] * o + along[1] * s0];
        let to = [across[0] * o + along[0] * s1, across[1] * o + along[1] * s1];
        if (back) [from, to] = [to, from];
        back = !back;
        const bend = this.jit(1.4);
        const mid = [(from[0] + to[0]) / 2 + across[0] * bend, (from[1] + to[1]) / 2 + across[1] * bend];
        this.parts.push(`<path d="M${pt(from)} Q${pt(mid)} ${pt(to)}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round"${this.move('hatch', s1 - s0)}/>`);
      }
    }
  }
  /** Keep everything drawn since `from` inside a region. */
  clipSince(from, region) {
    const id = `doodle-${this.name}-clip${this.defs.length}`;
    this.defs.push(`<clipPath id="${id}"><path d="${region}"/></clipPath>`);
    this.parts.push(`<g clip-path="url(#${id})">${this.parts.splice(from).join('')}</g>`);
  }
  /** Letters and symbols in the pen alphabet, centered on cx, cy. */
  text(str, cx, cy, height, { width = 4, gap = 14, maxWidth = Infinity, shake = 0.6 } = {}) {
    const glyphs = GLYPHS[str] ? [GLYPHS[str]] : [...str].map((ch) => GLYPHS[ch]);
    if (glyphs.some((g) => !g)) throw new Error(`The pen alphabet has no "${str}".`);
    const units = glyphs.reduce((sum, g) => sum + g.w, 0) + gap * (glyphs.length - 1);
    const s = Math.min(height / 100, maxWidth / units);
    let x = cx - (units * s) / 2;
    const top = cy - 50 * s;
    for (const g of glyphs) {
      for (const stroke of g.s) {
        const points = stroke.map(([gx, gy]) => [x + gx * s, top + gy * s]);
        if (points.length === 1) this.dot(points[0][0], points[0][1], width * 0.8);
        else this.line(points, { width, shake, straight: true });
      }
      x += (g.w + gap) * s;
    }
  }
  /**
   * When each stroke starts and how long it takes, like a person drawing: longer strokes take
   * longer, the pen lifts for a moment between strokes, and hatching goes quickly. Each doodle
   * has its own pace, and the whole thing fits in `max` milliseconds.
   */
  timeline(max = 2800) {
    const pace = 0.8 + this.random() * 0.45;
    const order = [...this.moves].sort((a, b) => a.phase - b.phase || a.id - b.id);
    let clock = 0;
    let phase = order[0]?.phase;
    for (const m of order) {
      if (m.phase !== phase) {
        clock += 160;
        phase = m.phase;
      }
      if (m.kind === 'hatch') {
        clock += 8 + this.random() * 14;
        m.d = (24 + m.length * 1.1) / pace;
      } else if (m.kind === 'dot') {
        clock += 50 + this.random() * 60;
        m.d = 70;
      } else {
        clock += 60 + this.random() * 80;
        m.d = Math.min(1000, 90 + m.length * 1.8) / pace;
      }
      m.t = clock;
      clock += m.d;
    }
    const squeeze = clock > max ? max / clock : 1;
    for (const m of order) {
      m.t = Math.round(m.t * squeeze);
      m.d = Math.max(16, Math.round(m.d * squeeze));
    }
    return Math.round(clock * squeeze);
  }
  /** The drawing as SVG: finished, or with each stroke's timing for playing it back. */
  svg(tilt, { viewBox = '0 0 200 200', size = '', timed = false } = {}) {
    let body = this.parts.join('');
    let total = 0;
    if (timed) {
      total = this.timeline();
      body = body.replace(/ data-m="(\d+)"/g, (_, id) => {
        const m = this.moves[id];
        return ` data-t="${m.t}" data-d="${m.d}"${m.fill ? ' data-f="1"' : ''}`;
      });
    } else {
      body = body.replace(/ data-m="\d+"/g, '');
    }
    return `<svg xmlns="http://www.w3.org/2000/svg"${size} viewBox="${viewBox}"${timed ? ` data-total="${total}"` : ''}><defs>${this.defs.join('')}</defs><g transform="rotate(${f(tilt)} 100 100)">${body}</g></svg>`;
  }
}

const blob = (pen, cx, cy, r, sides = 7) =>
  Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2;
    const rr = r * (0.75 + pen.random() * 0.5);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
const wave = (y, amp, x0 = 30, x1 = 170) => Array.from({ length: 9 }, (_, i) => [x0 + ((x1 - x0) * i) / 8, y + (i % 2 ? amp : -amp)]);

// ------------------------------------------------------------------------------------------------
// Poké Balls (pokédream)

// The ball's top and bottom halves, just inside the outline, for hatching.
const TOP = arc(100, 98, 78, 78, deg(180), deg(360), 36);
const BOTTOM = arc(100, 102, 78, 78, 0, deg(180), 36);
const star = (cx, cy, r) => [[cx, cy - r], [cx + r * 0.25, cy - r * 0.25], [cx + r, cy], [cx + r * 0.25, cy + r * 0.25], [cx, cy + r], [cx - r * 0.25, cy + r * 0.25], [cx - r, cy], [cx - r * 0.25, cy - r * 0.25]];
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// What makes each ball its own, drawn on its top half (and sometimes the bottom).
const BALLS = {
  'Poké Ball': (p) => p.hatch(TOP, { gap: 8 }),
  'Great Ball': (p) => {
    p.hatch(TOP, { angle: -30, gap: 12, width: 1.8 });
    const patch = [[30, 90], [36, 62], [52, 42], [64, 58], [58, 82]];
    for (const side of [patch, mirror(patch)]) p.shape(side);
    p.hatch(patch, { angle: 40, gap: 5 });
    p.hatch(mirror(patch), { angle: 40, gap: 5 });
  },
  'Ultra Ball': (p) => {
    p.hatch(TOP, { angle: 40, gap: 4.5 });
    const stripe = [[50, 96], [48, 62], [56, 32], [70, 24], [66, 60], [66, 96]];
    p.shape(stripe);
    p.shape(mirror(stripe));
  },
  'Master Ball': (p) => {
    p.hatch(TOP, { angle: 30, gap: 7 });
    p.circle(56, 58, 11, { fill: WHITE, width: 3.4 });
    p.circle(144, 58, 11, { fill: WHITE, width: 3.4 });
    const m = [[76, 84], [80, 50], [100, 70], [120, 50], [124, 84]];
    p.stroke(smooth(p.shake(m, 0.8)), 13, WHITE);
    p.line(m, { width: 4.5, shake: 0.6 });
  },
  'Safari Ball': (p) => {
    for (const [x, y, r] of [[60, 52, 12], [104, 40, 10], [140, 62, 13], [84, 78, 9], [124, 86, 8], [44, 82, 8]]) {
      const spot = blob(p, x, y, r);
      p.shape(spot, { width: 3 });
      p.hatch(spot, { angle: 60, gap: 4 });
    }
  },
  'Fast Ball': (p) => {
    const bolt = [[26, 84], [60, 62], [72, 76], [100, 48], [128, 76], [140, 62], [174, 84]];
    p.hatch([[22, 98], ...bolt, [178, 98]], { angle: 30, gap: 6 });
    p.line(bolt, { shake: 1 });
    p.hatch(TOP, { angle: -40, gap: 14, width: 1.6 });
  },
  'Level Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 12, width: 1.6 });
    p.hatch(rect(22, 74, 178, 98), { angle: 35, gap: 4.5 });
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
    p.path(heartPath(100, 60, 1), { fill: WHITE, width: 4, length: 170 });
    p.hatch(heartPoly(100, 60, 1), { angle: -40, gap: 5 });
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
    p.path('M86,32 A28,28 0 1 0 118,74 A22,22 0 1 1 86,32 Z', { fill: WHITE, width: 3.6, length: 160 });
    p.shape(star(140, 44, 8), { width: 2.4, shake: 0.4 });
    p.shape(star(56, 60, 6), { width: 2.4, shake: 0.4 });
  },
  'Sport Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 10, width: 1.8 });
    for (const x of [62, 138]) {
      const side = x < 100 ? 1 : -1;
      p.line([[x - 6, 96], [x + side * 4, 64], [x + side * 16, 30]], { width: 3.4 });
      for (let t = 0.2; t < 0.9; t += 0.22) {
        const y = 96 - 66 * t;
        const cx = x - 6 + side * 20 * t;
        p.line([[cx - 5, y - 2], [cx + 5, y + 2]], { width: 2.2, shake: 0.4 });
      }
    }
  },
  'Premier Ball': (p) => {
    p.hatch(rect(20, 92, 180, 108), { angle: 35, gap: 3.5 });
    p.shape(star(62, 46, 9), { width: 2.4, shake: 0.4 });
  },
  'Repeat Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 11, width: 1.8 });
    p.hatch([...arc(100, 98, 60, 60, deg(180), deg(360), 24), ...arc(100, 98, 40, 40, deg(360), deg(180), 18)], { angle: -35, gap: 4.5 });
    p.line([[40, 96], [48, 62], [100, 38], [152, 62], [160, 96]]);
    p.line([[60, 96], [66, 74], [100, 58], [134, 74], [140, 96]]);
  },
  'Timer Ball': (p) => {
    for (const x of [46, 78, 110, 142]) p.hatch(rect(x, 22, x + 14, 98), { angle: 35, gap: 4.5 });
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
    for (const [x, y, r] of [[128, 30, 5], [140, 22, 3.5], [70, 32, 4]]) p.circle(x, y, r, { width: 2.4, fill: WHITE });
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
    p.shape([[92, 30], [108, 30], [108, 46], [124, 46], [124, 62], [108, 62], [108, 78], [92, 78], [92, 62], [76, 62], [76, 46], [92, 46]], { width: 3.4, shake: 0.5, straight: true });
  },
  'Quick Ball': (p) => {
    p.hatch(TOP, { angle: 35, gap: 8, width: 2 });
    for (const side of [1, -1]) {
      const bolt = [[100 + side * 22, 92], [100 + side * 36, 60], [100 + side * 30, 26]];
      p.line(bolt, { width: 7 });
      p.line(bolt, { width: 2.6, shake: 0.3 });
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
    const zig = [[34, 92], [58, 40], [82, 72], [100, 28], [118, 72], [142, 40], [166, 92]];
    p.shape(zig, { width: 3.2, shake: 0.6 });
    p.hatch(zig, { angle: -40, gap: 11, width: 1.6 });
  },
  'Strange Ball': (p) => {
    p.hatch([[100, 98], ...arc(100, 98, 78, 78, deg(180), deg(270), 12)], { angle: 40, gap: 4.5 });
    p.hatch([[100, 98], ...arc(100, 98, 78, 78, deg(270), deg(360), 12)], { angle: -35, gap: 9, width: 2 });
    p.line([[100, 22], [96, 50], [104, 70], [100, 96]], { width: 3 });
    p.stroke('M126,40 C126,28 146,28 146,40 C146,50 136,50 136,60', 11, WHITE);
    p.line([[126, 40], [128, 30], [138, 28], [146, 36], [142, 48], [136, 52], [136, 60]], { width: 3.6, shake: 0.4 });
    p.dot(136, 71, 3.2);
  },
};

/** The parts every ball shares: outline, band, button, and a little shine. */
function ball(name, pen) {
  pen.phase = 1.5; // the ball's own markings come after its outline, band, and button
  BALLS[name]?.(pen);
  pen.clipSince(0, 'M21,100 A79,79 0 1 0 179,100 A79,79 0 1 0 21,100 Z'); // markings stay inside the ball
  pen.phase = 1;
  const bandTop = Array.from({ length: 6 }, (_, i) => [22 + i * 12.4, 94 + i * 0.6]);
  const bandBottom = bandTop.map(([x, y]) => [x, y + 11]);
  pen.hatch([[20, 94], [80, 97], [80, 108], [20, 106]], { angle: 35, gap: 3.5 });
  pen.hatch([[120, 97], [180, 94], [180, 106], [120, 108]], { angle: 35, gap: 3.5 });
  for (const band of [bandTop, bandBottom]) {
    pen.line(band);
    pen.line(mirror(band).reverse());
  }
  pen.phase = 0;
  pen.circle(100, 100, 80, { width: 4.6 });
  pen.phase = pen.random() < 0.5 ? 0.9 : 1.1; // some balls get their button before the band
  pen.circle(100, 100, 20, { fill: WHITE, width: 4.2 });
  pen.circle(100, 100, 10, { width: 3.2, overshoot: 0.2 });
  pen.stroke(`M${pt([46 + pen.jit(2), 58])} Q${pt([52, 40])} ${pt([70 + pen.jit(2), 32])}`, 6, WHITE);
}

// ------------------------------------------------------------------------------------------------
// Coins (moola), one per currency, in the same order as the spots.

const CURRENCIES = [
  ['$', 'USD'], ['€', 'EUR'], ['£', 'GBP'], ['¥', 'JPY'], ['C$', 'CAD'], ['A$', 'AUD'], ['Fr', 'CHF'], ['¥', 'CNY'],
  ['₹', 'INR'], ['$', 'MXN'], ['R$', 'BRL'], ['₩', 'KRW'], ['S$', 'SGD'], ['HK$', 'HKD'], ['kr', 'SEK'], ['kr', 'NOK'],
  ['NZ$', 'NZD'], ['R', 'ZAR'], ['₽', 'RUB'], ['₺', 'TRY'], ['د.إ', 'AED'], ['₱', 'PHP'], ['฿', 'THB'], ['zł', 'PLN'],
];

function coin(pen, [symbol, code], i) {
  pen.phase = 0;
  pen.circle(100, 100, 80, { width: 4.4, fill: WHITE });
  pen.phase = 0.5;
  pen.circle(100, 100, 67, { width: 2.4, wobble: 0.015 });
  // The coin's thickness, shaded along its lower right edge.
  const [a0, a1] = [deg(-15), deg(115)];
  pen.hatch([...arc(100, 100, 80, 80, a0, a1, 16), ...arc(100, 100, 67, 67, a1, a0, 16)], { angle: 45, gap: 4 });
  // A different rim on each coin: ridges, beads, or plain.
  pen.phase = 1.6;
  if (i % 3 === 0) {
    for (let k = 0; k < 40; k++) pen.line([at(100, 100, 69, deg(k * 9)), at(100, 100, 76, deg(k * 9))], { width: 1.8, shake: 0.3 });
  } else if (i % 3 === 1) {
    for (let k = 0; k < 28; k++) pen.dot(...at(100, 100, 73.5, deg(k * (360 / 28))), 1.9);
  }
  pen.phase = 1;
  pen.text(symbol, 100, 92, 60, { width: 5, maxWidth: 88, gap: 12 });
  pen.phase = 1.2;
  pen.text(code, 100, 140, 13, { width: 2.6, gap: 18 });
  pen.phase = 1.8;
  pen.line(arc(100, 100, 56, 56, deg(200), deg(245), 6), { width: 2.6, shake: 0.4 });
}

// ------------------------------------------------------------------------------------------------
// Everything else, one sketch per spot, matched to its idea in src/data/doodle-spots.js.

/** A pencil lying along the x axis: tip at 0, eraser at `length`. */
function pencil(p, { length = 116, half = 10, x, y, turn, stripes = true }) {
  const put = (points) => place(points, { x, y, turn });
  const cone = length * 0.19;
  const ferrule = length * 0.8;
  p.shape(put([[cone, -half], [ferrule, -half], [ferrule, half], [cone, half]]), { straight: true });
  if (stripes) {
    p.line(put([[cone + 4, -half / 3], [ferrule - 4, -half / 3]]), { width: 1.8, shake: 0.4, straight: true });
    p.line(put([[cone + 4, half / 3], [ferrule - 4, half / 3]]), { width: 1.8, shake: 0.4, straight: true });
  }
  p.shape(put([[0, 0], [cone, -half], [cone, half]]), { straight: true });
  p.shape(put([[0, 0], [cone * 0.32, -half * 0.32], [cone * 0.32, half * 0.32]]), { fill: INK, straight: true, width: 2 });
  const band = put([[ferrule, -half], [ferrule + 12, -half], [ferrule + 12, half], [ferrule, half]]);
  p.shape(band, { straight: true });
  p.hatch(band, { angle: 70 + turn, gap: 3.5, width: 1.8 });
  p.shape(put([[ferrule + 12, -half], [length - 3, -half * 0.9], [length, 0], [length - 3, half * 0.9], [ferrule + 12, half]]));
}

/** A crayon lying along the x axis: tip at 0. */
function crayon(p, { length = 112, half = 11, x, y, turn }) {
  const put = (points) => place(points, { x, y, turn });
  const tip = length * 0.18;
  p.shape(put([[tip, -half], [length, -half], [length + 3, 0], [length, half], [tip, half]]));
  p.shape(put([[0, -2], [tip, -half * 0.8], [tip, half * 0.8], [0, 2]]), { straight: true });
  const wrapper = put([[tip + 10, -half], [length - 10, -half], [length - 10, half], [tip + 10, half]]);
  p.hatch(wrapper, { angle: 30 + turn, gap: 5, width: 2 });
  for (const edge of [tip + 10, length - 10]) {
    p.line(put([[edge, -half], [edge + 3, -half / 2], [edge - 3, 0], [edge + 3, half / 2], [edge, half]]), { width: 2.6, shake: 0.4, straight: true });
  }
  p.shape(put([[tip + 26, -half * 0.55], [length - 26, -half * 0.55], [length - 26, half * 0.55], [tip + 26, half * 0.55]]), { width: 2.2 });
}

/** An eraser: a rounded block with a hatched paper sleeve. */
function eraser(p, { x, y, turn, w = 104, h = 42 }) {
  const put = (points) => place(points, { x, y, turn });
  p.shape(put(roundedRect(-w / 2, -h / 2, w, h, 9)));
  const sleeve = put([[-w * 0.05, -h / 2], [w * 0.32, -h / 2], [w * 0.32, h / 2], [-w * 0.05, h / 2]]);
  p.shape(sleeve, { straight: true, width: 3 });
  p.hatch(sleeve, { angle: 60 + turn, gap: 5 });
  p.line(put([[-w / 2 + 8, h / 2 - 6], [-w * 0.12, h / 2 - 6]]), { width: 2, shake: 0.5 });
}

const crumbs = (p, points) => {
  for (const [x, y, r] of points) {
    if (r > 2.5) p.shape(blob(p, x, y, r, 5), { width: 2.2 });
    else p.dot(x, y, r);
  }
};

const DRAWINGS = {
  // About ---------------------------------------------------------------------------------------
  '1a': (p) => {
    // A globe, with a paper plane looping around it.
    p.circle(90, 108, 58, { width: 4.4, fill: WHITE });
    const from = p.parts.length;
    p.ellipse(90, 108, 24, 58, { width: 2.4, overshoot: 0.1 });
    p.line([[32, 108], [90, 111], [148, 108]], { width: 2.4 });
    p.line([[38, 80], [90, 84], [142, 80]], { width: 2.2 });
    p.line([[38, 136], [90, 140], [142, 136]], { width: 2.2 });
    for (const [x, y, r] of [[68, 90, 15], [112, 130, 13], [118, 84, 8]]) {
      const land = blob(p, x, y, r);
      p.shape(land, { width: 2.6 });
      p.hatch(land, { angle: 50, gap: 4 });
    }
    p.clipSince(from, ellipsePath(90, 108, 57, 57));
    p.dashed(arc(90, 108, 84, 68, deg(140), deg(322), 30), { width: 2.4 });
    p.shape([[148, 70], [186, 42], [164, 80]], { straight: true, width: 3.4 });
    p.line([[186, 42], [158, 66], [156, 80]], { width: 2.6, straight: true });
  },
  '1b': (p) => {
    // A tiny robot, checkmark on its chest, waving.
    p.line([[100, 44], [100, 28]], { width: 3.4 });
    p.circle(100, 23, 6, { width: 3, fill: WHITE });
    p.rect(66, 44, 68, 48, { r: 12 });
    for (const x of [86, 114]) {
      p.circle(x, 66, 8, { width: 3, fill: WHITE });
      p.dot(x + 2, 67, 3.4);
    }
    p.line([[90, 81], [100, 84], [110, 81]], { width: 2.8 });
    p.rect(62, 98, 76, 56, { r: 10 });
    p.hatch(rect(64, 140, 136, 152), { gap: 4.5 });
    p.line([[84, 122], [96, 134], [118, 108]], { width: 4.6, straight: true });
    p.line([[62, 110], [46, 126], [40, 142]], { width: 4 });
    p.line([[138, 110], [154, 94], [160, 74]], { width: 4 });
    p.circle(40, 148, 6, { width: 3, fill: WHITE });
    p.circle(161, 68, 6, { width: 3, fill: WHITE });
    p.line([[82, 154], [82, 176]], { width: 4 });
    p.line([[118, 154], [118, 176]], { width: 4 });
    p.line([[70, 178], [90, 178]], { width: 4.4 });
    p.line([[110, 178], [130, 178]], { width: 4.4 });
    p.line([[170, 56], [178, 48]], { width: 2.4 });
    p.line([[174, 72], [185, 70]], { width: 2.4 });
  },
  '1c': (p) => {
    // A loop-de-loop arrow.
    p.line([[26, 60], [60, 42], [96, 50], [112, 76], [100, 100], [78, 94], [78, 72], [104, 64], [132, 80], [150, 110], [160, 142]], { width: 4.6 });
    p.line([[142, 132], [161, 148], [172, 124]], { width: 4.6, straight: true });
  },
  '1d': (p) => {
    // A hand waving hello.
    p.shape([
      [76, 176], [66, 140], [60, 120], [38, 100], [36, 90], [46, 88], [68, 108], [64, 70], [68, 48], [80, 46], [86, 60],
      [90, 84], [92, 50], [98, 36], [110, 38], [110, 84], [114, 54], [122, 48], [130, 56], [126, 92], [132, 70],
      [140, 68], [144, 78], [138, 112], [132, 142], [124, 176],
    ], { width: 4 });
    p.line([[72, 172], [128, 172]], { width: 3.4 });
    p.line([[80, 130], [92, 126]], { width: 2.2 });
    p.line([[150, 44], [162, 58], [164, 76]], { width: 2.8 });
    p.line([[160, 30], [176, 46], [180, 70]], { width: 2.8 });
    p.line([[42, 58], [34, 72], [34, 88]], { width: 2.8 });
  },

  // Projects ------------------------------------------------------------------------------------
  '2a': (p) => {
    // Two gears.
    const gear = (cx, cy, rOut, rIn, teeth, phase) => {
      const step = (Math.PI * 2) / teeth;
      return Array.from({ length: teeth }, (_, i) => {
        const a = phase + i * step;
        return [at(cx, cy, rIn, a), at(cx, cy, rOut, a + step * 0.15), at(cx, cy, rOut, a + step * 0.45), at(cx, cy, rIn, a + step * 0.6)];
      }).flat();
    };
    p.shape(gear(148, 54, 32, 24, 8, 0.2), { straight: true, width: 3.4 });
    p.circle(148, 54, 9, { width: 3, fill: WHITE });
    p.shape(gear(88, 114, 64, 50, 10, 0), { straight: true, width: 4 });
    p.circle(88, 114, 30, { width: 3, fill: WHITE });
    p.hatch(ellipsePoly(88, 114, 29, 29), { angle: 40, gap: 5 });
    p.circle(88, 114, 12, { width: 3.4, fill: WHITE });
  },
  '2b': (p) => {
    // A wrench, and the nut it fits.
    const put = (points) => place(points, { x: 92, y: 110, turn: -40 });
    const outline = [[-74, 0], [-66, -10], [20, -10], [30, -19], [46, -27], [64, -23], [80, -11], [58, -8], [58, 8], [80, 11], [64, 23], [46, 27], [30, 19], [20, 10], [-66, 10]];
    p.shape(put(outline), { width: 4, straight: true });
    p.hatch(put(rect(-50, -10, 2, 10)), { angle: 20, gap: 4.5 });
    p.circle(...put([[-60, 0]])[0], 5, { width: 2.6 });
    const nut = Array.from({ length: 6 }, (_, i) => at(160, 40, 15, deg(i * 60 + 10)));
    p.shape(nut, { straight: true, width: 3.2 });
    p.circle(160, 40, 6, { width: 2.6 });
  },
  '2c': (p) => {
    // A coffee mug, still steaming.
    p.shape([[58, 92], [60, 150], [70, 164], [116, 164], [126, 150], [128, 92]], { width: 4.2 });
    p.line([[128, 104], [150, 102], [158, 118], [150, 136], [128, 140]], { width: 4.2 });
    p.ellipse(93, 92, 35, 9, { width: 3.8, fill: WHITE });
    p.hatch(ellipsePoly(93, 93, 28, 5), { gap: 3.5 });
    p.path(heartPath(93, 128, 0.5), { width: 3, length: 85 });
    for (const x of [80, 96, 112]) p.line([[x, 74], [x - 6, 62], [x + 2, 50], [x - 4, 36]], { width: 3 });
  },

  // ykabusalah.me --------------------------------------------------------------------------------
  '3a': (p) => {
    // Draw, review, home: the loop the site runs on.
    p.rect(22, 30, 58, 46, { r: 6 });
    p.line([[32, 60], [42, 46], [50, 62], [60, 44], [70, 56]], { width: 2.8 });
    p.line([[86, 48], [100, 44], [114, 50]], { width: 3 });
    p.line([[106, 42], [116, 50], [106, 58]], { width: 3, straight: true });
    p.rect(120, 30, 58, 46, { r: 6 });
    p.line([[134, 54], [144, 64], [164, 42]], { width: 3.6, straight: true });
    p.line([[152, 82], [148, 104], [136, 126]], { width: 3 });
    p.line([[130, 118], [134, 132], [148, 126]], { width: 3, straight: true });
    p.rect(71, 124, 58, 46, { r: 6 });
    p.line([[86, 162], [86, 146], [100, 134], [114, 146], [114, 162]], { width: 2.8, straight: true });
    p.line([[96, 162], [96, 152], [104, 152], [104, 162]], { width: 2.4, straight: true });
    p.line([[66, 144], [48, 120], [48, 88]], { width: 3 });
    p.line([[38, 98], [48, 84], [58, 96]], { width: 3, straight: true });
  },
  '3b': (p) => {
    // A pencil, mid-scribble.
    pencil(p, { x: 62, y: 138, turn: -45, length: 128, half: 11 });
    p.line([[62, 138], [46, 148], [34, 136], [48, 124], [58, 138], [42, 156], [24, 152], [32, 138], [56, 156], [80, 164]], { width: 3 });
  },
  '3c': (p) => {
    // An eraser and its crumbs.
    eraser(p, { x: 110, y: 90, turn: -18 });
    p.line([[56, 122], [70, 118]], { width: 2.2 });
    p.line([[48, 112], [62, 106]], { width: 2.2 });
    crumbs(p, [[46, 146, 4], [62, 156, 5], [38, 130, 2], [80, 150, 3.5], [54, 170, 2.2], [92, 164, 2], [30, 156, 3]]);
  },
  '3d': (p) => {
    // A paint palette and brush.
    const palette = [[40, 122], [34, 86], [56, 52], [100, 40], [146, 50], [170, 84], [160, 122], [132, 146], [104, 144], [98, 126], [80, 120], [66, 140], [48, 138]];
    p.shape(palette, { width: 4.2 });
    p.circle(118, 118, 11, { width: 3, fill: WHITE });
    for (const [x, y, r, gap] of [[66, 74, 11, 4], [100, 60, 10, 7], [136, 68, 11, 0], [152, 98, 9, 3.5], [60, 104, 8, 10]]) {
      const splot = blob(p, x, y, r, 6);
      p.shape(splot, { width: 2.6 });
      if (gap) p.hatch(splot, { angle: 30 + x, gap });
    }
    const put = (points) => place(points, { x: 128, y: 168, turn: -38 });
    p.shape(put([[0, -4], [70, -3], [74, 0], [70, 3], [0, 4]]), { width: 3 });
    p.shape(put([[-14, -6], [0, -5], [0, 5], [-14, 6]]), { straight: true, width: 3 });
    p.shape(put([[-14, -6], [-30, -4], [-40, 0], [-30, 4], [-14, 6]]), { width: 3, fill: INK });
  },
  '3e': (p) => {
    // A cursor, and the crayon it's drawing with. The crayon's line goes down last, underneath it.
    p.phase = 1.4;
    p.line([[120, 160], [96, 152], [72, 166], [50, 158], [26, 170]], { width: 5.5 });
    p.phase = 1;
    p.shape([[46, 26], [46, 110], [64, 94], [78, 124], [92, 118], [78, 88], [102, 88]], { straight: true, width: 4 });
    crayon(p, { x: 122, y: 158, turn: -50, length: 100, half: 11 });
  },
  '3f': (p) => {
    // A browser window with a little sun drawn inside.
    p.rect(26, 38, 148, 120, { r: 8, width: 4 });
    p.line([[26, 60], [174, 60]], { width: 3 });
    for (const x of [38, 48, 58]) p.circle(x, 49, 3.4, { width: 2.2 });
    p.rect(72, 43, 90, 12, { r: 5, width: 2.2 });
    p.circle(100, 110, 22, { width: 3.6, fill: WHITE });
    for (let k = 0; k < 8; k++) p.line([at(100, 110, 30, deg(k * 45)), at(100, 110, 38, deg(k * 45))], { width: 3, shake: 0.5 });
    p.dot(92, 105, 2.8);
    p.dot(108, 105, 2.8);
    p.line([[90, 116], [100, 122], [110, 116]], { width: 2.8 });
  },
  '3g': (p) => {
    // A top hat, for a head that needs a new one.
    p.ellipse(100, 148, 64, 14, { width: 4, fill: WHITE });
    const crown = [[66, 148], [70, 62], [130, 62], [134, 148]];
    p.shape(crown, { width: 4 });
    p.hatch(crown, { angle: 30, gap: 7, width: 1.8 });
    p.hatch([[68, 120], [132, 120], [133, 138], [67, 138]], { angle: -30, gap: 3.2 });
    p.line([[68, 120], [132, 120]], { width: 2.6 });
    p.line([[67, 138], [133, 138]], { width: 2.6 });
    p.line(arc(100, 148, 64, 14, deg(10), deg(170), 12), { width: 4 });
    p.ellipse(100, 62, 30, 7, { width: 3.4, fill: WHITE });
    p.hatch(ellipsePoly(100, 62, 28, 5), { angle: 30, gap: 5, width: 1.6 });
    p.shape(sparkle(38, 70, 12), { width: 2.6, shake: 0.4 });
    p.shape(sparkle(166, 96, 8), { width: 2.4, shake: 0.4 });
  },
  '3h': (p) => {
    // A roll of tape, with a strip pulled off.
    p.shape([[140, 110], [184, 144], [178, 150], [184, 156], [176, 160], [180, 168], [168, 170], [124, 136]], { width: 3.4, straight: true });
    p.circle(94, 100, 60, { width: 4.4, fill: WHITE });
    p.circle(94, 100, 30, { width: 3.4, fill: WHITE });
    p.hatch(ellipsePoly(94, 100, 30, 30), { angle: 40, gap: 6, width: 1.8 });
    p.circle(94, 100, 22, { width: 3, fill: WHITE });
    p.line(arc(94, 100, 48, 48, deg(200), deg(250), 6), { width: 2.4, shake: 0.4 });
  },

  // echoes ---------------------------------------------------------------------------------------
  '4a': (p) => {
    // A story that branches on a question.
    p.circle(100, 30, 12, { width: 3.4, fill: WHITE });
    p.line([[100, 44], [100, 66]], { width: 3 });
    p.line([[92, 58], [100, 68], [108, 58]], { width: 3, straight: true });
    p.shape([[100, 72], [128, 98], [100, 124], [72, 98]], { straight: true, width: 3.6 });
    p.text('?', 100, 98, 26, { width: 3.4 });
    p.line([[82, 114], [62, 136], [54, 146]], { width: 3 });
    p.line([[48, 136], [52, 150], [66, 146]], { width: 3, straight: true });
    p.line([[118, 114], [138, 136], [146, 146]], { width: 3 });
    p.line([[134, 146], [148, 150], [152, 136]], { width: 3, straight: true });
    for (const x of [22, 122]) {
      p.rect(x, 152, 56, 32, { r: 5, width: 3.2 });
      p.line([[x + 8, 164], [x + 46, 164]], { width: 2.2, shake: 0.5 });
      p.line([[x + 8, 173], [x + 34, 173]], { width: 2.2, shake: 0.5 });
    }
  },
  '4b': (p) => {
    // An open storybook.
    p.shape([[108, 150], [108, 182], [114, 175], [120, 182], [120, 150]], { straight: true, width: 3 });
    const page = [[100, 62], [80, 52], [52, 50], [26, 58], [26, 150], [52, 142], [80, 144], [100, 154]];
    p.shape(page, { width: 4 });
    p.shape(mirror(page), { width: 4 });
    p.line([[100, 62], [100, 154]], { width: 3.4 });
    p.line([[26, 154], [52, 148], [100, 160], [148, 148], [174, 154]], { width: 2.6 });
    for (const y of [74, 88, 102, 116, 130]) {
      p.line([[38, y], [88, y + 4]], { width: 2, shake: 0.5 });
      p.line([[112, y + 4], [162, y]], { width: 2, shake: 0.5 });
    }
  },
  '4c': (p) => {
    // A path that splits in two, with a signpost.
    p.line([[64, 188], [76, 150], [86, 124], [80, 100], [58, 74], [32, 54]], { width: 4 });
    p.line([[136, 188], [124, 150], [114, 124], [120, 100], [142, 74], [168, 54]], { width: 4 });
    p.line([[56, 50], [80, 72], [100, 98], [120, 72], [144, 50]], { width: 4 });
    p.dashed([[100, 184], [100, 124]], { width: 2.4 });
    p.dashed([[98, 112], [76, 86], [50, 62]], { width: 2.4 });
    p.dashed([[102, 112], [124, 86], [150, 62]], { width: 2.4 });
    p.line([[34, 188], [34, 122]], { width: 4 });
    p.shape([[36, 124], [14, 124], [6, 132], [14, 140], [36, 140]], { straight: true, width: 3 });
    p.shape([[32, 146], [54, 146], [62, 154], [54, 162], [32, 162]], { straight: true, width: 3 });
  },
  '4d': (p) => {
    // A quill in an ink pot: the pot is drawn first, but the quill sits behind it.
    p.phase = 1.3;
    const vane = [[98, 104], [112, 74], [140, 44], [172, 18], [164, 42], [146, 70], [118, 100]];
    p.shape(vane, { width: 3.4 });
    p.hatch(vane, { angle: -10, gap: 6, width: 1.6 });
    p.line([[84, 128], [112, 90], [140, 58], [170, 22]], { width: 3.2 });
    p.phase = 1;
    p.shape([[50, 134], [44, 162], [54, 178], [110, 178], [120, 162], [114, 134]], { width: 4 });
    p.hatch([[46, 152], [118, 152], [120, 162], [110, 178], [54, 178], [44, 162]], { gap: 3.6 });
    p.rect(64, 120, 36, 16, { r: 3, width: 3.4 });
    p.ellipse(82, 120, 20, 5, { width: 3, fill: WHITE });
    p.line([[58, 142], [56, 160]], { width: 2.4 });
  },
  '4e': (p) => {
    // A smiling theater mask.
    p.shape([[50, 56], [76, 44], [100, 42], [124, 44], [150, 56], [152, 92], [140, 126], [120, 150], [100, 158], [80, 150], [60, 126], [48, 92]], { width: 4.2 });
    p.line([[62, 72], [78, 64], [94, 70]], { width: 3 });
    p.line(mirror([[62, 72], [78, 64], [94, 70]]), { width: 3 });
    const eye = [[64, 88], [76, 78], [92, 86], [80, 94]];
    for (const side of [eye, mirror(eye)]) {
      p.shape(side, { width: 3 });
      p.hatch(side, { gap: 3 });
    }
    const mouth = [[70, 116], [100, 120], [130, 116], [120, 134], [100, 142], [80, 134]];
    p.shape(mouth, { width: 3.4 });
    p.hatch(mouth, { gap: 3.4 });
    p.hatch(ellipsePoly(64, 112, 7, 5), { angle: -30, gap: 3, width: 1.6 });
    p.hatch(ellipsePoly(136, 112, 7, 5), { angle: -30, gap: 3, width: 1.6 });
    p.line([[52, 70], [30, 86], [22, 110]], { width: 3 });
    p.line([[52, 80], [38, 100], [40, 122]], { width: 3 });
  },
  '4f': (p) => {
    // A question mark in a speech bubble.
    p.shape([[36, 56], [52, 34], [100, 26], [150, 34], [168, 64], [160, 98], [124, 112], [100, 114], [86, 144], [80, 112], [46, 104], [30, 82]], { width: 4.2 });
    p.text('?', 100, 70, 60, { width: 6 });
    p.line([[164, 24], [174, 14]], { width: 2.8 });
    p.line([[176, 40], [188, 36]], { width: 2.8 });
  },
  '4g': (p) => {
    // A compass.
    p.circle(100, 106, 70, { width: 4.4, fill: WHITE });
    p.circle(100, 28, 8, { width: 3.2 });
    p.circle(100, 106, 58, { width: 2.4 });
    const north = [[100, 58], [112, 106], [88, 106]];
    p.shape(north, { straight: true, width: 3.2 });
    p.shape([[100, 154], [112, 106], [88, 106]], { straight: true, width: 3.2 });
    p.circle(100, 106, 6, { width: 2.6, fill: WHITE });
    for (let k = 0; k < 16; k++) {
      const long = k % 4 === 0;
      p.line([at(100, 106, long ? 60 : 62, deg(k * 22.5)), at(100, 106, 68, deg(k * 22.5))], { width: long ? 3 : 1.8, shake: 0.3 });
    }
    p.hatch(north, { gap: 3.2 });
  },
  '4h': (p) => {
    // A closed book, its ribbon bookmark hanging out the bottom.
    const ribbon = [[118, 146], [132, 146], [132, 186], [125, 177], [118, 186]];
    p.shape(ribbon, { straight: true, width: 3 });
    p.hatch(ribbon, { gap: 4, width: 1.6 });
    p.rect(46, 46, 116, 106, { r: 4, width: 3.4 });
    for (const x of [156, 159]) p.line([[x, 52], [x, 146]], { width: 1.6, shake: 0.4 });
    p.rect(38, 38, 116, 106, { r: 5, width: 4 });
    p.hatch(rect(40, 40, 54, 142), { gap: 3.8 });
    p.line([[54, 40], [54, 142]], { width: 2.8 });
    p.line([[72, 68], [136, 68]], { width: 2.8 });
    p.line([[78, 82], [130, 82]], { width: 2.4 });
    p.shape(star5(104, 112, 13), { straight: true, width: 2.6 });
  },

  // Art -------------------------------------------------------------------------------------------
  '7a': (p) => {
    // A paintbrush and its stroke: the paint goes down after the brush, underneath it.
    p.phase = 1.4;
    p.line([[126, 114], [92, 134], [56, 132], [26, 156]], { width: 10 });
    p.phase = 1;
    const put = (points) => place(points, { x: 128, y: 110, turn: -42 });
    p.shape(put([[56, -7], [148, -4], [154, 0], [148, 4], [56, 7]]), { width: 3.4 });
    const ferrule = put([[36, -8], [56, -7], [56, 7], [36, 8]]);
    p.shape(ferrule, { straight: true, width: 3 });
    p.hatch(ferrule, { angle: 50, gap: 3.5, width: 1.8 });
    p.shape(put([[0, 0], [10, -7], [26, -9], [36, -7], [36, 7], [26, 9], [10, 7]]), { width: 3 });
    p.line(put([[12, -3], [32, -3]]), { width: 1.6, shake: 0.3 });
  },
  '7b': (p) => {
    // A small traveler with a backpack, pointing at a star.
    p.rect(64, 88, 28, 42, { r: 6, width: 3.2 });
    p.hatch(rect(66, 100, 90, 128), { gap: 4 });
    p.line([[88, 96], [80, 118]], { width: 3.4 });
    p.shape([[88, 84], [112, 84], [120, 134], [80, 134]], { width: 3.8 });
    p.circle(100, 62, 18, { width: 3.8, fill: WHITE });
    p.line([[84, 56], [90, 46], [100, 43], [112, 47], [118, 57]], { width: 4 });
    p.dot(99, 64, 2.6);
    p.dot(109, 63, 2.6);
    p.line([[98, 72], [106, 72]], { width: 2.4 });
    p.line([[112, 92], [132, 70], [140, 56]], { width: 4 });
    p.line([[92, 132], [86, 164]], { width: 4 });
    p.line([[108, 132], [114, 164]], { width: 4 });
    p.line([[80, 166], [90, 166]], { width: 4 });
    p.line([[110, 166], [120, 166]], { width: 4 });
    p.shape(star5(154, 38, 17), { straight: true, width: 3.2 });
  },
  '7c': (p) => {
    // A crumpled-up page, bits of writing still on it.
    const page = Array.from({ length: 20 }, (_, i) => at(100, 100, (i % 2 ? 50 : 60) + p.jit(8), deg(i * 18)));
    p.shape(page, { straight: true, width: 4 });
    for (const crease of [[[60, 64], [84, 84], [80, 110], [58, 128]], [[110, 50], [116, 80], [142, 92], [158, 84]], [[76, 140], [100, 120], [128, 136], [140, 156]], [[84, 84], [110, 96], [116, 80]], [[110, 96], [104, 120]], [[142, 92], [136, 118], [128, 136]]]) {
      p.line(crease, { width: 2.4, straight: true, shake: 0.8 });
    }
    p.hatch([[84, 84], [110, 96], [104, 120], [80, 110]], { gap: 4, width: 1.8 });
    p.hatch([[116, 80], [142, 92], [136, 118], [110, 96]], { angle: -30, gap: 5, width: 1.6 });
    for (const [x, y, w] of [[120, 60, 22], [124, 68, 16], [60, 96, 14], [62, 104, 10], [110, 146, 18]]) {
      p.line([[x, y], [x + w, y + 3]], { width: 1.8, shake: 0.5 });
    }
  },
  '8a': (p) => {
    // A stack of books, with a sprout growing from the top.
    const books = [
      [[34, 134], [166, 134], [168, 162], [32, 162]],
      [[46, 108], [158, 104], [160, 134], [48, 136]],
      [[40, 80], [150, 74], [154, 104], [42, 108]],
    ];
    books.forEach((book, i) => {
      p.shape(book, { straight: true, width: 3.8 });
      const [a, b, c, d] = book;
      const band = i % 2 ? [[b[0] - 18, b[1]], b, c, [c[0] - 18, c[1]]] : [a, [a[0] + 18, a[1]], [d[0] + 18, d[1]], d];
      p.hatch(band, { gap: 4 });
      const mid = (a[1] + d[1]) / 2;
      p.line([[a[0] + (i % 2 ? 16 : 30), mid], [b[0] - (i % 2 ? 30 : 16), (b[1] + c[1]) / 2]], { width: 2.2, shake: 0.5 });
    });
    p.line([[100, 76], [100, 46]], { width: 3 });
    p.shape([[100, 58], [82, 48], [74, 34], [92, 38]], { width: 2.8 });
    p.shape([[100, 50], [114, 36], [130, 34], [120, 48]], { width: 2.8 });
  },
  '9a': (p) => {
    // A rose.
    const bloom = [[64, 72], [70, 46], [92, 34], [118, 38], [134, 58], [132, 84], [112, 100], [86, 102]];
    p.shape(bloom, { width: 4 });
    p.line([[98, 66], [104, 60], [110, 66], [106, 76], [94, 78], [84, 68], [88, 54], [104, 48], [120, 56], [124, 74], [114, 88]], { width: 3 });
    p.line([[70, 78], [84, 90], [104, 94]], { width: 2.6 });
    p.hatch([[64, 72], [86, 102], [112, 100], [132, 84], [118, 86], [96, 90], [76, 82]], { angle: 25, gap: 5, width: 1.8 });
    p.line([[98, 100], [104, 126], [110, 150], [124, 178]], { width: 4 });
    for (const [x, y, dx] of [[103, 118, -8], [110, 146, 8], [117, 164, -7]]) p.line([[x, y], [x + dx, y - 5]], { width: 2.4, shake: 0.3, straight: true });
    for (const leaf of [[[104, 132], [84, 122], [68, 130], [86, 140]], [[114, 154], [134, 144], [150, 152], [132, 162]]]) {
      p.shape(leaf, { width: 3 });
      p.line([leaf[0], leaf[2]], { width: 2, shake: 0.4 });
    }
  },
  '10a': (p) => {
    // Stars over a mountain ridge.
    const ridge = [[16, 158], [46, 110], [60, 124], [90, 70], [110, 98], [128, 84], [150, 112], [184, 158]];
    p.line(ridge, { width: 4.2, straight: true });
    p.line([[16, 166], [184, 166]], { width: 3 });
    p.hatch([...ridge, [184, 164], [16, 164]], { gap: 6.5, width: 1.8 });
    p.line([[80, 86], [86, 94], [92, 84], [98, 92], [102, 84]], { width: 2.4, straight: true });
    p.shape(sparkle(44, 48, 11), { width: 2.8, shake: 0.4 });
    p.shape(sparkle(142, 38, 15), { width: 3, shake: 0.4 });
    p.shape(sparkle(172, 76, 7), { width: 2.4, shake: 0.3 });
    for (const [x, y] of [[74, 34], [108, 26], [166, 18], [22, 80], [118, 58]]) p.dot(x, y, 2.4);
  },
  '11a': (p) => {
    // A butterfly.
    const upper = [[98, 80], [72, 50], [40, 46], [30, 70], [46, 96], [96, 102]];
    const lower = [[98, 106], [62, 110], [50, 138], [70, 154], [98, 124]];
    for (const wing of [upper, lower, mirror(upper), mirror(lower)]) p.shape(wing, { width: 3.6 });
    p.hatch([[98, 80], [72, 50], [40, 46], [30, 70]], { angle: -30, gap: 6, width: 1.6 });
    p.hatch(mirror([[98, 80], [72, 50], [40, 46], [30, 70]]), { angle: 30, gap: 6, width: 1.6 });
    for (const [x, y, r] of [[56, 68, 9], [144, 68, 9], [72, 132, 6], [128, 132, 6]]) {
      p.circle(x, y, r, { width: 2.4, fill: WHITE });
      p.hatch(ellipsePoly(x, y, r - 1, r - 1), { gap: 3 });
    }
    p.shape([[100, 50], [106, 60], [104, 140], [100, 146], [96, 140], [94, 60]], { width: 3.4, fill: INK });
    p.line([[98, 52], [88, 34], [80, 28]], { width: 2.6 });
    p.line([[102, 52], [112, 34], [120, 28]], { width: 2.6 });
    p.circle(80, 27, 3, { width: 2.2 });
    p.circle(120, 27, 3, { width: 2.2 });
  },
  '12a': (p) => {
    // A little house with the sun out.
    p.shape([[60, 94], [60, 164], [144, 164], [144, 94]], { straight: true, width: 4 });
    p.shape([[128, 54], [128, 80], [142, 80], [142, 62]], { straight: true, width: 3.2 });
    p.shape([[48, 98], [102, 48], [156, 98]], { straight: true, width: 4.2 });
    p.hatch([[52, 96], [102, 52], [152, 96]], { angle: 40, gap: 5, width: 1.8 });
    p.shape([[90, 164], [90, 128], [112, 128], [112, 164]], { straight: true, width: 3.2 });
    p.dot(107, 148, 2.4);
    p.rect(118, 110, 18, 18, { r: 2, width: 3 });
    p.line([[127, 110], [127, 128]], { width: 2.2 });
    p.line([[118, 119], [136, 119]], { width: 2.2 });
    p.line([[134, 48], [128, 38], [136, 30], [130, 20]], { width: 2.4 });
    p.circle(38, 40, 12, { width: 3, fill: WHITE });
    for (let k = 0; k < 8; k++) p.line([at(38, 40, 18, deg(k * 45)), at(38, 40, 26, deg(k * 45))], { width: 2.6, shake: 0.4 });
    p.line([[20, 170], [182, 170]], { width: 3 });
    for (const x of [30, 52, 150, 168]) p.line([[x - 5, 170], [x, 160], [x + 5, 170]], { width: 2.4, straight: true });
  },
  '13a': (p) => {
    // A late-night bus.
    p.rect(22, 64, 156, 80, { r: 12, width: 4.2 });
    for (let i = 0; i < 5; i++) p.rect(32 + i * 26, 76, 20, 26, { r: 3, width: 2.8 });
    p.rect(160, 76, 12, 50, { r: 3, width: 2.8 });
    p.line([[24, 114], [176, 114]], { width: 2.2 });
    p.line([[24, 122], [176, 122]], { width: 2.2 });
    p.hatch(rect(24, 114, 176, 122), { gap: 3.6 });
    for (const x of [56, 144]) {
      p.circle(x, 146, 16, { width: 4, fill: WHITE });
      p.circle(x, 146, 6, { width: 2.8 });
    }
    p.circle(172, 132, 4, { width: 2.4 });
    p.line([[10, 166], [190, 166]], { width: 3 });
    p.path('M34,28 A13,13 0 1 0 48,46 A10,10 0 1 1 34,28 Z', { fill: WHITE, width: 2.8, length: 70 });
    p.shape([[180, 54], [170, 60], [172, 46], [184, 40]], { width: 2.4 });
  },

  // Draw intro -------------------------------------------------------------------------------------
  '14a': (p) => {
    // A pencil with a face.
    pencil(p, { x: 74, y: 182, turn: -70, length: 158, half: 19, stripes: false });
    const [cx, cy] = place([[88, 0]], { x: 74, y: 182, turn: -70 })[0];
    p.dot(cx - 7, cy - 6, 3);
    p.dot(cx + 8, cy - 3, 3);
    p.line([[cx - 8, cy + 6], [cx, cy + 11], [cx + 8, cy + 8]], { width: 2.8 });
  },
  '14b': (p) => {
    // A paint splatter.
    const splat = Array.from({ length: 16 }, (_, i) => at(96, 100, (i % 2 ? 30 : 46) + p.jit(8), deg(i * 22.5)));
    p.shape(splat, { width: 3.6 });
    p.hatch(splat, { gap: 3.6 });
    for (const [x, y, r] of [[160, 60, 6], [168, 118, 4.5], [40, 150, 5], [32, 64, 3.5], [132, 164, 4], [70, 30, 3], [150, 150, 2.4]]) {
      p.circle(x, y, r, { width: 2.4, fill: INK });
    }
    p.line([[112, 138], [116, 156], [112, 168]], { width: 3.4 });
  },
  '14c': (p) => {
    // An arrow pointing right, at the button.
    p.line([[24, 58], [56, 38], [90, 52], [84, 84], [62, 80], [70, 58], [106, 62], [138, 92], [168, 118]], { width: 4.8 });
    p.line([[146, 116], [170, 120], [160, 98]], { width: 4.8, straight: true });
  },
  '14d': (p) => {
    // A crayon, with the line it just drew (drawn last, underneath the crayon).
    p.phase = 1.4;
    p.line([[88, 150], [66, 164], [46, 154], [26, 170]], { width: 6 });
    p.phase = 1;
    crayon(p, { x: 90, y: 150, turn: -38, length: 128, half: 15 });
  },
  '14e': (p) => {
    // Sparkles.
    p.shape(sparkle(92, 106, 50), { width: 4, shake: 0.6 });
    p.shape(sparkle(154, 46, 20), { width: 3.2, shake: 0.5 });
    p.shape(sparkle(44, 46, 12), { width: 2.8, shake: 0.4 });
    for (const [x, y] of [[160, 150], [30, 150], [130, 20]]) p.dot(x, y, 3);
    p.hatch([[92, 106], [142, 106], [103, 117], [92, 156]], { gap: 4.5 });
  },
  '14f': (p) => {
    // A hand, mid-sketch.
    pencil(p, { x: 60, y: 150, turn: -48, length: 124, half: 9 });
    p.shape([[98, 84], [118, 72], [140, 78], [150, 98], [140, 118], [116, 124], [98, 112]], { width: 4 });
    for (const y of [88, 100, 112]) p.line([[108, y], [124, y - 2]], { width: 2.4, shake: 0.4 });
    p.line([[100, 86], [90, 94], [94, 104]], { width: 3 });
    p.line([[146, 80], [174, 56]], { width: 4 });
    p.line([[152, 102], [184, 76]], { width: 4 });
    p.line([[60, 150], [44, 160], [30, 148], [44, 136], [54, 150], [40, 170], [22, 166]], { width: 3 });
  },
  '14g': (p) => {
    // A little creature peeking over the edge.
    p.shape([[54, 136], [56, 98], [74, 72], [100, 64], [126, 72], [144, 98], [146, 136]], { width: 4 });
    p.line([[76, 70], [70, 50], [80, 58]], { width: 3, straight: true });
    p.line([[124, 70], [130, 50], [120, 58]], { width: 3, straight: true });
    for (const x of [86, 116]) {
      p.circle(x, 98, 11, { width: 3, fill: WHITE });
      p.dot(x + 3, 100, 4.2);
    }
    p.line([[94, 118], [100, 122], [106, 118]], { width: 2.6 });
    p.line([[16, 136], [184, 136]], { width: 4 });
    for (const x of [66, 114]) p.shape([[x, 136], [x + 4, 126], [x + 12, 124], [x + 20, 128], [x + 22, 136]], { width: 3 });
    p.hatch(rect(16, 137, 184, 176), { gap: 6, width: 1.8 });
  },
  '14h': (p) => {
    // An eraser, and the smudges it left (underneath it).
    const smudge = [[26, 130], [60, 112], [98, 120], [104, 150], [70, 164], [34, 158]];
    p.hatch(smudge, { angle: 20, gap: 5, width: 1.6 });
    p.hatch(smudge, { angle: -30, gap: 9, width: 1.4 });
    eraser(p, { x: 128, y: 82, turn: 24, w: 98, h: 40 });
    crumbs(p, [[118, 146, 4.5], [134, 156, 3], [110, 164, 2.4], [150, 138, 2.2], [142, 170, 3.5]]);
  },

  // Thank you -----------------------------------------------------------------------------------------
  '15a': (p) => {
    // Someone celebrating, party hat and all.
    p.circle(100, 58, 16, { width: 3.8, fill: WHITE });
    p.dot(94, 55, 2.4);
    p.dot(106, 55, 2.4);
    p.line([[92, 62], [100, 68], [108, 62]], { width: 2.6 });
    const hat = [[88, 46], [100, 16], [112, 46]];
    p.shape(hat, { straight: true, width: 3.2 });
    p.circle(100, 14, 4, { width: 2.4, fill: WHITE });
    p.line([[100, 74], [100, 126]], { width: 4.2 });
    p.line([[100, 88], [70, 52]], { width: 4 });
    p.line([[100, 88], [130, 52]], { width: 4 });
    p.line([[100, 124], [80, 166]], { width: 4 });
    p.line([[100, 124], [122, 164]], { width: 4 });
    p.hatch(hat, { angle: -20, gap: 4.5, width: 1.8 });
    for (const [x, y, t] of [[30, 40, 20], [168, 34, -30], [24, 110, 60], [176, 96, 10], [150, 150, -50], [46, 160, 35], [140, 60, 70], [60, 70, -20]]) {
      p.shape(place([[-4, -2], [4, -2], [4, 2], [-4, 2]], { x, y, turn: t }), { straight: true, width: 2.2, fill: INK });
    }
    p.line([[40, 20], [50, 30], [40, 40], [50, 50]], { width: 2.4 });
    p.line([[162, 116], [172, 124], [162, 132], [172, 140]], { width: 2.4 });
  },
};

// ------------------------------------------------------------------------------------------------

// These folders only ever hold stand-ins made here; real doodles live in src/art/doodles.
if (process.argv.includes('--remove')) {
  rmSync(pngs, { recursive: true, force: true });
  rmSync(strokes, { recursive: true, force: true });
  console.log('Removed the stand-in doodles.');
  process.exit(0);
}

const PX = 3; // pixels per drawing unit in the PNG (600 x 600 for the 200 x 200 box)
const PAD = 14; // room left around the ink, in pixels

/**
 * Save the finished drawing as a PNG, trimmed to its ink, and the stroke-by-stroke version as an
 * SVG framed exactly the same way, so one can stand in for the other mid-animation.
 */
async function save(pen, tilt, id) {
  const png = await sharp(Buffer.from(pen.svg(tilt, { size: ' width="600" height="600"' }))).png().toBuffer();
  const { data, info } = await sharp(png).trim().toBuffer({ resolveWithObject: true });
  await sharp(data)
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(pngs, `${id}.png`));
  const left = -(info.trimOffsetLeft ?? 0) - PAD;
  const top = -(info.trimOffsetTop ?? 0) - PAD;
  const viewBox = [left / PX, top / PX, (info.width + 2 * PAD) / PX, (info.height + 2 * PAD) / PX].map(f).join(' ');
  writeFileSync(join(strokes, `${id}.svg`), pen.svg(tilt, { viewBox, timed: true }));
}

mkdirSync(pngs, { recursive: true });
mkdirSync(strokes, { recursive: true });
const coins = spotsFor('project:moola');
const missing = [];
let made = 0;
await Promise.all(
  DOODLE_SPOTS.map(async (spot) => {
    const pen = new Pen(spot.id);
    let tilt;
    if (spot.key === 'project:pokedream') {
      ball(spot.idea, pen);
      tilt = pen.jit(10);
    } else if (spot.key === 'project:moola') {
      const i = coins.indexOf(spot);
      coin(pen, CURRENCIES[i], i);
      tilt = pen.jit(8);
    } else if (DRAWINGS[spot.id]) {
      DRAWINGS[spot.id](pen);
      tilt = pen.jit(5);
    } else {
      missing.push(spot.id);
      return;
    }
    await save(pen, tilt, spot.id);
    made++;
  }),
);
console.log(`Drew ${made} stand-in doodles (src/art/doodles-mock, with their strokes in public/doodle-strokes).`);
if (missing.length) console.log(`No stand-in drawn yet for: ${missing.join(', ')}`);
