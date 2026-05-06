/**
 * Checks if a hostname is an internal/private network address.
 * Returns true for localhost, 127.x, 10.x, 172.16-31.x, and 192.168.x ranges.
 */
export function isInternalDomain(hostname: string): boolean {
    return /^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname);
}
