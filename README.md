# ykabusalah.me

My personal website, rebuilt from scratch around drawing. Visitors draw the home page, doodles draw themselves in as you scroll, and the head in the corner changes with the seasons.

**Live:** [ykabusalah.me](https://ykabusalah.me) · **Draw something:** [ykabusalah.me/info](https://ykabusalah.me/info)

## What's on it

- **Home:** a random approved visitor drawing fills the screen and draws itself in, stroke by stroke. Drawings are traced into vectors at build time, so they stay sharp at any size.
- **About, Projects, Art:** my background, full PRD write-ups of my projects, and my art laid out like a sketchbook.
- **The drawing canvas** (`/info`, then `/draw`): visitors draw and submit. I review every drawing by hand in `/moderate`, and `/stats` is a custom analytics dashboard for the whole funnel.
- **Doodles:** every page has numbered doodle spots in its margins (listed in `src/data/doodle-spots.js`) that draw themselves in as they scroll into view.
- **Seasonal heads:** the drawing of me in the corner changes through the year, and the accent color changes with it (`src/lib/seasonal.ts`).

## Tech stack

| Layer | Technology |
| --- | --- |
| Site | [Astro](https://astro.build) (static pages), with React only where it's needed: the canvas, moderation, and stats |
| Styling | Plain CSS, and TailwindCSS inside the React parts |
| Data | [Supabase](https://supabase.com) (Postgres, storage, and auth), locked down with row-level security |
| Drawings | sharp and potrace trace approved drawings into SVGs at build time |
| Analytics | Custom event tracking, stored in Supabase |
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
| `npm run doodles:pull` | Brings finished doodles in from the doodle drawing page (`studio/`) |
| `npm run doodles:mock` | Draws stand-ins for doodle spots that don't have their real doodle yet |
| `npm run doodles:unmock` | Removes the stand-ins |

## Deploying

The site is uploaded from my computer, not built from GitHub, because my art is only on my computer.

First time only:

```bash
npx vercel login
npx vercel link
```

When linking, create a new project and don't connect the GitHub repo. After that, every update is one command:

```bash
npm run deploy
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
_legacy/          the old drawing app, from before the rebuild
```

## Protecting my art

- My art never goes into this repo or onto GitHub: `src/art/` is ignored by git.
- The site only ever serves resized copies, at most 1200px wide.
- After every build, any original art file that slipped into the output is removed, and `npm run deploy` won't upload if one is still there.
- Right-click and dragging are turned off on artwork, and every page asks AI scrapers not to train on it.

## Database

Supabase holds visitor drawings (`drawings`: name, image, and `pending`, `approved`, or `rejected`) and analytics events (`analytics`). Row-level security lets visitors submit and read approved drawings, and only my moderator account can review them or read analytics. The setup is in `supabase/`.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

The code is open source under the MIT License. My art isn't part of this repo and isn't covered by it: please ask before using it anywhere.

---

Created by Yousef Abu-Salah
