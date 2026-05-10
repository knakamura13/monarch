import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { logActionError } from '$lib/server/services/actionError.service';

/**
 * Parses a JSON field from form data with consistent error handling.
 * Throws a 400 fail response if parsing fails, logging the error for diagnostics.
 */
export async function parseJsonField<T>(raw: Record<string, unknown>, field: string, event: RequestEvent): Promise<T> {
    try {
        return JSON.parse(Reflect.get(raw, field) as string) as T;
    } catch (e) {
        const errorId = await logActionError(event, {
            message: `Invalid ${field} format`,
            status: 400,
            stack: e instanceof Error ? e.stack : undefined
        });
        throw fail(400, { error: `Invalid ${field} format`, errorId });
    }
}
