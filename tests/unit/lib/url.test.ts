import { describe, it, expect } from 'vitest';
import { isInternalDomain } from '$lib/utils/url';

describe('isInternalDomain', () => {
    describe('hostnames', () => {
        it('matches localhost', () => {
            expect(isInternalDomain('localhost')).toBe(true);
        });
        it('matches *.localhost (RFC 6761)', () => {
            expect(isInternalDomain('app.localhost')).toBe(true);
        });
        it('rejects unrelated public hosts', () => {
            expect(isInternalDomain('example.com')).toBe(false);
            expect(isInternalDomain('api.github.com')).toBe(false);
        });
        it('returns false for empty / nullish-like input', () => {
            expect(isInternalDomain('')).toBe(false);
        });
    });

    describe('IPv4 ranges', () => {
        it('matches 0.0.0.0', () => {
            expect(isInternalDomain('0.0.0.0')).toBe(true);
        });
        it('matches loopback 127/8', () => {
            expect(isInternalDomain('127.0.0.1')).toBe(true);
            expect(isInternalDomain('127.255.255.254')).toBe(true);
        });
        it('matches RFC 1918 10/8', () => {
            expect(isInternalDomain('10.0.0.1')).toBe(true);
        });
        it('matches RFC 1918 172.16/12 boundaries', () => {
            expect(isInternalDomain('172.16.0.1')).toBe(true);
            expect(isInternalDomain('172.20.0.1')).toBe(true);
            expect(isInternalDomain('172.31.255.255')).toBe(true);
        });
        it('rejects 172.x outside the private range', () => {
            expect(isInternalDomain('172.15.0.1')).toBe(false);
            expect(isInternalDomain('172.32.0.1')).toBe(false);
        });
        it('matches RFC 1918 192.168/16', () => {
            expect(isInternalDomain('192.168.1.1')).toBe(true);
        });
        it('matches link-local 169.254/16', () => {
            expect(isInternalDomain('169.254.169.254')).toBe(true);
        });
    });

    describe('IPv6', () => {
        it('matches loopback ::1', () => {
            expect(isInternalDomain('::1')).toBe(true);
        });
        it('matches the unspecified address ::', () => {
            expect(isInternalDomain('::')).toBe(true);
        });
        it('matches unique-local fc00::/7', () => {
            expect(isInternalDomain('fc00::1')).toBe(true);
            expect(isInternalDomain('fd12:3456:789a::1')).toBe(true);
        });
        it('matches link-local fe80::/10', () => {
            expect(isInternalDomain('fe80::1')).toBe(true);
        });
        it('rejects public IPv6 addresses', () => {
            expect(isInternalDomain('2606:4700:4700::1111')).toBe(false);
            expect(isInternalDomain('2001:db8::1')).toBe(false);
        });
        it('handles bracketed IPv6 forms used in URL hosts', () => {
            expect(isInternalDomain('[::1]')).toBe(true);
            expect(isInternalDomain('[fe80::1]')).toBe(true);
        });
        it('handles IPv4-mapped IPv6', () => {
            expect(isInternalDomain('::ffff:127.0.0.1')).toBe(true);
            expect(isInternalDomain('::ffff:10.0.0.1')).toBe(true);
            expect(isInternalDomain('::ffff:8.8.8.8')).toBe(false);
        });
    });

    describe('case-insensitivity', () => {
        it('treats hostnames as case-insensitive', () => {
            expect(isInternalDomain('LOCALHOST')).toBe(true);
            expect(isInternalDomain('FE80::1')).toBe(true);
        });
    });
});
