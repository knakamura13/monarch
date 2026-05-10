const SENSITIVE_KEY_RE = /token|secret|password|passwd|pass|apikey|api_key|key|auth|session|otp|nonce|code|sig|signature/i;

const REDACTED = '[redacted]';

function isSensitive(key: string): boolean {
    return SENSITIVE_KEY_RE.test(key);
}

/** Build a redacted plain-object copy of URLSearchParams entries. */
export function redactSearchParams(params: URLSearchParams): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
        Reflect.set(out, k, isSensitive(k) ? REDACTED : v);
    }
    return out;
}

/**
 * Return a copy of `input` where any top-level value whose key matches the
 * sensitive pattern is replaced with "[redacted]". Non-recursive by design —
 * we only redact shallowly because we're never storing deeply-nested request
 * payloads in ErrorLog.context.
 */
export function redactObject<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
        Reflect.set(out, k, isSensitive(k) ? REDACTED : v);
    }
    return out;
}

/**
 * Parse a URL and redact sensitive query params. Invalid URLs are returned
 * unchanged — callers are storing this for diagnostics, not for routing.
 */
export function redactUrl(raw: string): string {
    try {
        const u = new URL(raw);
        for (const k of Array.from(u.searchParams.keys())) {
            if (isSensitive(k)) u.searchParams.set(k, REDACTED);
        }
        return u.toString();
    } catch {
        return raw;
    }
}
