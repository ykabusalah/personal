import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    kind: z.enum(['fellowship', 'project', 'writing']),
    summary: z.string(),
    status: z.enum(['done', 'in-progress']).default('done'),
    // "At a glance" on project pages: what I did, when, and what came of it.
    role: z.string().optional(),
    timeline: z.string().optional(),
    outcome: z.string().optional(),
    stack: z.array(z.string()).default([]),
    github: z.url().optional(),
    // Full URL, or a path on this site like /info.
    live: z.string().optional(),
    // Screenshot or artwork next to the entry file, shown in lists and at the top of its page.
    cover: image().optional(),
    coverAlt: z.string().default(''),
    order: z.number().default(100),
    // Drafts show up in `npm run dev` only, never in the built site.
    draft: z.boolean().default(false),
  }),
});

export const collections = { work };
