// Makes a finished drawing look like it's being drawn: the ink appears along each connected stroke,
// outward from where it starts, one shape after another. Used for visitor drawings and doodles.

const INK = 24; // alpha above this counts as ink

/** A copy scaled down to at most maxPixels, so animation frames stay cheap. */
function downscale(src: HTMLCanvasElement, maxPixels: number) {
  if (src.width * src.height <= maxPixels) return src;
  const s = Math.sqrt(maxPixels / (src.width * src.height));
  const out = document.createElement('canvas');
  out.width = Math.round(src.width * s);
  out.height = Math.round(src.height * s);
  out.getContext('2d')!.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Ink pixels in drawing order: each connected shape is flooded outward from its first pixel. */
function strokeOrder(src: Uint8ClampedArray, w: number, h: number) {
  const seen = new Uint8Array(w * h);
  let inkCount = 0;
  for (let i = 0; i < w * h; i++) if (src[i * 4 + 3] > INK) inkCount++;
  const order = new Int32Array(inkCount);
  let n = 0;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const s = y * w + x;
      if (seen[s] || src[s * 4 + 3] <= INK) continue;
      seen[s] = 1;
      let head = n;
      order[n++] = s;
      while (head < n) {
        const i = order[head++];
        const ix = i % w, iy = (i - ix) / w;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = ix + dx, ny = iy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (!seen[j] && src[j * 4 + 3] > INK) {
              seen[j] = 1;
              order[n++] = j;
            }
          }
        }
      }
    }
  }
  return { order, count: n };
}

/**
 * Animate `full` onto `target` over `duration` ms, then leave the full-resolution image there.
 * Frames are drawn from a copy of at most `maxPixels` so large drawings stay smooth.
 */
export function drawIn(
  target: HTMLCanvasElement,
  full: HTMLCanvasElement,
  { duration, maxPixels }: { duration: number; maxPixels: number },
): Promise<void> {
  const anim = downscale(full, maxPixels);
  const { width: w, height: h } = anim;
  target.width = w;
  target.height = h;
  const ctx = target.getContext('2d')!;
  const src = anim.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const { order, count } = strokeOrder(src, w, h);

  const frame = ctx.createImageData(w, h);
  const px = frame.data;
  let shown = 0;
  const start = performance.now();
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

  return new Promise((resolve) => {
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const upTo = Math.floor(count * ease(t));
      for (let k = shown; k < upTo; k++) {
        const p = order[k] * 4;
        px[p] = src[p]; px[p + 1] = src[p + 1]; px[p + 2] = src[p + 2]; px[p + 3] = src[p + 3];
      }
      shown = upTo;
      ctx.putImageData(frame, 0, 0);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        target.width = full.width;
        target.height = full.height;
        ctx.drawImage(full, 0, 0);
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}
