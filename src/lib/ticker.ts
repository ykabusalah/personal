// Live numbers that update by hand: when a number changes, the old one gets crossed out with a pen
// stroke and the new one is written in its place. Styles are in global.css under "Live numbers".
// To watch it while developing, open a page with the drawing totals and add ?ticker-demo.

const el = (tag: string, className: string, text = '') => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

const wait = (animation: Animation) => animation.finished.catch(() => {});

/** Cross out the old number, lift the pen for a beat, then write in the new one. */
async function scribble(target: HTMLElement, from: string, to: string, alive: () => boolean) {
  const visual = el('span', 'tk-scribble');
  visual.setAttribute('aria-hidden', 'true');
  const old = el('span', 'tk-old', from);
  const strike = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  strike.setAttribute('class', 'tk-strike');
  strike.setAttribute('viewBox', '0 0 100 20');
  strike.setAttribute('preserveAspectRatio', 'none');
  strike.innerHTML = '<path pathLength="1" d="M3 13 C 20 6, 38 15, 55 9 S 85 12, 97 6" />';
  const next = el('span', 'tk-new', to);
  next.style.opacity = '0';
  visual.append(old, strike, next);
  // Screen readers get the new number right away; the moving pieces are hidden from them.
  target.replaceChildren(el('span', 'tk-sr', to), visual);

  await wait(strike.querySelector('path')!.animate(
    [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: 380, easing: 'ease-out', fill: 'forwards' },
  ));
  if (!alive()) return;
  await wait(visual.animate([{}, {}], { duration: 150 }));
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
 * Show a number, writing it in by hand when animate is on and it actually changed. A change that
 * lands mid-animation starts over from the latest number, so it never gets stuck on an old one.
 */
export function showNumber(target: HTMLElement | null, value: string, animate: boolean) {
  if (!target) return;
  const current = target.dataset.value ?? target.textContent?.trim() ?? '';
  if (current === value) return;

  target.dataset.value = value;
  const run = String(Number(target.dataset.run || 0) + 1);
  target.dataset.run = run;
  const alive = () => target.dataset.run === run;

  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    target.textContent = value;
    return;
  }
  scribble(target, current, value, alive).then(() => {
    if (alive()) target.textContent = value;
  });
}
