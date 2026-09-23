/**
 * Which head drawing shows in the top-left corner, by date (month, day), inclusive.
 * To change the rotation, edit this list. Dates not covered fall back to base.png.
 */
export const SEASONAL_SCHEDULE = [
  { from: [1, 1], to: [2, 29], icon: 'jojo.png' },
  { from: [3, 1], to: [3, 31], icon: 'base.png' },
  { from: [4, 1], to: [4, 30], icon: 'redbeanie.png' },
  { from: [5, 1], to: [6, 30], icon: 'mysteryofmew.png' },
  { from: [7, 1], to: [8, 15], icon: 'onepiece.png' },
  { from: [8, 16], to: [9, 30], icon: 'naruto.png' },
  { from: [10, 1], to: [10, 31], icon: 'halloween.png' },
  { from: [11, 1], to: [11, 30], icon: 'minishcap.png' },
  { from: [12, 1], to: [12, 31], icon: 'santa.png' },
] as const;

export const FALLBACK_ICON = 'base.png';

export function seasonalIcon(date: Date = new Date()): string {
  const key = (date.getMonth() + 1) * 100 + date.getDate();
  const match = SEASONAL_SCHEDULE.find(
    ({ from, to }) => key >= from[0] * 100 + from[1] && key <= to[0] * 100 + to[1]
  );
  return match ? match.icon : FALLBACK_ICON;
}
