/**
 * Checks if a hostname is an internal/private network address.
 *
 * Covered:
 *   - localhost, *.localhost (RFC 6761)
 *   - IPv4: 0.0.0.0, 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16 link-local
 *   - IPv6: ::, ::1, fc00::/7 unique-local, fe80::/10 link-local, IPv4-mapped
 *     equivalents
 *   - Bracketed IPv6 forms ([::1])
 *
 * Used to short-circuit favicon lookups for hosts that almost certainly
 * cannot answer a public favicon request, avoiding broken-image flashes
 * during preload.
 */
export function isInternalDomain(hostname: string): boolean {
    if (!hostname) return false;
    // Strip surrounding brackets used for IPv6 in URLs (e.g. [::1])
    const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();

    // Hostnames
    if (h === 'localhost' || h.endsWith('.localhost')) return true;

    // IPv4 ranges
    if (/^(?:0\.0\.0\.0|127\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(h)) {
        return true;
    }

    // IPv6 — loopback, unique-local (fc00::/7 ⇒ fc.. or fd..), link-local (fe80::/10)
    if (h === '::' || h === '::1') return true;
    if (/^(?:fc|fd)[0-9a-f]{0,2}:/.test(h)) return true;
    if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;

    // IPv4-mapped IPv6 like ::ffff:127.0.0.1 or ::ffff:10.0.0.1
    const v4mapped = h.match(/^::ffff:([0-9.]+)$/);
    if (v4mapped && v4mapped[1]) return isInternalDomain(v4mapped[1]);

    return false;
}
