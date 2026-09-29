# Roadmap

What's planned after the first version of the site. Launch steps are at the bottom.

## The real doodles

Version 1 ships with stand-in doodles in every spot (made by `npm run doodles:mock`, kept in `src/art/doodles-mock/`). While they're up, the site doesn't say every drawing is made by hand: commit `006591ca` took that line out of the footer and reworded the ykabusalah.me write-up, and `712c2ffc` took it out of `robots.txt`.

- [ ] Get each spot's real doodle: place it from the Doodle Studio and run `npm run doodles:pull`, or save it as `src/art/doodles/<spot>.png` (spots are listed in `src/data/doodle-spots.js`). A real doodle replaces its stand-in right away.
- [ ] Once every spot has its real doodle, run `npm run doodles:unmock` to delete the stand-ins.
- [ ] Then run `git revert 006591ca 712c2ffc` to bring back the footer line, the write-up's original wording, and the `robots.txt` line, and deploy.

## Next: dark mode

Built and tried in September 2026, then taken out so the first version can launch without it. The working version is saved in git, so it doesn't have to be rebuilt from scratch:

- `a26e37ed` adds the dark colors and the chalkboard drawings
- `1f93cb7e` makes light the default and adds a switch to the menu

Start from those with `git show a26e37ed` and `git show 1f93cb7e`.

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

In this order. The new site goes on the existing `personal` Vercel project, where `draw.ykabusalah.me` already lives. The domain is at Porkbun, which also runs its DNS and my email forwarding.

- [x] Fill every doodle spot for version 1 with a stand-in (`npm run doodles:mock`; see "The real doodles" above)
- [ ] In the `personal` project on Vercel, go to Settings, then Git, and disconnect the GitHub repo, so pushes never build the site without my art
- [ ] Run `npx vercel link` and link to the existing `personal` project
- [ ] Run `npm run deploy:preview` and look over the preview address it prints (the live sites don't change yet)
- [x] In the project, go to Settings, then Domains, and add `ykabusalah.me` (Production) and `www.ykabusalah.me` (a 301 redirect to `ykabusalah.me`, with "Include apex and www variants" unchecked). The site itself doesn't redirect www, so the two can't loop.
- [x] At Porkbun, change only the records Vercel asks for. Leave the `MX` records and the `TXT` record starting with `v=spf1` alone: they're my email forwarding for hello@ykabusalah.me.
- [x] Run `npm run deploy`. Old Super.so addresses forward to their closest pages (the rules are in `scripts/vercel-output.mjs`).
- [ ] `draw.ykabusalah.me` has no DNS record right now, so old draw links go nowhere. Add it in the project's Domains, then add the `CNAME` named `draw` that Vercel shows at Porkbun. Once it resolves, it forwards to the new site.
- [ ] In Supabase, go to the SQL editor and run `supabase/drawing-stats.sql` again, so By the numbers can show the finish rate and drawing time
- [ ] In Supabase, go to Authentication, then URL Configuration: set the Site URL to `https://ykabusalah.me` and add `https://ykabusalah.me/**` to the redirect URLs, so account emails (like a password reset) link to the new site
- [ ] Sign in at `ykabusalah.me/moderate` to check that moderation works, and change the moderator password while I'm there
- [ ] In the `personal` project's Settings, delete the old app's environment variables (the `REACT_APP_` ones). The new site doesn't use them.
- [x] Push to GitHub: `git push --force-with-lease --follow-tags origin main`. My art was removed from the whole history, so this replaces GitHub's history with the cleaned one (that's why it's a force push), and it uploads the `before-redesign` tag so the old site stays one click away. Not before the site is live: Super.so loads my heads from GitHub `main`, and they'd break.
- [ ] On GitHub, update the repo's About: description, website (`https://ykabusalah.me`), and topics
- [ ] Once ykabusalah.me shows the new site, remove the custom domain in Super.so's settings, then cancel Super.so. In Notion, turn off "Publish to web" on the old site's pages too, or they stay public at a notion.site address.
- [ ] Optional: in Google Search Console, verify the domain with a `TXT` record at Porkbun and submit `https://ykabusalah.me/sitemap.xml`
## Keeping it running

- **My art only lives on this computer.** `src/art/` isn't on GitHub, and the site can't be built with my art without it. It sits inside OneDrive, so keep OneDrive syncing this folder. Same for `.env` and `.env.studio`.
- **Updating the site:** make changes, then run `npm run deploy`. If it says I'm not logged in, run `npx vercel login` again.
- **New visitor drawings** show up on Home as soon as I approve them. They get their sharp vector version the next time I deploy, so deploy now and then after approving a batch.
- **Supabase stays awake** from visits, plus a GitHub workflow that checks in every two days (`.github/workflows/keep-alive.yml`). GitHub pauses scheduled workflows in repos with no commits for 60 days: if I get that email, turn it back on under the repo's Actions tab.
- **The seasonal heads and accent colors** switch on their own by date (`src/lib/seasonal.ts`).
- **The domain renews at Porkbun:** keep auto-renew on.
