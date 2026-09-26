# Roadmap

What's planned after the first version of the site. Launch steps are at the bottom.

## Next: dark mode

Built and tried in September 2026, then taken out so the first version can launch without it. The working version is saved in git, so it doesn't have to be rebuilt from scratch:

- `c6fcad7c` adds the dark colors and the chalkboard drawings
- `7f335309` makes light the default and adds a switch to the menu

Start from those with `git show c6fcad7c` and `git show 7f335309`.

### What stays the same

- Light is the default for everyone. Dark is opt-in, and each visitor's choice is remembered on their device.
- Visitor drawings on Home, and my doodles, flip to white lines, like chalk on a chalkboard.
- Art prints and comic pages stay on white paper. The pen strokes on my About portrait stay black.
- The drawing canvas, moderation, and stats pages always stay light, so drawings are still made black on white.
- Each season's accent color works on the dark background as-is, and doubles as the text color there.

### What needs work before it comes back

- **The switch.** A plain moon and sun icon in the menu didn't match the rest of the site. It should feel hand-made, like everything else here: drawn in my own style, or a small doodle.
- **The animation.** Switching shouldn't be an instant flip. Ideas: the page wiped like a chalkboard eraser, or the Home drawing redrawing itself in chalk.

### How it worked

- Dark colors are a second set of the shared color settings in `src/styles/tokens.css`, turned on by `data-theme="dark"` on the page.
- A small script in `src/components/Head.astro` restores a saved choice before the page draws, so there's no white flash between pages.
- The chalk look is `filter: invert(1)` on the drawing canvas and on doodles, with `hue-rotate(180deg)` added for doodles so any colors stay roughly the same.
- Hard-coded colors (chip, badge, and code backgrounds, and the Home sticker's tab) moved onto the shared settings so they could follow the mode.

## Later

From the drawing site's own roadmap:

- Drawing on phones, with a touch-friendly canvas
- A color picker and more brush types
- A public gallery of every approved drawing
- Sharing a submitted drawing
- A sharper canvas on high-resolution screens

The rest of the site:

- Swap the stand-in handwriting font (Nanum Pen Script) for my own handwriting

## Launch checklist

- [ ] Add my drawings for the doodle spots in `src/art/doodles/`
- [ ] Turn off the doodle1 test fill (`TEST_DOODLE` in `src/components/Doodle.astro`), unless I want doodle1 in the spots that are still empty
- [ ] Run `npx vercel login`, then `npx vercel link`: create a new project, and don't connect the GitHub repo
- [ ] Run `npm run deploy` and look over the `vercel.app` preview
- [ ] Point ykabusalah.me at the new Vercel project
- [ ] Send draw.ykabusalah.me to ykabusalah.me/info so old links keep working
- [ ] Cancel Super.so
- [ ] Remove my head drawings from GitHub: the `icons` folder on `main`, and their copies in older commits
