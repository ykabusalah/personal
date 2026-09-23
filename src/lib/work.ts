import { getCollection, type CollectionEntry } from 'astro:content';

export type WorkEntry = CollectionEntry<'work'>;
export type WorkKind = WorkEntry['data']['kind'];

export const KIND_ORDER: WorkKind[] = ['fellowship', 'writing', 'project'];

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

/** Technical projects and creative work live on separate pages with their own design. */
export const SECTIONS = {
  projects: { path: '/projects', label: 'Projects', kinds: ['project'] as WorkKind[] },
  art: { path: '/art', label: 'Art', kinds: ['fellowship', 'writing'] as WorkKind[] },
};
export type SectionName = keyof typeof SECTIONS;

export const sectionOf = (kind: WorkKind): SectionName => (kind === 'project' ? 'projects' : 'art');
export const hrefFor = (entry: WorkEntry) => `${SECTIONS[sectionOf(entry.data.kind)].path}/${entry.id}`;

/** Published work in display order; drafts are included only in `npm run dev`. */
export async function getWork(): Promise<WorkEntry[]> {
  const entries = await getCollection('work', ({ data }) => import.meta.env.DEV || !data.draft);
  return entries.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.data.kind) - KIND_ORDER.indexOf(b.data.kind) || a.data.order - b.data.order
  );
}

export async function getSection(name: SectionName): Promise<WorkEntry[]> {
  const kinds = SECTIONS[name].kinds;
  return (await getWork()).filter((entry) => kinds.includes(entry.data.kind));
}
