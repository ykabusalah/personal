// Live numbers that update like a train station board, redone in paper and pen to match the site.
// Three styles to compare while developing, picked with ?ticker=flap|roll|scribble:
//   flap      each character is a paper card that flips over, stepping through the digits between
//   roll      the digits that changed roll up and out, like an odometer
//   scribble  the old number is crossed out with a pen stroke and the new one written in
// Styles are in global.css under "Live numbers".
export type TickerStyle = 'flap' | 'roll' | 'scribble';
const STYLES: TickerStyle[] = ['flap', 'roll', 'scribble'];
const DEFAULT_STYLE: TickerStyle = 'flap';

export function tickerStyle(): TickerStyle {
  if (import.meta.env.DEV) {
    const asked = new URLSearchParams(location.search).get('ticker') as TickerStyle | null;
    if (asked && STYLES.includes(asked)) return asked;
  }
  return DEFAULT_STYLE;
}

// Each card sits at its own slight angle, like it was cut and stuck on by hand.
const TILTS = [-1.6, 1.1, -0.6, 1.8, -1.2, 0.7, -0.9];

const el = (tag: string, className: string, text = '') => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

const wait = (animation: Animation) => animation.finished.catch(() => {});

/** Line up two numbers from the right, so the ones place stays the ones place. */
function align(from: string, to: string) {
  const length = Math.max(from.length, to.length);
  return [from.padStart(length, ' '), to.padStart(length, ' ')] as const;
}

/** Screen readers get the plain number; the moving pieces are hidden from them. */
function frame(target: HTMLElement, value: string, visual: HTMLElement) {
  visual.setAttribute('aria-hidden', 'true');
  target.replaceChildren(el('span', 'tk-sr', value), visual);
}

function card(ch: string, i: number) {
  const c = el('span', 'tk-card');
  c.style.setProperty('--r', `${TILTS[i % TILTS.length]}deg`);
  c.append(el('span', 'tk-face', ch.trim()));
  return c;
}

/** The number at rest: paper cards for flap, plain text for the others. */
function settle(target: HTMLElement, value: string, style: TickerStyle) {
  if (style !== 'flap') {
    target.textContent = value;
    return;
  }
  const visual = el('span', 'tk-visual tk-cards');
  [...value].forEach((ch, i) => visual.append(card(ch, i)));
  frame(target, value, visual);
}

/** The digits a flap card shows on its way from one to the other, like a real board. */
function steps(from: string, to: string) {
  const a = Number(from);
  const b = Number(to);
  if (from.trim() === '' || to.trim() === '' || Number.isNaN(a) || Number.isNaN(b)) return [to];
  const out = [];
  for (let d = (a + 1) % 10; ; d = (d + 1) % 10) {
    out.push(String(d));
    if (d === b) return out;
  }
}

async function flipCard(c: HTMLElement, from: string, to: string, alive: () => boolean) {
  const sequence = steps(from, to);
  const perFlip = sequence.length > 4 ? 90 : 150;
  let shown = from;
  for (const next of sequence) {
    if (!alive()) return;
    const top = el('span', 'tk-half tk-top', next.trim());
    const bottom = el('span', 'tk-half tk-bottom', shown.trim());
    const fold = el('span', 'tk-half tk-top tk-flap', shown.trim());
    const unfold = el('span', 'tk-half tk-bottom tk-flap', next.trim());
    unfold.style.transform = 'rotateX(90deg)';
    c.replaceChildren(el('span', 'tk-face tk-sizer', '0'), top, bottom, fold, unfold);
    await wait(fold.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)', filter: 'brightness(0.85)' }], { duration: perFlip, easing: 'ease-in', fill: 'forwards' }));
    await wait(unfold.animate([{ transform: 'rotateX(90deg)', filter: 'brightness(0.9)' }, { transform: 'rotateX(0deg)' }], { duration: perFlip, easing: 'cubic-bezier(0.3, 1.5, 0.6, 1)', fill: 'forwards' }));
    shown = next;
  }
}

