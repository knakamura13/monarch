import { defineRailway, github, preserve, project, service } from 'railway/iac';

/**
 * Railway infrastructure for Monarch, as code.
 * See https://docs.railway.com/infrastructure-as-code
 *
 * This replaces railway.json, which Railway stops reading on 2026-12-01.
 *
 * `railway config apply` manages the whole project, so a resource that is
 * missing from this file is planned for deletion. Add new services and
 * databases here instead of in the dashboard. Variable values stay in Railway:
 * `preserve()` keeps whatever is set there.
 *
 * The app is a SvelteKit adapter-node build: `pnpm build` writes `build/` and
 * `node build` starts it. `GET /health` (src/routes/health) reads DynamoDB and
 * answers 503 when that read fails.
 *
 * Not expressible in this file: the generated `*.up.railway.app` domain.
 */
export default defineRailway(() => {
    const monarchApp = service('Monarch App', {
        source: github('knakamura13/monarch', { checkSuites: false, rootDirectory: '/' }),
        build: {
            builder: 'RAILPACK',
            buildCommand: 'pnpm install --frozen-lockfile && pnpm build'
        },
        deploy: {
            startCommand: 'node build',
            healthcheckPath: '/health',
            healthcheckTimeout: 30,
            restartPolicyType: 'ON_FAILURE',
            restartPolicyMaxRetries: 5
        },
        replicas: { 'us-west2': 1 },
        networking: { privateNetworkEndpoint: 'monarch-app' },
        env: {
            APP_URL: preserve(),
            AWS_ACCESS_KEY_ID: preserve(),
            AWS_REGION: preserve(),
            AWS_SECRET_ACCESS_KEY: preserve(),
            BETTER_AUTH_SECRET: preserve(),
            BETTER_AUTH_URL: preserve(),
            DATABASE_URL: preserve(),
            DYNAMO_TABLE: preserve(),
            FIELD_ENCRYPTION_KEY: preserve(),
            NODE_ENV: preserve(),
            RESEND_API_KEY: preserve(),
            S3_ACCESS_KEY_ID: preserve(),
            S3_BUCKET: preserve(),
            S3_FORCE_PATH_STYLE: preserve(),
            S3_REGION: preserve(),
            S3_SECRET_ACCESS_KEY: preserve()
        }
    });

    return project('Monarch', {
        resources: [monarchApp]
    });
});
