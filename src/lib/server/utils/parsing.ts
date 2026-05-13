import { logActionError } from '$lib/server/services/actionError.service';
import type { RequestEvent } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';

/**
 * Safely parses a form field that might contain a JSON array or multiple individual values.
 * Returns a string array.
 */
export function parseFormArray(formData: FormData, key: string): string[] {
    return formData
        .getAll(key)
        .flatMap((value) => {
            if (typeof value === 'string' && value.trim().startsWith('[')) {
                try {
                    return JSON.parse(value) as unknown[];
                } catch {
                    return [value];
                }
            }
            return [value];
        })
        .map((value) => String(value))
        .filter((value) => value.length > 0);
}

/**
 * Safely parses a JSON string from a form field and returns a controlled failure if invalid.
 */
export async function safeParseJsonAction<T>(event: RequestEvent, jsonStr: string, actionName: string): Promise<{ data: T } | { error: ReturnType<typeof fail> }> {
    try {
        const data = JSON.parse(jsonStr) as T;
        return { data };
    } catch (e) {
        const message = `Invalid JSON payload in ${actionName}`;
        const errorId = await logActionError(event, { 
            message, 
            status: 400, 
            stack: e instanceof Error ? e.stack : undefined 
        });
        return { error: fail(400, { error: message, errorId }) };
    }
}
