// @ts-check
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import sharp from 'sharp';

import react from '@astrojs/react';

const hashOf = (file) => createHash('sha1').update(fs.readFileSync(file)).digest('hex');

/**
 * The site should only ever serve resized copies of my art (src/art), never the original files.
 * Astro copies an original into the build whenever it gets loaded, even for hidden drafts, so after
 * every build this deletes any file that is byte-for-byte one of my originals.
 */
const keepArtOriginalsOut = {
  name: 'keep-art-originals-out',
  hooks: {
    'astro:build:done': ({ dir, logger }) => {
      const artDir = path.resolve('src/art');
      if (!fs.existsSync(artDir)) return;
      const originals = new Set(
        fs.readdirSync(artDir, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => hashOf(path.join(entry.parentPath, entry.name))),
      );
      const assets = path.join(fileURLToPath(dir), '_astro');
      if (!fs.existsSync(assets)) return;
      const removed = fs.readdirSync(assets).filter((file) => originals.has(hashOf(path.join(assets, file))));
      for (const file of removed) fs.rmSync(path.join(assets, file));
      logger.info(`Removed ${removed.length} original art file${removed.length === 1 ? '' : 's'} from the build.`);
    },
  },
};

/**
 * Tags tall screenshots in write-ups (taller than wide, like phone screenshots) with data-tall, so
 * the page can size them to fit on screen, and hold their space before they load, instead of
 * stretching them to the full width of the text.
 */
const tagTallScreenshots = {
  name: 'tag-tall-screenshots',
  element: {
    filter: ['img'],
    async visit(node, ctx) {
      const src = node.properties?.src;
      if (typeof src !== 'string' || /^[a-z]+:/i.test(src) || !ctx.fileURL) return;
      try {
        const { width, height } = await sharp(fileURLToPath(new URL(src, ctx.fileURL))).metadata();
        if (width && height && height > width) ctx.setProperty(node, 'data-tall', '');
      } catch {}
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://ykabusalah.me',
  integrations: [react(), keepArtOriginalsOut],
  markdown: { processor: satteri({ hastPlugins: [tagTallScreenshots] }) },
});
