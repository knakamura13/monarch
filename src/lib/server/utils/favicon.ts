import { isInternalDomain } from './url';

/**
 * Fetches a favicon URL for a given domain.
 * Tries direct domain favicon first, then falls back to Google's service.
 * Returns null if the URL is invalid or for internal domains.
 */
export async function fetchFaviconUrl(url: string): Promise<string | null> {
    try {
        const hostname = new URL(url).hostname;
        // Skip localhost and internal domains
        if (isInternalDomain(hostname)) {
            return null;
        }
        // Try direct favicon from domain first (no placeholders)
        return `https://${hostname}/favicon.ico`;
    } catch {
        return null;
    }
}

/**
 * Fallback favicon URL for when direct domain favicon fails.
 * Uses Google's service as a fallback with 128px size.
 */
export function getFallbackFaviconUrl(url: string): string | null {
    try {
        const hostname = new URL(url).hostname;
        if (isInternalDomain(hostname)) {
            return null;
        }
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128&default=404`;
    } catch {
        return null;
    }
}
