import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    throw redirect(303, '/login');
};

export const POST: RequestHandler = async () => {
    throw redirect(303, '/login');
};
