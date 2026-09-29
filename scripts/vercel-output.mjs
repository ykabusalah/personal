// Package the built site (dist) the way Vercel expects a prebuilt upload. Vercel then serves these
// files as-is and never tries to build the site from GitHub, where my art isn't.
import fs from 'node:fs';

const out = '.vercel/output';

if (!fs.existsSync('dist/index.html')) {
  console.error('Stopping: there is no built site in dist. Run the build first.');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync('dist', `${out}/static`, { recursive: true });
// Old addresses keep working. The drawing site used to live at draw.ykabusalah.me: its home page
// is /info here, and every other page kept its path. www goes to the plain address. The old
// Super.so site's pages (its About, skill tags, and project pages) go to their closest page here.
const from = (host) => [{ type: 'host', value: host }];
const moved = (src, to) => ({ src, status: 308, headers: { Location: to } });
const config = {
  version: 3,
  routes: [
    { src: '^/$', has: from('draw.ykabusalah.me'), status: 308, headers: { Location: 'https://ykabusalah.me/info' } },
    { src: '^/(.*)$', has: from('draw.ykabusalah.me'), status: 308, headers: { Location: 'https://ykabusalah.me/$1' } },
    { src: '^/(.*)$', has: from('www.ykabusalah.me'), status: 308, headers: { Location: 'https://ykabusalah.me/$1' } },
    moved('^/about-me/projects/?$', '/projects'),
    moved('^/about-me(/.*)?$', '/about'),
    moved('^/projects/(personal|personal-website)/?$', '/projects/ykabusalah-me'),
    { handle: 'filesystem' },
    // Anything else that doesn't exist gets the site's own "page not found" page.
    { handle: 'error' },
    { status: 404, src: '^/.*$', dest: '/404.html' },
  ],
};
fs.writeFileSync(`${out}/config.json`, `${JSON.stringify(config, null, 2)}\n`);

console.log('Packaged the built site for Vercel.');
