# ykabusalah.me

My personal website, built around drawing. Visitors draw the home page, doodles draw themselves in as you scroll, and the head in the corner changes with the seasons.

**Live:** [ykabusalah.me](https://ykabusalah.me) · **Draw something:** [ykabusalah.me/info](https://ykabusalah.me/info)

## The story

### The idea

Portfolio sites are passive. You scroll, maybe skim a project, and leave. There's no reason to stick around and no way to leave a mark. I draw, and I care about art and storytelling, so I wanted my site to invite people in: draw something, and it could become part of my website.

### Version 1: a drawing canvas (June 2025)

This repo started on June 24, 2025 as a small React app: a full-screen canvas where anyone could draw and submit, and a moderation panel where I approve or reject every drawing by hand. Most of it came together in a few days:

- **An edge-to-edge canvas** that keeps your strokes when the window resizes
- **A right-side toolbar** with a triangle-shaped brush slider, a real eraser (it cuts through to the background instead of painting white), and a clear button
- **Submitting** to Supabase, with confetti when it goes through
- **Moderation** at `/moderate`, so nothing shows up until I've seen it

I cut undo and redo to ship it, then brought undo back a day later once it worked properly with snapshots of the canvas.

### Wiring it into my portfolio (August 2025)

My portfolio itself was a Notion page styled with [Super.so](https://super.so) at ykabusalah.me. The canvas moved to its own subdomain, draw.ykabusalah.me, with a link from the portfolio and Google Analytics on both.

Around then I also locked the database down with row-level security (and got every hardcoded key out of the code), blocked phones with a friendly note to come back on a computer, and made sure small windows got told the canvas needed more room.

### Making it mine (December 2025 to January 2026)

- **Keyboard shortcuts:** P, E, Ctrl+Z, Ctrl+Y, `[` and `]` for brush size, Ctrl+S to save
- **My own analytics:** I replaced Google Analytics with my own event tracking in Supabase and a `/stats` dashboard for the whole funnel: home page, draw click, intro, canvas, submit. A small script on the Super.so site passed each visitor's ID along in the link, so I could follow someone from my portfolio all the way to a submitted drawing, and see where people drop off, how often they undo, and when they draw.
- **A redesigned moderation panel** and an intro page with a live count of featured drawings
- **Seasonal heads:** the drawing of me in the corner started changing through the year

### The redesign (September 2026)

By then the canvas felt like me, but the rest of the site didn't. It looked like every other Notion site, it lived on two domains stitched together through links, and I was paying Super.so for it. So I rebuilt everything as one site with [Astro](https://astro.build), with three goals: make it look like me, keep what already worked, and keep it simple.

- **Visitor drawings became the home page.** Every visit shows a random approved drawing, drawn in stroke by stroke.
- **My own art moved in:** doodles in the margins, my portrait on About, and a sketchbook-style Art page
- **Projects are written as PRDs,** the way I'd write them at work
- **Everything is on ykabusalah.me.** The canvas moved to ykabusalah.me/draw, and old Super.so links forward to their new pages.

The canvas, moderation, and analytics came along almost unchanged, and so did every drawing anyone has ever submitted.

### Where it's headed

Real hand-drawn doodles in every margin, a dark mode that feels like a chalkboard, and drawing on phones. The details are in [ROADMAP.md](ROADMAP.md).

### See every version

- **Before the redesign:** the [`before-redesign`](https://github.com/ykabusalah/personal/tree/before-redesign) tag is the repo exactly as it was, and the old drawing app's code also lives on in [`_legacy/`](_legacy/).
- **Everything that changed:** [before-redesign...main](https://github.com/ykabusalah/personal/compare/before-redesign...main) shows the redesign commit by commit.
- **The whole history:** the [commit log](https://github.com/ykabusalah/personal/commits/main) goes back to the first day.

## What's on it

- **Home:** a random approved visitor drawing fills the screen and draws itself in, stroke by stroke. Drawings are traced into vectors at build time, so they stay sharp at any size.
- **About, Projects, Art:** my background, PRD write-ups of my projects, and my art laid out like a sketchbook.
- **The drawing canvas** (`/info`, then `/draw`): visitors draw and submit. I review every drawing by hand in `/moderate`, and `/stats` is the analytics dashboard.
- **Doodles:** every page has numbered doodle spots in its margins (listed in `src/data/doodle-spots.js`) that draw themselves in as they scroll into view.
- **Seasonal heads:** the drawing of me in the corner changes through the year, and the site's accent color changes with it (`src/lib/seasonal.ts`).

## Tech stack

| Layer | Technology |
| --- | --- |
| Site | [Astro](https://astro.build) (static pages), with React only where it's needed: the canvas, moderation, and stats |
| Styling | Plain CSS, and TailwindCSS inside the React parts |
| Data | [Supabase](https://supabase.com) (Postgres, storage, and auth), locked down with row-level security |
| Drawings | sharp and potrace trace approved drawings into SVGs at build time |
| Analytics | My own event tracking, stored in Supabase |
| Hosting | [Vercel](https://vercel.com), deployed from my computer as a prebuilt site |

## Running it locally

```bash
npm install
npm run dev
```

It needs a `.env` file with the public Supabase values (safe to ship to the browser; the database only allows what row-level security permits):

```env
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

My art lives in `src/art/`, which isn't in this repo. Without it, the site still builds; the spots for art are just empty.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server at `localhost:4321` |
| `npm run build` | Builds the site into `dist/` |
| `npm run preview` | Serves the built site locally |
| `npm run deploy` | Builds, checks that no original art made it into the build, and uploads to Vercel |
| `npm run deploy:preview` | The same, to a preview address instead of the live site |
| `npm run ship` | Deploys, then pushes to GitHub, so both are up to date (stops if anything isn't committed) |
| `npm run doodles:pull` | Brings finished doodles in from the doodle drawing page (`studio/`) |
| `npm run doodles:mock` | Draws stand-ins for doodle spots that don't have their real doodle yet |
| `npm run doodles:unmock` | Removes the stand-ins |

## Deploying

The site is uploaded from my computer, not built from GitHub, because my art is only on my computer (so the Vercel project isn't connected to this repo). Once `npx vercel login` and `npx vercel link` are done, every update is one command, which puts the site live and pushes to GitHub:

```bash
npm run ship
```

## How it's organized

```text
src/
  pages/          one file per page (projects and art pages come from src/content)
  components/     shared pieces: the header, doodles, visitor drawing, stats
  content/work/   project write-ups and art pieces, in Markdown
  data/           the doodle spots, and other small data files
  islands/        the React parts: canvas, moderation, stats
  lib/            helpers: art loading, seasons, colors, tracking, animations
  styles/         shared CSS
  art/            my art (not in this repo)
public/           files served as-is
scripts/          build, check, and deploy helpers
supabase/         the SQL that sets up and locks down the database
studio/           a separate drawing page for making doodles (see studio/README.md)
_legacy/          the original drawing app, from before the redesign
```

## Protecting my art

- My art never goes into this repo or onto GitHub: `src/art/` is ignored by git.
- The site only ever serves resized copies, at most 1200px wide.
- After every build, any original art file that slipped into the output is removed, and `npm run deploy` won't upload if one is still there.
- Right-click and dragging are turned off on artwork, and every page asks AI scrapers not to train on it.

## Database

Supabase holds visitor drawings (`drawings`: name, image, and `pending`, `approved`, or `rejected`) and analytics events (`analytics`). Row-level security lets visitors submit and read approved drawings, and only my moderator account can review them or read analytics. The setup is in `supabase/`.

## License

The code is open source under the MIT License. My art isn't part of this repo and isn't covered by it: please ask before using it anywhere.

---

Created by Yousef Abu-Salah
