import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TasksPage } from '../pages/TasksPage';

test.describe('Components Smoke Test', () => {
    test.beforeEach(async ({ page }) => {
        // DEV_MODE=unsafe auto-authenticates the session, no need to log in.
    });

    test('Dialog opens, closes, and page navigation remains stable', async ({ page }) => {
        const tasksPage = new TasksPage(page);
        await tasksPage.goto();

        // Open Add Task Dialog
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();

        // Close it
        await tasksPage.dialog.close();
        await tasksPage.dialog.expectHidden();

        // Ensure page didn't inadvertently navigate or break
        await expect(page).toHaveURL(/.*tasks/);
        
        // Reload to test "pages stop refreshing" bug
        await tasksPage.reload();
        await expect(tasksPage.getAddTaskButton('To do')).toBeVisible();
    });
});
