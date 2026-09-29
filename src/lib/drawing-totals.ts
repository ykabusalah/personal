// Totals for the drawing site, from the drawing_stats database function (supabase/drawing-stats.sql).
// It returns counts only, never individual visits or drawings. Used at build time and in the browser.
export type DrawingTotals = {
  visitors: number;
  submitted: number;
  approved: number;
  rejected: number;
  /** Visits that started a drawing, and how many of those submitted it. Missing until the updated function is in. */
  started?: number;
  finished?: number;
  /** The typical time from first stroke to submitting, in seconds; null before anyone has. */
  draw_seconds?: number | null;
};

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/** null when the function isn't reachable, so pages can skip the numbers rather than show wrong ones. */
export async function fetchDrawingTotals(): Promise<DrawingTotals | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/drawing_stats`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Keep numbers on the page current: fetch now, then every 30 seconds while the tab is open and in
 * view, and right away when someone comes back to it. Skips the checks while the tab is hidden.
 */
export function watchDrawingTotals(onTotals: (totals: DrawingTotals, first: boolean) => void, everyMs = 30_000) {
  // While developing, ?ticker-demo pretends visits and drawings keep coming in every few seconds,
  // so the number animations (lib/ticker.ts) can be watched without waiting on real ones.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('ticker-demo')) {
    fetchDrawingTotals().then((start) => {
      if (!start) return;
      let t = start;
      onTotals(t, true);
      let round = 0;
      setInterval(() => {
        const some = (max: number) => Math.floor(Math.random() * (max + 1));
        const big = ++round % 3 === 0; // now and then a bigger jump, to flip through more digits
        const submitted = big ? 6 + some(8) : some(2);
        const approved = Math.min(submitted, big ? 2 + some(3) : some(1));
        t = {
          visitors: t.visitors + 1 + some(big ? 25 : 3),
          submitted: t.submitted + submitted,
          approved: t.approved + approved,
          rejected: t.rejected + submitted - approved,
          started: (t.started ?? 0) + submitted + some(big ? 6 : 2),
          finished: (t.finished ?? 0) + submitted,
          draw_seconds: Math.max(20, (t.draw_seconds ?? 180) + some(40) - 20),
        };
        onTotals(t, false);
      }, 3500);
    });
    return;
  }

  let first = true;
  const check = () =>
    fetchDrawingTotals().then((t) => {
      if (!t) return;
      onTotals(t, first);
      first = false;
    });
  check();
  setInterval(() => document.visibilityState === 'visible' && check(), everyMs);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
}

/** Approved out of everything I've reviewed; drawings still waiting don't count against it. */
export const approvalRate = (t: DrawingTotals) => {
  const reviewed = t.approved + t.rejected;
  return reviewed ? Math.round((t.approved / reviewed) * 100) : 0;
};

export const formatCount = (n: number) => n.toLocaleString('en-US');

/** Of the visits that started a drawing, the share that submitted it. null until there's data. */
export const finishRate = (t: DrawingTotals) => (t.started ? Math.round(((t.finished ?? 0) / t.started) * 100) : null);

/** Seconds as a short time, like "45s", "4m 12s", or "1h 5m". */
export const formatDuration = (seconds: number) => {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
