import { getCollection, type CollectionEntry } from 'astro:content';

export type WorkEntry = CollectionEntry<'work'>;
export type WorkKind = WorkEntry['data']['kind'];

export const KIND_ORDER: WorkKind[] = ['fellowship', 'project', 'writing'];

export const KIND_HEADING: Record<WorkKind, string> = {
  fellowship: 'Keegan Fellowship',
  project: 'Projects',
  writing: 'Writing',
};

export const KIND_LABEL: Record<WorkKind, string> = {
  fellowship: 'Keegan Fellowship',
  project: 'Project',
  writing: 'Writing',
};

/** Published work in display order; drafts are included only in `npm run dev`. */
export async function getWork(): Promise<WorkEntry[]> {
  const entries = await getCollection('work', ({ data }) => import.meta.env.DEV || !data.draft);
  return entries.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.data.kind) - KIND_ORDER.indexOf(b.data.kind) || a.data.order - b.data.order
  );
}
