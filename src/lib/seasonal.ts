/**
 * Which head drawing shows in the top-left corner, by date (month, day), inclusive, and the accent
 * color the whole site takes on while it's up. To change the rotation or a color, edit this list.
 * Dates not covered fall back to base.png and the fallback accent.
 *
 * Accents sit behind dark text (buttons, the Home sticker, title highlights), so each needs at least
 * 4.5:1 contrast with #111. The build warns if one doesn't. The darker shade used for accent-colored
 * text on white is worked out automatically.
 */
export const SEASONAL_SCHEDULE = [
  { from: [1, 1], to: [2, 29], icon: 'jojo.png', accent: '#c9a227' }, // gold, from the cap's emblems
  { from: [3, 1], to: [3, 31], icon: 'base.png', accent: '#ff5533' }, // tomato, the site's default
  { from: [4, 1], to: [4, 30], icon: 'redbeanie.png', accent: '#e64a79' }, // raspberry, from the beanie
  { from: [5, 1], to: [6, 30], icon: 'mysteryofmew.png', accent: '#19a7a2' }, // teal, from the hat band
  { from: [7, 1], to: [8, 15], icon: 'onepiece.png', accent: '#f2c14e' }, // straw, from the straw hat
  { from: [8, 16], to: [9, 30], icon: 'naruto.png', accent: '#ff8c1a' }, // Naruto orange
  { from: [10, 1], to: [10, 31], icon: 'halloween.png', accent: '#9775fa' }, // spooky purple
  { from: [11, 1], to: [11, 30], icon: 'minishcap.png', accent: '#52b83a' }, // Ezlo green
  { from: [12, 1], to: [12, 31], icon: 'santa.png', accent: '#f03e3e' }, // Santa red
] as const;

export const FALLBACK_ICON = 'base.png';
export const FALLBACK_ACCENT = '#ff5533';

/**
 * Heads whose hats would run off the edge of the screen get moved, and if needed shrunk, so the
 * whole drawing shows. x and y move it right and down, as a share of the corner box's width and
 * height; size scales it (1 is the usual size). Heads not listed stay where they are.
 */
const HEAD_FIT: Record<string, { x?: number; y?: number; size?: number }> = {
  'minishcap.png': { y: 0.2, size: 0.78 }, // Ezlo's tall cap and beak, cut off at the top
  'mysteryofmew.png': { x: 0.2, size: 0.8 }, // the wide brim, cut off on the left (smaller so it clears the menu)
  'onepiece.png': { x: 0.16, y: 0.06 }, // brim at the left edge and top on phones
  'jojo.png': { y: 0.06 }, // cap touching the top on phones
  'santa.png': { y: 0.06 }, // hat touching the top on phones
};

/** CSS variables that place a head in the corner (see SeasonalLogo.astro). */
export function headFit(icon: string): string {
  const { x = 0, y = 0, size = 1 } = HEAD_FIT[icon] ?? {};
  return `--head-x:${x * 100}%;--head-y:${y * 100}%;--head-size:${size}`;
}

const dayKey = (date: Date) => (date.getMonth() + 1) * 100 + date.getDate();

function current(date: Date) {
  const key = dayKey(date);
  return SEASONAL_SCHEDULE.find(({ from, to }) => key >= from[0] * 100 + from[1] && key <= to[0] * 100 + to[1]);
}

export function seasonalIcon(date: Date = new Date()): string {
  return current(date)?.icon ?? FALLBACK_ICON;
}

export function seasonalAccent(date: Date = new Date()): string {
  return current(date)?.accent ?? FALLBACK_ACCENT;
}
