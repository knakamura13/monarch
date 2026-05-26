import { test, expect } from '@playwright/test';

const AUTH_ROUTES = [
    '/dashboard',
    '/tasks',
    '/questions',
    '/timeline',
    '/quick-links',
    '/evidence',
    '/settings/profile',
    '/settings/security',
    '/settings/members',
    '/settings/data',
    '/settings/dev'
];

const UNAUTH_ROUTES = [
    '/login',
    '/signup',
    '/forgot-password'
];

test.describe('Mobile UI Audit', () => {
    test.use({
        viewport: { width: 390, height: 844 }, // iPhone 12
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
    });

    for (const route of AUTH_ROUTES) {
        test(`Audit authenticated route ${route} on mobile`, async ({ page }) => {
            await page.goto(route);
            await page.waitForLoadState('networkidle');

            // Wait for any skeletons/loading states to finish
            await page.waitForTimeout(1000);

            // Screenshot top
            await page.screenshot({ path: `audit-mobile-${route.replace(/\//g, '-')}-top.png` });

            // Scroll to bottom
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(500);
            await page.screenshot({ path: `audit-mobile-${route.replace(/\//g, '-')}-bottom.png` });

            // Check for horizontal overflow
            const overflow = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth;
            });
            expect(overflow, `${route} should not have horizontal overflow`).toBe(false);
        });
    }

    for (const route of UNAUTH_ROUTES) {
        test(`Audit unauthenticated route ${route} on mobile`, async ({ page }) => {
            // Disable dev auth bypass via header
            await page.setExtraHTTPHeaders({ 'x-disable-auth-bypass': 'true' });

            await page.goto(route);
            await page.waitForLoadState('networkidle');

            // Wait for any skeletons/loading states to finish
            await page.waitForTimeout(1000);

            // Screenshot top
            await page.screenshot({ path: `audit-mobile-${route.replace(/\//g, '-')}-top.png` });

            // Check for horizontal overflow
            const overflow = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth;
            });
            expect(overflow, `${route} should not have horizontal overflow`).toBe(false);
        });
    }
});
