import type { APIRoute } from 'astro';
import { getSection } from '../lib/work';

// Every public page, for search engines. Made at build time, so it always matches the site.
export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://ykabusalah.me');
  const [projects, art] = await Promise.all([getSection('projects'), getSection('art')]);
  const paths = [
    '/',
    '/about',
    '/projects',
    ...projects.map((entry) => `/projects/${entry.id}`),
    '/art',
    ...art.map((entry) => `/art/${entry.id}`),
    '/info',
  ];
  const urls = paths.map((path) => `  <url><loc>${new URL(path, base)}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
