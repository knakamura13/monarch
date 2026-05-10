import type { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly signInButton: Locator;

    constructor(page: Page) {
        super(page);
        this.emailInput = page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'));
        this.passwordInput = page.getByLabel(/password/i).or(page.locator('input[type="password"]'));
        this.signInButton = page.getByRole('button', { name: 'Sign in', exact: true }).or(page.getByRole('button', { name: 'Log in', exact: true }));
    }

    async login(email: string, password: string) {
        await this.goto('/login');
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.signInButton.click();
        await this.page.waitForURL('**/dashboard');
    }
}
