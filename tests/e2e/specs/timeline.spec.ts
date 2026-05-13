import { test, expect } from '@playwright/test';
import { TimelinePage } from '../pages/TimelinePage';

test.describe('Timeline Workflow', () => {
    let timelinePage: TimelinePage;

    test.beforeEach(async ({ page }) => {
        timelinePage = new TimelinePage(page);
        await timelinePage.goto();
    });

    test('can create, edit, and drag milestones within a phase', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `E2E Milestone ${testId}`;
        const editedTitle = `${title} Edited`;

        // 1. Create in Preparation
        await page.waitForTimeout(1000); // Hydration safety
        await timelinePage.getAddMilestoneButton('Preparation').click();
        await timelinePage.dialog.expectVisible();
        await timelinePage.dialog.fillInput(/title/i, title);
        await timelinePage.dialog.submit(/create|save/i);
        await timelinePage.dialog.expectHidden();

        await expect(timelinePage.getMilestoneCard(title)).toBeVisible({ timeout: 10000 });

        // 2. Edit
        await timelinePage.getMilestoneCard(title).click();
        await timelinePage.dialog.expectVisible();
        await timelinePage.dialog.fillInput(/title/i, editedTitle);
        await timelinePage.dialog.submit(/save|update/i);
        await timelinePage.dialog.expectHidden();

        await expect(timelinePage.getMilestoneCard(editedTitle)).toBeVisible();

        // 3. Create another one to test reordering
        const title2 = `Other Milestone ${testId}`;
        await timelinePage.getAddMilestoneButton('Preparation').click();
        await timelinePage.dialog.fillInput(/title/i, title2);
        await timelinePage.dialog.submit(/create|save/i);
        await timelinePage.dialog.expectHidden();
        
        await expect(timelinePage.getMilestoneCard(title2)).toBeVisible();

        // 4. Drag and reorder
        // Initial order: title (editedTitle), title2
        // Drag title2 before editedTitle
        const card2 = timelinePage.getMilestoneCard(title2);
        const handle2 = card2.locator('.milestone-drag-handle');
        const targetCard = timelinePage.getMilestoneCard(editedTitle);

        const targetBox = await targetCard.boundingBox();
        if (!targetBox) throw new Error('Target card not visible');

        await handle2.hover();
        await page.mouse.down();
        await page.mouse.move(0, 10); // threshold
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 4);
        await page.mouse.up();

        // Wait for reorder save
        await page.waitForTimeout(1000);

        // Verify reorder (title2 should now be before editedTitle)
        const phase = timelinePage.getPhaseContainer('Preparation');
        const milestoneWrappers = phase.locator('.milestone-wrapper');
        await expect(milestoneWrappers.nth(0)).toContainText(title2);
        await expect(milestoneWrappers.nth(1)).toContainText(editedTitle);
    });
});
