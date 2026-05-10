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
        const targetColumn = this.getColumn(columnLabel);

        await task.hover();
        await this.page.mouse.down();
        // Move slightly to trigger drag threshold (POINTER_MOVE_THRESHOLD_PX = 8)
        await this.page.mouse.move(0, 10);
        await targetColumn.hover();
        await this.page.mouse.up();
        await this.page.waitForLoadState('networkidle');
    }

    async dragTaskToPosition(taskTitle: string, targetTaskTitle: string, position: 'before' | 'after') {
        const task = this.getTaskCard(taskTitle);
        const targetTask = this.getTaskCard(targetTaskTitle);

        await task.hover();
        await this.page.mouse.down();
        // Move slightly to trigger drag threshold
        await this.page.mouse.move(0, 10);

        const targetBox = await targetTask.boundingBox();
        if (!targetBox) throw new Error('Target task not visible');

        // Move to target position (before or after)
        const yOffset = position === 'before' ? -10 : targetBox.height + 10;
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
