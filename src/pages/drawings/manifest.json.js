import { getTracedDrawings } from '../../lib/drawings-build.js';

// Tells Home which drawings have a sharp vector version; anything missing falls back to the original PNG.
export async function GET() {
  const drawings = await getTracedDrawings();
  return Response.json({ drawings: drawings.map(({ id, ratio }) => ({ id, ratio })) });
}
