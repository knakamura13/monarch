import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TasksPage } from '../pages/TasksPage';

test.describe('Tasks Workflow', () => {
    let tasksPage: TasksPage;

    test.beforeEach(async ({ page }) => {
        tasksPage = new TasksPage(page);
        await tasksPage.goto();
    });

    test('can create, drag-and-drop, and edit a task', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `E2E Task ${testId}`;
        const editedTitle = `${title} Edited`;

        // 1. Create
        await tasksPage.getAddTaskButton('TODO').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        const taskCard = tasksPage.getTaskCard(title);
        await expect(taskCard).toBeVisible();

        // 2. Drag and Drop to 'IN_PROGRESS'
        await tasksPage.dragTaskToColumn(title, 'IN_PROGRESS');
        
        // Wait for potential reorder request
        await page.waitForTimeout(500);

        // 3. Verify Persistence on Reload
        await tasksPage.reload();
        const soonColumn = tasksPage.getColumn('IN_PROGRESS');
        await expect(soonColumn.locator('.task-card').filter({ has: page.getByText(title, { exact: true }) }).first()).toBeVisible();

        // 4. Edit
        await tasksPage.getTaskCard(title).click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, editedTitle);
        await tasksPage.dialog.submit(/save|update/i);
        await tasksPage.dialog.expectHidden();

        await expect(tasksPage.getTaskCard(editedTitle)).toBeVisible();
    });
});
