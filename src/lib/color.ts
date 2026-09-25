// Contrast math (WCAG) for checking that each season's accent color stays readable.

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const darken = (hex: string, amount: number) =>
  '#' +
  [16, 8, 0]
    .map((shift) => Math.round(((parseInt(hex.slice(1), 16) >> shift) & 255) * (1 - amount)).toString(16).padStart(2, '0'))
    .join('');

/** The accent darkened just enough to read as text or icons on white (4.5:1). */
export const inkFor = (accent: string) => {
  for (let amount = 0; amount <= 1; amount += 0.02) {
    const shade = darken(accent, amount);
    if (contrast(shade, '#ffffff') >= 4.5) return shade;
  }
  return '#111111';
};
