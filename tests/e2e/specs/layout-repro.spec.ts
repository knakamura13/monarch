import { test, expect } from '@playwright/test';

test.describe('Mobile Layout Verification', () => {
    const devices = [
        { name: 'iPhone 12', width: 390, height: 844, safeArea: { top: 47, right: 0, bottom: 34, left: 0 } },
        { name: 'iPhone 12 Landscape', width: 844, height: 390, safeArea: { top: 0, right: 47, bottom: 21, left: 47 } },
        { name: 'Small Mobile', width: 320, height: 568, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } },
    ];

    for (const device of devices) {
        test(`layout on ${device.name}`, async ({ page }) => {
            await page.setViewportSize({ width: device.width, height: device.height });

            // Navigate to dashboard
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');

            // Inject CSS to simulate safe-area-insets if needed,
            // but Playwright's emulated devices should handle it if configured in config.
            // For this repro, we'll manually check the padding of main-content.

            const mainContent = page.locator('.main-content');
            await expect(mainContent).toBeVisible();

            const padding = await mainContent.evaluate((el) => {
                const style = window.getComputedStyle(el);
                return {
                    left: style.paddingLeft,
                    right: style.paddingRight
                };
            });

            console.log(`${device.name} padding:`, padding);

            // Take screenshot
            await page.screenshot({ path: `repro-${device.name.replace(/ /g, '-')}.png`, fullPage: true });

            // Check for potential overflow
            const overflow = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth;
            });

            expect(overflow, `${device.name} should not have horizontal overflow`).toBe(false);
        });
    }
});