async function flap(target: HTMLElement, from: string, to: string, alive: () => boolean) {
  const [a, b] = align(from, to);
  const visual = el('span', 'tk-visual tk-cards');
  const cards = [...b].map((_, i) => card(a[i], i));
  visual.append(...cards);
  frame(target, to, visual);
  await Promise.all(
    cards.map(async (c, i) => {
      if (a[i] === b[i]) return;
      await new Promise((resolve) => setTimeout(resolve, i * 70));
      await flipCard(c, a[i], b[i], alive);
    }),
  );
}

async function roll(target: HTMLElement, from: string, to: string) {
  const [a, b] = align(from, to);
  const visual = el('span', 'tk-visual');
  const moves: Promise<void>[] = [];
  [...b].forEach((ch, i) => {
    if (a[i] === ch) {
      visual.append(el('span', '', ch));
      return;
    }
    const cell = el('span', 'tk-cell');
    const out = el('span', 'tk-out', a[i].trim());
    const inn = el('span', 'tk-in', ch.trim());
    cell.append(inn, out);
    visual.append(cell);
    const timing = { duration: 520, delay: i * 70, easing: 'cubic-bezier(0.3, 1.4, 0.6, 1)', fill: 'both' as const };
    moves.push(wait(out.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-105%)', opacity: 0 }], timing)));
    moves.push(wait(inn.animate([{ transform: 'translateY(105%) rotate(6deg)' }, { transform: 'translateY(0) rotate(0deg)' }], timing)));
  });
  frame(target, to, visual);
  await Promise.all(moves);
}

async function scribble(target: HTMLElement, from: string, to: string, alive: () => boolean) {
  const visual = el('span', 'tk-visual tk-scribble');
  const old = el('span', 'tk-old', from);
  const strike = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  strike.setAttribute('class', 'tk-strike');
  strike.setAttribute('viewBox', '0 0 100 20');
  strike.setAttribute('preserveAspectRatio', 'none');
  strike.innerHTML = '<path pathLength="1" d="M3 13 C 20 6, 38 15, 55 9 S 85 12, 97 6" />';
  const next = el('span', 'tk-new', to);
  next.style.opacity = '0';
  visual.append(old, strike, next);
  frame(target, to, visual);

  await wait(strike.querySelector('path')!.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' }));
  if (!alive()) return;
  await wait(visual.animate([{}, {}], { duration: 150 })); // a beat, like lifting the pen
  const fade = { duration: 220, easing: 'ease-in', fill: 'forwards' as const };
  old.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-0.15em)' }], fade);
  await wait(strike.animate(
    [{ opacity: 1, transform: 'translateY(-40%)' }, { opacity: 0, transform: 'translateY(calc(-40% - 0.15em))' }],
    fade,
  ));
  if (!alive()) return;
  next.style.opacity = '';
  await wait(next.animate(
    [{ clipPath: 'inset(0 100% 0 0)', transform: 'rotate(-4deg)' }, { clipPath: 'inset(0 0 0 0)', transform: 'rotate(0deg)' }],
    { duration: 520, easing: 'ease-out' },
  ));
}

/**
 * Show a number, animating the change when asked. Changes that land mid-animation start over from
 * the last number, so it never gets stuck on a stale value.
 */
export function showNumber(target: HTMLElement | null, value: string, animate: boolean) {
  if (!target) return;
  const style = tickerStyle();
  const current = target.dataset.value ?? target.textContent?.trim() ?? '';
  const ready = style !== 'flap' || target.querySelector('.tk-card');
  if (current === value && ready) return;

  target.dataset.value = value;
  const run = String(Number(target.dataset.run || 0) + 1);
  target.dataset.run = run;
  const alive = () => target.dataset.run === run;

  if (!animate || current === value || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settle(target, value, style);
    return;
  }
  const play = style === 'flap' ? flap(target, current, value, alive)
    : style === 'roll' ? roll(target, current, value)
    : scribble(target, current, value, alive);
  play.then(() => alive() && settle(target, value, style));
}
