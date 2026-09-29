import type { ImageMetadata } from 'astro';

// My art lives in src/art, which git ignores so it never reaches GitHub. Every lookup here is
// optional: on a machine without that folder, pages build fine and just show no artwork.
//
//   src/art/<slug>/cover.jpg        cover for an Art piece
//   src/art/<slug>/pages/page-1.jpg comic pages, shown in number order
//   src/art/doodles/<name>.png      small doodles for the doodle spots around the site
//   src/art/book-cover.jpg          my book's cover art
//
// Files load only when a page shows them. Loading everything up front would copy the art of
// hidden drafts into the built site as full-size originals.
const loaders = import.meta.glob<ImageMetadata>('../art/**/*.{jpg,jpeg,png,webp,svg}', { import: 'default' });

const paths = Object.keys(loaders).map((path) => path.replace('../art/', ''));
const load = (path: string) => loaders[`../art/${path}`]();
const find = (name: string) => paths.find((path) => path.replace(/\.\w+$/, '') === name);

/** Largest size art is ever served at, so the site never hands out print-quality files. */
export const ART_MAX_WIDTH = 1200;
export const ART_WIDTHS = [400, 800, ART_MAX_WIDTH];

export const coverFor = async (slug: string) => {
  const path = find(`${slug}/cover`);
  return path ? load(path) : undefined;
};

export const pagesFor = (slug: string) =>
  Promise.all(
    paths
      .filter((path) => path.startsWith(`${slug}/pages/`))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(load),
  );

export const doodle = async (name: string) => {
  const path = find(`doodles/${name}`);
  return path ? load(path) : undefined;
};

/** A stand-in from `npm run doodles:mock`. Only for previews while developing, never the live site. */
export const mockDoodle = async (name: string) => {
  const path = find(`doodles-mock/${name}`);
  return path ? load(path) : undefined;
};

export const bookCover = async () => {
  const path = find('book-cover');
  return path ? load(path) : undefined;
};
