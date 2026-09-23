import { getTracedDrawings } from '../../lib/drawings-build.js';

export async function getStaticPaths() {
  const drawings = await getTracedDrawings();
  return drawings.map(({ id, svg }) => ({ params: { id }, props: { svg } }));
}

export function GET({ props }) {
  return new Response(props.svg, { headers: { 'Content-Type': 'image/svg+xml' } });
}
