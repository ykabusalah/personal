# Roadmap

What's planned after the first version of the site. Launch steps are at the bottom.

## The real doodles

Version 1 ships with stand-in doodles in every spot (made by `npm run doodles:mock`, kept in `src/art/doodles-mock/`). While they're up, the site doesn't say every drawing is made by hand: commit `1777817b` took that line out of the footer and reworded the ykabusalah.me write-up.

- [ ] Get each spot's real doodle: place it from the Doodle Studio and run `npm run doodles:pull`, or save it as `src/art/doodles/<spot>.png` (spots are listed in `src/data/doodle-spots.js`). A real doodle replaces its stand-in right away.
- [ ] Once every spot has its real doodle, run `npm run doodles:unmock` to delete the stand-ins.
- [ ] Then run `git revert 1777817b` to bring back the footer line and the write-up's original wording, and deploy.

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

- [x] Fill every doodle spot for version 1 with a stand-in (`npm run doodles:mock`; see "The real doodles" above)
In this order:

The new site goes on the existing `personal` Vercel project, the one the old drawing app is on, so `draw.ykabusalah.me` is already attached.

- [ ] In the `personal` project on Vercel, go to Settings, then Git, and disconnect the GitHub repo, so pushes never build the site without my art
- [ ] Run `npx vercel link` and link to the existing `personal` project
- [ ] Run `npm run deploy:preview` and look over the preview address it prints (the live sites don't change yet)
- [ ] In the project, go to Settings, then Domains, and add `ykabusalah.me` and `www.ykabusalah.me`
- [ ] At the domain registrar, replace Super.so's DNS records with the ones Vercel shows (usually an `A` record for `@` to `76.76.21.21`, and a `CNAME` for `www` to `cname.vercel-dns.com`)
- [ ] As soon as Vercel shows the domain as valid, run `npm run deploy`. The new site goes live, and `draw.ykabusalah.me` starts forwarding to it (the rules are in `scripts/vercel-output.mjs`).
- [ ] Push to GitHub: `git push origin main`
- [ ] On GitHub, update the repo's About: description, website (`https://ykabusalah.me`), and topics
- [ ] Once ykabusalah.me shows the new site, cancel Super.so
- [ ] Remove my head drawings from GitHub: the `icons` folder in older commits
