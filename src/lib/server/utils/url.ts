export { isInternalDomain } from '$lib/utils/url';

/**
 * Extracts the hostname from a URL, with a safe fallback for invalid URLs.
 * If the URL is invalid, returns the first 80 characters of the input.
 */
export function extractHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url.slice(0, 80);
    }
}
