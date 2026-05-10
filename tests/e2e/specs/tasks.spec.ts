import { test, expect } from '@playwright/test';
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
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        const taskCard = tasksPage.getTaskCard(title);
        await expect(taskCard).toBeVisible();

        // 2. Drag and Drop to 'Doing'
        await tasksPage.dragTaskToColumn(title, 'Doing');
        
        // Wait for potential reorder request
        await page.waitForTimeout(500);

        // 3. Verify Persistence on Reload
        await tasksPage.reload();
        const soonColumn = tasksPage.getColumn('Doing');
        await expect(soonColumn.locator('.task-card').filter({ has: page.getByText(title, { exact: true }) }).first()).toBeVisible();

        // 4. Edit
        await tasksPage.getTaskCard(title).click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, editedTitle);
        await tasksPage.dialog.submit(/save|update/i);
        await tasksPage.dialog.expectHidden();

        await expect(tasksPage.getTaskCard(editedTitle)).toBeVisible();
    });

    test('drag-and-drop: same-lane reordering works', async ({ page: _page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title1 = `Task A ${testId}`;
        const title2 = `Task B ${testId}`;

        // Create two tasks in the same column
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title1);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title2);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        // Verify initial order
        const initialOrder1 = await tasksPage.getTaskOrderInColumn(title1, 'To do');
        const initialOrder2 = await tasksPage.getTaskOrderInColumn(title2, 'To do');
        expect(initialOrder1).toBeLessThan(initialOrder2);

        // Drag task1 after task2
        await tasksPage.dragTaskToPosition(title1, title2, 'after');

        // Verify order changed
        const newOrder1 = await tasksPage.getTaskOrderInColumn(title1, 'To do');
        const newOrder2 = await tasksPage.getTaskOrderInColumn(title2, 'To do');
        expect(newOrder1).toBeGreaterThan(newOrder2);

        // Verify persistence
        await tasksPage.reload();
        const finalOrder1 = await tasksPage.getTaskOrderInColumn(title1, 'To do');
        const finalOrder2 = await tasksPage.getTaskOrderInColumn(title2, 'To do');
        expect(finalOrder1).toBeGreaterThan(finalOrder2);
    });

    test('drag-and-drop: cross-lane move works', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `Task ${testId}`;

        // Create task in 'To do'
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        // Verify it's in 'To do'
        await expect(tasksPage.getColumn('To do').locator('.task-card').filter({ has: page.getByText(title, { exact: true }) })).toBeVisible();

        // Drag to 'Doing'
        await tasksPage.dragTaskToColumn(title, 'Doing');
        await page.waitForTimeout(500);

        // Verify it moved
        await expect(tasksPage.getColumn('Doing').locator('.task-card').filter({ has: page.getByText(title, { exact: true }) })).toBeVisible();
        await expect(tasksPage.getColumn('To do').locator('.task-card').filter({ has: page.getByText(title, { exact: true }) })).toHaveCount(0);

        // Verify persistence
        await tasksPage.reload();
        await expect(tasksPage.getColumn('Doing').locator('.task-card').filter({ has: page.getByText(title, { exact: true }) })).toBeVisible();
    });

    test('drag-and-drop: drop indicator is visible during drag', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `Task ${testId}`;
        const title2 = `Task Target ${testId}`;

        // Create two tasks
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title2);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        // Start dragging
        const task = tasksPage.getTaskCard(title);
        await task.hover();
        await page.mouse.down();
        await page.mouse.move(0, 10);

        // Verify drop indicator appears when hovering over target
        const targetTask = tasksPage.getTaskCard(title2);
        await targetTask.hover();
        
        const dropIndicator = tasksPage.getColumn('To do').locator('.task-card-drop-indicator');
        await expect(dropIndicator.first()).toBeVisible();

        // Clean up
        await page.mouse.up();
    });

    test('drag-and-drop: drop indicator positioning is correct (before)', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `Task ${testId}`;
        const title2 = `Task Target ${testId}`;

        // Create two tasks
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title2);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        // Start dragging first task
        const task = tasksPage.getTaskCard(title);
        await task.hover();
        await page.mouse.down();
        await page.mouse.move(0, 10);

        // Hover over top half of target task to show "before" indicator
        const targetTask = tasksPage.getTaskCard(title2);
        const targetBox = await targetTask.boundingBox();
        if (!targetBox) throw new Error('Target task not visible');
        
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 4);
        
        // Verify indicator is before target (no bottom class)
        const dropIndicator = tasksPage.getColumn('To do').locator('.task-card-drop-indicator').first();
        await expect(dropIndicator).toBeVisible();
        await expect(dropIndicator).not.toHaveClass(/task-card-drop-indicator-bottom/);

        // Clean up
        await page.mouse.up();
    });

    test('drag-and-drop: drop indicator positioning is correct (after)', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `Task ${testId}`;
        const title2 = `Task Target ${testId}`;

        // Create two tasks
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title2);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        // Start dragging first task
        const task = tasksPage.getTaskCard(title);
        await task.hover();
        await page.mouse.down();
        await page.mouse.move(0, 10);

        // Hover over bottom half of target task to show "after" indicator
        const targetTask = tasksPage.getTaskCard(title2);
        const targetBox = await targetTask.boundingBox();
        if (!targetBox) throw new Error('Target task not visible');
        
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height * 0.75);
        
        // Verify indicator is after target (has bottom class)
        const dropIndicator = tasksPage.getColumn('To do').locator('.task-card-drop-indicator').first();
        await expect(dropIndicator).toBeVisible();
        await expect(dropIndicator).toHaveClass(/task-card-drop-indicator-bottom/);

        // Clean up
        await page.mouse.up();
    });

    test('drag-and-drop: dragging to empty column works', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `Task ${testId}`;

        // Create task in 'To do'
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        // Verify 'On hold' column is empty
        const onHoldColumn = tasksPage.getColumn('On hold');
        await expect(onHoldColumn.locator('.task-card')).toHaveCount(0);

        // Drag to empty 'On hold' column
        await tasksPage.dragTaskToColumn(title, 'On hold');
        await page.waitForTimeout(500);

        // Verify it moved to empty column
        await expect(onHoldColumn.locator('.task-card').filter({ has: page.getByText(title, { exact: true }) })).toBeVisible();
        await expect(tasksPage.getColumn('To do').locator('.task-card').filter({ has: page.getByText(title, { exact: true }) })).toHaveCount(0);

        // Verify persistence
        await tasksPage.reload();
        await expect(onHoldColumn.locator('.task-card').filter({ has: page.getByText(title, { exact: true }) })).toBeVisible();
    });

    test('drag-and-drop: works with page scroll', async ({ page }) => {
        const testId = Math.random().toString(36).slice(2, 7);
        const title = `Task ${testId}`;
        const title2 = `Task Bottom ${testId}`;

        // Create first task
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        // Create enough tasks to make the column scrollable
        for (let i = 0; i < 10; i++) {
            await tasksPage.getAddTaskButton('To do').click();
            await tasksPage.dialog.expectVisible();
            await tasksPage.dialog.fillInput(/title/i, `Filler Task ${i}`);
            await tasksPage.dialog.submit(/create|save/i);
            await tasksPage.dialog.expectHidden();
        }

        // Create task at bottom
        await tasksPage.getAddTaskButton('To do').click();
        await tasksPage.dialog.expectVisible();
        await tasksPage.dialog.fillInput(/title/i, title2);
        await tasksPage.dialog.submit(/create|save/i);
        await tasksPage.dialog.expectHidden();

        // Scroll to bottom
        const column = tasksPage.getColumn('To do');
        await column.evaluate((el) => el.scrollTop = el.scrollHeight);

        // Drag bottom task up
        await tasksPage.dragTaskToPosition(title2, title, 'before');
        await page.waitForTimeout(500);

        // Verify order changed
        const order1 = await tasksPage.getTaskOrderInColumn(title, 'To do');
        const order2 = await tasksPage.getTaskOrderInColumn(title2, 'To do');
        expect(order2).toBeLessThan(order1);

        // Verify persistence
        await tasksPage.reload();
        const finalOrder1 = await tasksPage.getTaskOrderInColumn(title, 'To do');
        const finalOrder2 = await tasksPage.getTaskOrderInColumn(title2, 'To do');
        expect(finalOrder2).toBeLessThan(finalOrder1);
    });
});
