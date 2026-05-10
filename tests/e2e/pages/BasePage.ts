import type { Page } from '@playwright/test';

export class BasePage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto(path: string) {
        await this.page.goto(path);
        await this.page.waitForLoadState('networkidle');
    }

    async waitForToast(message: string) {
        await this.page.getByText(message, { exact: false }).waitFor({ state: 'visible' });
    }
    
    async reload() {
        await this.page.reload();
        await this.page.waitForLoadState('networkidle');
    }
}
