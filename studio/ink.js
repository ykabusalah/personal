// How a doodle is stored and drawn. The studio records with this, and the site can replay with it,
// so a doodle looks exactly the same in both places.
//
// A doodle:
//   { v: 1, size: 1000, crop: [x, y, w, h], strokes: [{ tool: 'pen' | 'eraser', w, pts }] }
// The board is size x size units. pts is flat: x, y, t, p for each point, where t is milliseconds
// since the doodle was started and p is pen pressure from 0 to 1 (0.5 for a mouse).
// crop is the box around the ink, saved with the doodle so its picture and its strokes line up.

export const BOARD = 1000;
export const INK = '#111111';

const count = (s) => s.pts.length / 4;
const x = (s, i) => s.pts[i * 4];
const y = (s, i) => s.pts[i * 4 + 1];
const pressure = (s, i) => s.pts[i * 4 + 3];

/** Line width at a point. Pressing harder draws thicker, like a brush pen. */
export const widthAt = (s, i) => (s.tool === 'eraser' ? s.w : s.w * (0.35 + 1.3 * pressure(s, i)));

/** Widest a stroke can get, for the round cursor and for cropping. */
export const maxWidth = (s) => (s.tool === 'eraser' ? s.w : s.w * 1.65);

function begin(ctx, s, width) {
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
}

const mid = (s, i) => [(x(s, i - 1) + x(s, i)) / 2, (y(s, i - 1) + y(s, i)) / 2];

/**
 * Draw the piece of a stroke that is settled once point k has arrived (k >= 1). Curves run between
 * the midpoints of neighboring points, so lines come out smooth instead of jagged.
 */
export function drawPiece(ctx, s, k) {
  if (k === 1) {
    const [mx, my] = mid(s, 1);
    begin(ctx, s, (widthAt(s, 0) + widthAt(s, 1)) / 2);
    ctx.moveTo(x(s, 0), y(s, 0));
    ctx.lineTo(mx, my);
  } else {
    const [ax, ay] = mid(s, k - 1);
    const [bx, by] = mid(s, k);
    begin(ctx, s, widthAt(s, k - 1));
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(x(s, k - 1), y(s, k - 1), bx, by);
  }
  ctx.stroke();
}

/** Finish a stroke: the last stretch to the final point, or a dot for a single tap. */
export function drawEnd(ctx, s) {
  const n = count(s);
  if (n === 0) return;
  if (n === 1) {
    begin(ctx, s, 0);
    ctx.arc(x(s, 0), y(s, 0), widthAt(s, 0) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const [mx, my] = mid(s, n - 1);
  begin(ctx, s, widthAt(s, n - 1));
  ctx.moveTo(mx, my);
  ctx.lineTo(x(s, n - 1), y(s, n - 1));
  ctx.stroke();
}

export function drawStroke(ctx, s) {
  for (let k = 1; k < count(s); k++) drawPiece(ctx, s, k);
  drawEnd(ctx, s);
}

/** Draw a whole doodle. The context's transform decides where and how big. */
export function drawAll(ctx, strokes) {
  for (const s of strokes) drawStroke(ctx, s);
  ctx.globalCompositeOperation = 'source-over';
}

/** The box around all the ink, with a little room, clamped to the board. Null when blank. */
export function inkBox(strokes, pad = 12) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    if (s.tool === 'eraser') continue;
    const r = maxWidth(s) / 2;
    for (let i = 0; i < count(s); i++) {
      x0 = Math.min(x0, x(s, i) - r); y0 = Math.min(y0, y(s, i) - r);
      x1 = Math.max(x1, x(s, i) + r); y1 = Math.max(y1, y(s, i) + r);
    }
  }
  if (x1 < x0) return null;
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
  x1 = Math.min(BOARD, Math.ceil(x1 + pad)); y1 = Math.min(BOARD, Math.ceil(y1 + pad));
  return [x0, y0, x1 - x0, y1 - y0];
}

/** A canvas of the doodle cropped to crop, scaled so its longer side is `long` pixels. */
export function picture(strokes, crop, long) {
  const [cx, cy, cw, ch] = crop;
  const scale = long / Math.max(cw, ch);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cw * scale));
  canvas.height = Math.max(1, Math.round(ch * scale));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, -cx * scale, -cy * scale);
  drawAll(ctx, strokes);
  return canvas;
}

/**
 * When each point gets drawn during a replay, in milliseconds from the start. Long pauses, like
 * stopping to think, are cut short, and the whole thing is sped up to fit in maxDuration.
 */
export function timeline(strokes, { maxPause = 250, maxDuration = Infinity } = {}) {
  const times = [];
  let clock = 0;
  let last = null;
  for (const s of strokes) {
    const t = new Float64Array(count(s));
    for (let i = 0; i < t.length; i++) {
      const raw = s.pts[i * 4 + 2];
      if (last !== null) clock += Math.min(Math.max(raw - last, 0), maxPause);
      last = raw;
      t[i] = clock;
    }
    times.push(t);
  }
  const speed = clock > maxDuration ? maxDuration / clock : 1;
  if (speed !== 1) for (const t of times) for (let i = 0; i < t.length; i++) t[i] *= speed;
  return { times, duration: clock * speed };
}

/**
 * Redraw the doodle stroke by stroke, the way it was drawn. The caller clears the canvas and sets
 * its transform first. Returns a promise for the end and a stop() to cut it short.
 */
export function replay(ctx, strokes, options) {
  const { times, duration } = timeline(strokes, options);
  let si = 0; // stroke being drawn
  let pi = 0; // points of it drawn so far
  let stopped = false;
  let frame = 0;
  let start = 0;

  const advance = (now) => {
    while (si < strokes.length) {
      const s = strokes[si];
      const t = times[si];
      while (pi < t.length && t[pi] <= now) {
        if (pi >= 1) drawPiece(ctx, s, pi);
        pi++;
      }
      if (pi < t.length) break;
      drawEnd(ctx, s);
      si++;
      pi = 0;
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  let resolve;
  const done = new Promise((r) => (resolve = r));
  const step = (now) => {
    if (stopped) return;
    if (!start) start = now;
    advance(now - start);
    if (si < strokes.length) frame = requestAnimationFrame(step);
    else resolve();
  };
  frame = requestAnimationFrame(step);

  const halt = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    resolve();
  };
  return {
    done,
    duration,
    stop: halt,
    /** Jump to the end right away. */
    finish() {
      advance(Infinity);
      halt();
    },
  };
}
