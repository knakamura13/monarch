import { defineConfig, devices } from '@playwright/test';

process.env.DYNAMO_TABLE = 'case-tracker-e2e';
process.env.NODE_ENV = 'test';

export default defineConfig({
    testDir: 'tests/e2e/specs',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 2 : 0,
    timeout: 30_000,
    globalSetup: './tests/e2e/global.setup.ts',
    globalTeardown: './tests/e2e/global.teardown.ts',
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'pnpm dev --port 5174',
        url: 'http://localhost:5174',
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
            DYNAMO_TABLE: 'case-tracker-e2e',
            DYNAMO_ENDPOINT: 'http://localhost:8000',
            NODE_ENV: 'test',
            DEV_USER_ID: 'test_user',
            DEV_MODE: 'unsafe',
            BETTER_AUTH_URL: 'http://localhost:5174',
            BETTER_AUTH_TRUST_HOST: 'true'
        }
    },
    projects: [
        { name: 'chromium', use: devices['Desktop Chrome'] },
        { name: 'Mobile Chrome', use: devices['Pixel 5'] }
    ]
});
