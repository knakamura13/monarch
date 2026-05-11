import { test, expect } from '@playwright/test';
import { QuickLinksPage } from '../pages/QuickLinksPage';

test.describe('Quick Links Drag and Drop', () => {
    let quickLinksPage: QuickLinksPage;

    test.beforeEach(async ({ page }) => {
        quickLinksPage = new QuickLinksPage(page);
        await quickLinksPage.goto();
    });

    async function createLink(page: any, title: string, url: string) {
        await page.getByRole('button', { name: 'Add link', exact: true }).click();
        await page.locator('input[name="url"]').fill(url);
        await page.locator('input[name="title"]').fill(title);
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.locator('.ql-item').filter({ hasText: title })).toBeVisible();
    }

    async function createFolder(page: any, name: string) {
        await page.getByRole('button', { name: 'Add folder', exact: true }).click();
        await page.locator('input[name="name"]').fill(name);
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        await expect(page.locator('.ql-item').filter({ hasText: name })).toBeVisible();
    }

    test('can reorder links', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title1 = `Link A ${testId}`;
        const title2 = `Link B ${testId}`;

        await createLink(page, title1, 'https://google.com/a');
        await createLink(page, title2, 'https://google.com/b');

        // Verify initial order
        const tiles = page.locator('.ql-item[data-kind="link"]');
        await expect(tiles.nth(0)).toContainText(title1);
        await expect(tiles.nth(1)).toContainText(title2);

        // Drag Link A to Link B position
        await quickLinksPage.dragToReorder(title1, title2);

        // Verify order changed
        await expect(tiles.nth(0)).toContainText(title2);
        await expect(tiles.nth(1)).toContainText(title1);

        // Verify persistence
        await page.reload();
        await expect(tiles.nth(0)).toContainText(title2);
        await expect(tiles.nth(1)).toContainText(title1);
    });

    test('can merge link into folder', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const linkTitle = `Merge Link ${testId}`;
        const folderName = `Target Folder ${testId}`;

        await createLink(page, linkTitle, 'https://google.com/merge');
        await createFolder(page, folderName);

        // Drag Link into Folder
        await quickLinksPage.dragToMerge(linkTitle, folderName);

        // Verify link is no longer in root
        await expect(page.locator('.ql-item[data-kind="link"]').filter({ hasText: linkTitle })).not.toBeVisible();

        // Open folder and verify link is inside
        await quickLinksPage.getFolderTile(folderName).click();
        await expect(page.locator('.dialog-content')).toBeVisible();
        await expect(page.locator('.dialog-content').locator('.ql-item[data-kind="link"]').filter({ hasText: linkTitle })).toBeVisible();
    });
});
