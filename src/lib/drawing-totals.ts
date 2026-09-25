// Totals for the drawing site, from the drawing_stats database function (supabase/drawing-stats.sql).
// It returns counts only, never individual visits or drawings. Used at build time and in the browser.
export type DrawingTotals = { visitors: number; submitted: number; approved: number; rejected: number };

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

/** Approved out of everything I've reviewed; drawings still waiting don't count against it. */
export const approvalRate = (t: DrawingTotals) => {
  const reviewed = t.approved + t.rejected;
  return reviewed ? Math.round((t.approved / reviewed) * 100) : 0;
};

export const formatCount = (n: number) => n.toLocaleString('en-US');
