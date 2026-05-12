import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building, dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { logError } from '$lib/server/services/errorLog.service';
import { redactSearchParams } from '$lib/server/utils/redact';
import { DEV_USER, DEV_WORKSPACE, DEV_SESSION, ensureDevUserSeeded } from '$lib/server/dev-user';
import { ENV } from '$lib/server/env';
import { getWorkspace } from '$lib/server/cache/workspaceCache';

function makeRequestId() {
    // Short-ish id that's useful in logs and UI.
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

const requestIdHandle: Handle = async ({ event, resolve }) => {
    event.locals.requestId = makeRequestId();
    const response = await resolve(event);
    response.headers.set('x-request-id', event.locals.requestId);
    return response;
};

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Ensure dynamic navigation requests aren't stale
    if (event.request.headers.get('accept')?.includes('text/html')) {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
    }

    // HSTS only in production when we know HTTPS is available
    if (ENV.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return response;
};

const sessionHandle: Handle = async ({ event, resolve }) => {
    event.locals.user = null;
    event.locals.session = null;
    event.locals.workspace = null;

    if (dev) {
        try {
            await ensureDevUserSeeded();
            event.locals.user = DEV_USER;
            event.locals.session = DEV_SESSION;
            event.locals.workspace = DEV_WORKSPACE;
            return resolve(event);
        } catch (err) {
            // Dev user seeding failed (likely DEV_MODE not set to unsafe).
            // Fall through to normal auth flow.
            console.warn('[hooks] dev user seeding skipped:', err);
        }
    }

    try {
        const session = await auth.api.getSession({ headers: event.request.headers });
        if (session?.user && session.session) {
            event.locals.user = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name ?? null,
                image: session.user.image ?? null
            };
            event.locals.session = {
                id: session.session.id,
                expiresAt: new Date(session.session.expiresAt)
            };

            // Workspace lookup with 60-second cache to eliminate DynamoDB query on every request
            let workspace;
            try {
                workspace = await getWorkspace(session.user.id);
            } catch (wsErr) {
                console.error('[hooks] workspace lookup error', wsErr);
                const errorId = (await logError({
                    requestId: event.locals.requestId,
                    source: 'SERVER',
                    status: 500,
                    route: event.url.pathname,
                    method: event.request.method,
                    message: wsErr instanceof Error ? wsErr.message : String(wsErr),
                    stack: wsErr instanceof Error ? (wsErr.stack ?? null) : null,
                    userId: session.user.id,
                    workspaceId: null,
                    userAgent: event.request.headers.get('user-agent'),
                    context: { phase: 'workspace-lookup' }
                }).catch(() => ({}))).id;
                
                if (!dev) {
                    throw new Error(`Critical platform failure: Failed to load workspace (Error ID: ${errorId ?? 'unknown'})`);
                }
            }

            if (workspace) {
                event.locals.workspace = workspace;
            } else {
                // User has no active membership - clear session to force re-auth
                console.log('[hooks] user has no active membership, clearing session');
                event.locals.user = null;
                event.locals.session = null;
                event.locals.workspace = null;
            }
        }
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('Critical platform failure')) throw err;

        console.error('[hooks] session load error', err);
        const errorId = (await logError({
            requestId: event.locals.requestId,
            source: 'SERVER',
            status: 500,
            route: event.url.pathname,
            method: event.request.method,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? (err.stack ?? null) : null,
            userId: null,
            workspaceId: null,
            userAgent: event.request.headers.get('user-agent'),
            context: { phase: 'session-load' }
        }).catch(() => ({}))).id;

        if (!dev) {
            throw new Error(`Critical platform failure: Failed to load session (Error ID: ${errorId ?? 'unknown'})`);
        }
    }

    return resolve(event);
};

const betterAuthHandle: Handle = async ({ event, resolve }) => svelteKitHandler({ event, resolve, auth, building });

export const handle = sequence(requestIdHandle, securityHeadersHandle, sessionHandle, betterAuthHandle);

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
    const requestId = event.locals.requestId;
    const isOwner = event.locals.workspace?.role === 'OWNER';

    const err = error instanceof Error ? error : new Error(String(error));
    const stack = err.stack ?? null;
    const rawMessage = err.message || message;
    const contentLength = event.request.headers.get('content-length');

    let errorId: string | undefined;
    try {
        const created = await logError({
            requestId,
            source: 'SERVER',
            status: status ?? null,
            route: event.url.pathname,
            method: event.request.method,
            message: rawMessage,
            stack,
            userId: event.locals.user?.id ?? null,
            workspaceId: event.locals.workspace?.id ?? null,
            userAgent: event.request.headers.get('user-agent'),
            context: {
                params: event.params,
                query: redactSearchParams(event.url.searchParams),
                bodySummary: {
                    hasBody: event.request.headers.has('content-length') || event.request.headers.has('transfer-encoding'),
                    contentType: event.request.headers.get('content-type'),
                    size: contentLength ? Number(contentLength) : null
                }
            }
        });
        errorId = created.id;
    } catch (logErr) {
        console.error('[hooks] error persistence failed', logErr);
    }

    return {
        // Non-owners only see SvelteKit's sanitized `message` ("Internal Error"
        // for unhandled 500s) so raw exception text — DB constraint names,
        // integration errors, stack fragments — never leaks to end users.
        message: isOwner ? rawMessage : message,
        errorId,
        requestId,
        ...(isOwner ? { stack: stack ?? undefined } : {})
    };
};
