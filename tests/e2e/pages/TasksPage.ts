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
}
