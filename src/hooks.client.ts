import type { HandleClientError } from '@sveltejs/kit';
import { showErrorToast } from '$lib/stores/errorToast';

// Must stay in sync with the caps on `/api/errors/client`; there's no point
// shipping a 2 MB stack trace over the wire just to have it rejected.
const MAX_MESSAGE_CHARS = 2_000;
const MAX_STACK_CHARS = 50_000;

function clip(value: string | undefined, max: number): string | undefined {
    if (!value) return value;
    return value.length > max ? value.slice(0, max) : value;
}

export const handleError: HandleClientError = async ({ error, event, message }) => {
    const err = error instanceof Error ? error : new Error(String(error));

    // Handle version mismatch (deployment during active session)
    if (err.message?.includes('Failed to fetch dynamically imported module')) {
        const key = 'monarch_last_reload';
        const now = Date.now();
        const lastReload = parseInt(sessionStorage.getItem(key) ?? '0', 10);

        // Limit auto-reload to once per 30 seconds to prevent loops
        if (now - lastReload > 30000) {
            sessionStorage.setItem(key, now.toString());
            window.location.reload();
            return { message: 'New version available, reloading...' };
        }
    }

    const displayMessage = err.message || message;
    const truncatedMessage = clip(displayMessage, MAX_MESSAGE_CHARS) ?? displayMessage;
    const truncatedStack = clip(err.stack, MAX_STACK_CHARS);

    // Best-effort: persist client-side failures for later diagnosis.
    try {
        await fetch('/api/errors/client', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message: truncatedMessage,
                stack: truncatedStack,
                url: event.url?.toString?.() ?? String(event.url),
                userAgent: navigator.userAgent
            })
        });
    } catch {
        // ignore
    }

    showErrorToast({ message: displayMessage, stack: truncatedStack });
    return { message: displayMessage };
};
