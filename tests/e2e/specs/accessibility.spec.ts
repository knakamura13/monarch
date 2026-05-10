import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { TasksPage } from '../pages/TasksPage';

test.describe('Accessibility Smoke Test', () => {
    test.beforeEach(async () => {
        // DEV_MODE=unsafe auto-authenticates the session, no need to log in.
    });

    test('Tasks page should have no accessibility violations', async ({ page }) => {
        const tasksPage = new TasksPage(page);
        await tasksPage.goto();

        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('Add Task Dialog should have no accessibility violations', async ({ page }) => {
        const tasksPage = new TasksPage(page);
        await tasksPage.goto();

        // Open Add Task Dialog
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();

        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });
});
