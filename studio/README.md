# Doodle Studio

A private drawing page for the site's doodles. It's hosted on its own, apart from the site. Whoever has a private link can draw and save. Every stroke is kept with its timing and pen pressure, so a doodle can be redrawn on the site the way it was drawn.

Artists see only a drawing page. Nothing in the online studio mentions the site or where doodles go. Choosing where each doodle goes happens only on your computer.

## Try it on this computer

```
npm run studio
```

Then open http://localhost:4330/#key=local. That's practice mode: doodles save in your browser only.

## Set it up (once)

1. In the Supabase SQL editor, run `supabase/studio.sql`.
2. Make the links, running each line on its own and copying what it returns:
   - `select public.studio_new_link('Friend');` for your friend
   - `select public.studio_new_link('Yousef', true);` for you. It sees everyone's doodles.
3. Put your key in a new file named `.env.studio` in the project folder: `STUDIO_OWNER_KEY=<your key>`
4. Log in to Vercel and link the studio as a new project. Don't connect GitHub:
   ```
   npx vercel login
   cd studio
   npx vercel link
   ```
5. From the project folder, run `npm run studio:deploy`. The address it prints is the studio.
6. Send your friend `<studio address>/#key=<their key>`.

To turn a link off: `update public.studio_links set active = false where label = 'Friend';`

## Bring doodles into the site

1. Run `npm run studio` and open `http://localhost:4330/#key=<your key>`. On your computer, your link shows a **Spot** picker.
2. Open each doodle and pick its spot.
3. Run `npm run doodles:pull`.

Each placed doodle is saved to `src/art/doodles/` under its spot's name. That folder stays on your computer and is never committed. If you move a doodle to another spot, the next pull clears the old spot. The pull only ever removes files it made itself.
