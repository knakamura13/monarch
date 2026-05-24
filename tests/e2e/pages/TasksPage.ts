import { type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { DialogComponent } from '../components/DialogComponent';

export class TasksPage extends BasePage {
    readonly dialog: DialogComponent;

    constructor(page: Page) {
        super(page);
        this.dialog = new DialogComponent(page);
    }

    async goto() {
        await super.goto('/tasks');
        await this.page.waitForLoadState('networkidle');
    }

    getTaskCard(title: string) {
        return this.page.locator('.task-card').filter({ has: this.page.getByText(title, { exact: true }) }).first();
    }

    getColumn(status: string) {
        return this.page.locator(`.tasks-column[data-status="${status}"]`);
    }

    getAddTaskButton(columnLabel: string) {
        return this.getColumn(columnLabel).getByRole('button', { name: /add a card/i });
    }

    async dragTaskToColumn(taskTitle: string, columnLabel: string) {
        const task = this.getTaskCard(taskTitle);
        const handle = task.locator('.task-drag-handle');
        const targetColumn = this.getColumn(columnLabel);

        const handleBox = await handle.boundingBox();
        if (!handleBox) throw new Error('Task drag handle not visible');

        await this.page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await this.page.mouse.down();
        // Move slightly to trigger drag threshold (POINTER_MOVE_THRESHOLD_PX = 8)
        await this.page.mouse.move(handleBox.x + handleBox.width / 2 + 10, handleBox.y + handleBox.height / 2 + 10);

        const targetBox = await targetColumn.boundingBox();
        if (!targetBox) throw new Error('Target column not visible');

        await this.page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
        await this.page.mouse.up();
        await this.page.waitForLoadState('networkidle');
    }

    async dragTaskToPosition(taskTitle: string, targetTaskTitle: string, position: 'before' | 'after') {
        const task = this.getTaskCard(taskTitle);
        const handle = task.locator('.task-drag-handle');
        const targetTask = this.getTaskCard(targetTaskTitle);

        const handleBox = await handle.boundingBox();
        if (!handleBox) throw new Error('Task drag handle not visible');

        await this.page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await this.page.mouse.down();
        // Move slightly to trigger drag threshold
        await this.page.mouse.move(handleBox.x + handleBox.width / 2 + 10, handleBox.y + handleBox.height / 2 + 10);

        const targetBox = await targetTask.boundingBox();
        if (!targetBox) throw new Error('Target task not visible');

        // Move to target position (before or after)
        const yOffset = position === 'before' ? targetBox.height * 0.25 : targetBox.height * 0.75;
        await this.page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + yOffset);

        await this.page.mouse.up();
        await this.page.waitForLoadState('networkidle');
    }

    async getTaskOrderInColumn(taskTitle: string, columnLabel: string) {
        const column = this.getColumn(columnLabel);
        const cards = column.locator('.task-card');
        const count = await cards.count();
        
        for (let i = 0; i < count; i++) {
            const card = cards.nth(i);
            const text = await card.textContent();
            if (text?.includes(taskTitle)) {
                return i;
            }
        }
        return -1;
    }
}
