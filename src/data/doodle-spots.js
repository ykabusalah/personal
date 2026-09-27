// Every doodle spot on the site, in one place. Spots are numbered by page and lettered in order
// on that page: 1a, 1b, and so on (after z comes aa, ab). A spot's id is also its drawing's file
// name in src/art/doodles, so 5c.png fills spot 5c. The idea is what it's meant to show.
//
// Page numbers are fixed below so adding a page never renumbers the others. To add a spot to a
// page, add it to the end of that page's list so the letters before it stay the same.
// Pages place their spots by id (<Doodle spot="1a" ... />), and the Doodle Studio lists them from here.

const MOOLA_CURRENCIES = [
  'US Dollar ($)', 'Euro (€)', 'British Pound (£)', 'Japanese Yen (¥)', 'Canadian Dollar (C$)',
  'Australian Dollar (A$)', 'Swiss Franc (Fr)', 'Chinese Yuan (¥)', 'Indian Rupee (₹)', 'Mexican Peso ($)',
  'Brazilian Real (R$)', 'South Korean Won (₩)', 'Singapore Dollar (S$)', 'Hong Kong Dollar (HK$)',
  'Swedish Krona (kr)', 'Norwegian Krone (kr)', 'New Zealand Dollar (NZ$)', 'South African Rand (R)',
  'Russian Ruble (₽)', 'Turkish Lira (₺)', 'UAE Dirham (د.إ)', 'Philippine Peso (₱)', 'Thai Baht (฿)',
  'Polish Zloty (zł)',
];

// Every Poké Ball from the main games, in the order they first appeared.
const POKE_BALLS = [
  'Poké Ball', 'Great Ball', 'Ultra Ball', 'Master Ball', 'Safari Ball',
  'Fast Ball', 'Level Ball', 'Lure Ball', 'Heavy Ball', 'Love Ball', 'Friend Ball', 'Moon Ball', 'Sport Ball',
  'Premier Ball', 'Repeat Ball', 'Timer Ball', 'Nest Ball', 'Net Ball', 'Dive Ball', 'Luxury Ball',
  'Dusk Ball', 'Heal Ball', 'Quick Ball', 'Cherish Ball', 'Park Ball',
  'Dream Ball', 'Beast Ball', 'Strange Ball',
];

const SKETCH = { idea: 'a sketch of how it works' };
const FROM_THE_PIECE = { idea: 'a sketch from this piece', width: 104 };

export const DOODLE_PAGES = [
  { number: 1, key: 'about', label: 'About', spots: [
    { idea: 'a globe, plane, or map pin for the 30+ countries', width: 104 },
    { idea: 'a laptop or a tiny compliance robot', width: 88 },
    { idea: 'a small arrow or pointing hand', width: 80 },
    { idea: 'a sign-off, like you waving', width: 104 },
  ] },
  { number: 2, key: 'projects', label: 'Projects', spots: [
    { idea: 'a laptop, gear, or blueprint' },
    { idea: 'a little robot or wrench' },
    { idea: 'a coffee cup, sticky note, or rubber duck' },
  ] },
  { number: 3, key: 'project:drawing-canvas', label: 'Portfolio Drawing Canvas', spots: [SKETCH] },
  { number: 4, key: 'project:echoes', label: 'echoes', spots: [SKETCH] },
  { number: 5, key: 'project:pokedream', label: 'pokédream', spots: POKE_BALLS.map((idea) => ({ idea, width: 72 })) },
  { number: 6, key: 'project:moola', label: 'moola', spots: MOOLA_CURRENCIES.map((idea) => ({ idea, width: 72 })) },
  { number: 7, key: 'art', label: 'Art', spots: [
    { idea: 'a paintbrush, sketchbook, or ink pot', width: 104 },
    { idea: 'a character from one of the comics', width: 104 },
    { idea: 'a crumpled page, tape roll, or eraser', width: 104 },
  ] },
  { number: 8, key: 'art:migrants', label: 'Migrants', spots: [FROM_THE_PIECE] },
  { number: 9, key: 'art:warda', label: 'Warda', spots: [FROM_THE_PIECE] },
  { number: 10, key: 'art:the-stars', label: 'The Stars', spots: [FROM_THE_PIECE] },
  { number: 11, key: 'art:fluttering-in-patong', label: 'Fluttering in Patong', spots: [FROM_THE_PIECE] },
  { number: 12, key: 'art:building-a-home-together', label: 'Building a Home Together', spots: [FROM_THE_PIECE] },
  { number: 13, key: 'art:adara', label: 'Adara', spots: [FROM_THE_PIECE] },
  { number: 14, key: 'info', label: 'Draw intro', spots: [
    { idea: 'a pencil with a face' },
    { idea: 'a paint splatter or scribble' },
    { idea: "an arrow pointing at Let's Draw!" },
    { idea: 'a crayon or marker' },
    { idea: 'stars or sparkles' },
    { idea: 'you, mid-sketch' },
    { idea: 'a little creature peeking in' },
    { idea: 'an eraser and some smudges' },
  ] },
  { number: 15, key: 'thank-you', label: 'Thank you', spots: [{ idea: 'a celebrating character', width: 120 }] },
];

/** a, b, ... z, then aa, ab, ... */
const letter = (i) => (i < 26 ? '' : letter(Math.floor(i / 26) - 1)) + String.fromCharCode(97 + (i % 26));

export const DOODLE_SPOTS = DOODLE_PAGES.flatMap(({ number, key, label, spots }) =>
  spots.map((spot, i) => ({ id: `${number}${letter(i)}`, page: label, key, width: 96, ...spot })),
);

export const spotById = (id) => DOODLE_SPOTS.find((spot) => spot.id === id);
export const spotsFor = (key) => DOODLE_SPOTS.filter((spot) => spot.key === key);

/**
 * Random numbers from 0 to 1 that come out the same every time for the same seed, so a page's
 * doodles look hand-placed but don't jump around between builds.
 */
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

/**
 * Spread a page's spots down both margins, for pages whose doodles aren't placed one by one
 * (project and art pages). Loosely, like they were dropped there by hand: sides mostly take turns
 * but not always, the gaps between them are uneven, no two sit exactly across from each other,
 * and each sits a slightly different distance from the text, a little bigger or smaller, at its
 * own tilt. A single spot sits near the top on firstSide.
 */
export function scatter(spots, firstSide = 'left') {
  const other = firstSide === 'left' ? 'right' : 'left';
  const random = randomFrom(spots.map((spot) => spot.id).join());
  const tilt = () => Math.round(-9 + 18 * random());

  if (spots.length === 1) return [{ ...spots[0], side: firstSide, top: '40px', tilt: tilt(), lane: Number((0.25 * random()).toFixed(2)) }];

  // Take turns, but now and then let two in a row land on the same side.
  const sides = spots.map((_, i) => (i % 2 ? other : firstSide));
  for (let i = 1; i < sides.length; i++) {
    if (random() < 0.3) [sides[i - 1], sides[i]] = [sides[i], sides[i - 1]];
  }

  // One after another down the page: each spot gets its own stretch of the height and is nudged
  // somewhere inside it. Neighbors are usually on opposite sides, so no two sit exactly across
  // from each other, and the gaps come out uneven. Each stays fairly close to the text.
  return spots.map((spot, i) => ({
    ...spot,
    side: sides[i],
    top: `${(((i + 0.25 + 0.5 * random()) / spots.length) * 100).toFixed(2)}%`,
    tilt: tilt(),
    lane: Number((0.4 * random()).toFixed(2)),
    width: Math.round(spot.width * (0.85 + 0.3 * random())),
  }));
}
