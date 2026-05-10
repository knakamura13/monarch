import { test, expect } from '@playwright/test';
import { TimelinePage } from '../pages/TimelinePage';

test.describe('Timeline Workflow', () => {
    let timelinePage: TimelinePage;

    test.beforeEach(async ({ page }) => {
        timelinePage = new TimelinePage(page);
        await timelinePage.goto();
    });

    test('can create, edit, and drag milestones', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `E2E Milestone ${testId}`;
        const editedTitle = `${title} Edited`;

        // 1. Create
        await page.waitForTimeout(1000); // Hydration safety
        await timelinePage.getAddMilestoneButton('Discovery').click();
        await timelinePage.dialog.expectVisible();
        await timelinePage.dialog.fillInput(/title/i, title);
        await timelinePage.dialog.submit(/create|save/i);
        await timelinePage.dialog.expectHidden();

        // The timeline creation redirects to /timeline#id
        await expect(timelinePage.getMilestoneCard(title)).toBeVisible({ timeout: 10000 });

        // 2. Edit
        await timelinePage.getMilestoneCard(title).click();
        await timelinePage.dialog.expectVisible();
        await timelinePage.dialog.fillInput(/title/i, editedTitle);
        await timelinePage.dialog.submit(/save|update/i);
        await timelinePage.dialog.expectHidden();

        await expect(timelinePage.getMilestoneCard(editedTitle)).toBeVisible();

        // 3. Drag to Next Phase
        await timelinePage.dragMilestoneToPhase(editedTitle, 'Development');
        
        // Wait for reorder/phase update
        await page.waitForTimeout(500);

        // Verify state change
        const devPhase = timelinePage.getPhaseContainer('Development');
        await expect(devPhase.locator('.timeline-milestone-item').filter({ has: page.getByText(editedTitle, { exact: true }) }).first()).toBeVisible();
    });
});
