import type { Page, Locator } from '@playwright/test';

export class DialogComponent {
    readonly page: Page;
    readonly container: Locator;
    readonly closeButton: Locator;

    constructor(page: Page) {
        this.page = page;
        // Looking for SvelteKit/Melt UI standard dialogs
        this.container = page.locator('dialog[open]').or(page.getByRole('dialog'));
        this.closeButton = this.container.locator('button:has([data-lucide="x"])').or(this.container.getByRole('button', { name: /close/i }));
    }

    async fillInput(nameOrLabel: string | RegExp, value: string) {
        const input = this.container.getByLabel(nameOrLabel)
            .or(this.container.getByPlaceholder(nameOrLabel))
            .or(this.container.getByRole('textbox', { name: nameOrLabel }))
            .first();
        await input.waitFor({ state: 'visible' });
        await input.fill(value);
        await input.blur(); // Trigger change events
    }

    async submit(buttonName: string | RegExp = /save|create|submit/i) {
        const submitBtn = this.container.getByRole('button', { name: buttonName });
        await submitBtn.click();
    }

    async close() {
        await this.closeButton.click();
    }
    
    async expectVisible() {
        await this.container.waitFor({ state: 'visible' });
    }
    
    async expectHidden() {
        await this.container.waitFor({ state: 'hidden', timeout: 15000 });
    }
}
