import type { APIRoute } from 'astro';
import { iconResponse } from '../lib/icons';

// The iPhone home screen fills see-through areas with black, so this one keeps a white square behind the head.
export const GET: APIRoute = () => iconResponse(180, 'white');
