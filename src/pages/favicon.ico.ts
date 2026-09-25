import type { APIRoute } from 'astro';
import { icoResponse } from '../lib/icons';

export const GET: APIRoute = () => icoResponse(48);
