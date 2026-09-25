import type { APIRoute } from 'astro';
import { iconResponse } from '../lib/icons';

export const GET: APIRoute = () => iconResponse(96);
