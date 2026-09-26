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
fs.writeFileSync(`${out}/config.json`, `${JSON.stringify({ version: 3 }, null, 2)}\n`);

console.log('Packaged the built site for Vercel.');
