// Last check before uploading: the built site must not contain any of my original art files
// (src/art). The build already removes them; this stops a deploy if one ever slips through.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (file) => createHash('sha1').update(fs.readFileSync(file)).digest('hex');
const files = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name))
    : [];

const built = files('dist');
if (!built.length) {
  console.error('Stopping: there is no built site in dist. Run the build first.');
  process.exit(1);
}

const originals = new Set(files('src/art').map(hash));
const leaked = built.filter((file) => originals.has(hash(file)));
if (leaked.length) {
  console.error(`Stopping: these built files are original art and must not be uploaded:\n${leaked.join('\n')}`);
  process.exit(1);
}

console.log(`Checked ${built.length} built files: no original art. Safe to upload.`);
