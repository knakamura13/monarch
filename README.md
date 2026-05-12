# Monarch

A private, secure dashboard for two people managing a marriage-based immigration process.
Not a legal source of truth. Not affiliated with USCIS or any government agency. No automated submissions.

> "This app is for private organization only. Official government and county websites remain the authoritative source. This app does not provide legal advice."

## What it is

- A login-gated, two-user "control tower" for tracking tasks, evidence, questions, and a phase-based timeline.
- A dashboard with live aggregated widgets derived from your own data.
- An audit log of important changes.

## What it isn't

- A government integration. There is no USCIS, county, or third-party scraping.
- A legal product. It does not give legal advice.
- A public site. There is no anonymous access and no shareable public links.
- A vault for highly sensitive identifiers (SSNs, full A-numbers, passport numbers). Receipt numbers, the one sensitive field most users do enter, are encrypted at rest with AES-256-GCM and displayed masked.

## Stack

- SvelteKit 2 + Svelte 5 (runes) + TypeScript strict, deployed via `@sveltejs/adapter-node`
- Semantic CSS with a calm neutral design system
- DynamoDB (single-table) for primary data
- Better Auth (`better-auth` + `@better-auth/passkey` + built-in TOTP plugin) for email + password + passkeys + 2FA
- Zod v4 for validation everywhere
- Vitest for unit tests, Playwright for integration smoke tests

## Local setup

Prereqs: Node 22, pnpm 10, Docker (for DynamoDB Local).

```bash
# 1. Install dependencies
pnpm install

# 2. Bring up DynamoDB Local
docker compose up -d dynamodb

# 3. Configure environment
cp .env.example .env
# edit BETTER_AUTH_SECRET, FIELD_ENCRYPTION_KEY (32 random base64 bytes each)
#
# If you're using DynamoDB Local, keep DYNAMO_ENDPOINT=http://localhost:8000
# and DYNAMO_TABLE=case-tracker-dev (or any name you prefer).

# 4. Start the dev server
pnpm dev
```

Visit http://localhost:5173. Sign up with an email/password — the first account becomes the workspace owner. Then invite the second user from `Settings → Members`.

### Tests

```bash
pnpm test            # Vitest unit tests
pnpm test:e2e        # Playwright integration tests (needs a running app + DB)
```

The Playwright tests boot the dev server via `pnpm dev` automatically. If you want to point them at an existing deployment, set `E2E_BASE_URL=https://your-deploy.example.com` first.

## Architecture

```
src/
├── hooks.server.ts                  Session loading + Better Auth handler
├── lib/
│   ├── server/
│   │   ├── auth.ts                  Better Auth instance (passkey + 2FA)
│   │   ├── env.ts                   Env validation (Zod)
│   │   ├── crypto.ts                AES-256-GCM helpers + receipt masking
│   │   ├── activity.ts              Audit log writer
│   │   ├── guards.ts                requireUser / requireWorkspace / requireOwner
│   │   └── services/                All domain writes go through these
│   ├── schemas/                     Zod schemas shared client + server
│   ├── components/                  Melt UI + entity views
│   ├── constants/                   Navigation, phases, categories
│   └── utils/                       dates, format, initialFields
└── routes/
    ├── (auth)/                      login, signup, invite, logout
    ├── (app)/                       gated app — sidebar shell + feature areas
    ├── api/                         auth, search, export, post-signup
    ├── health/                      Railway healthcheck
    └── onboarding/                  First-user workspace creation
```

The app uses **session cookies issued and validated by Better Auth**. Every server route under `(app)/` calls `requireWorkspace`, which redirects unauthenticated users to `/login` and unattached users to `/onboarding`. Every domain write goes through a service that calls `logActivity()`, producing an internal audit feed visible at `Settings → Data → Activity`.

Receipt numbers (the only "sensitive" field in the schema) are encrypted at rest and rendered masked.

## Environment variables

| Variable               | Required | Notes                                                                              |
| ---------------------- | -------- | ---------------------------------------------------------------------------------- |
| `APP_URL`              | yes      | Public origin used in emails (e.g. `https://case.example.com`)                     |
| `BETTER_AUTH_URL`      | yes      | Same origin as `APP_URL` in production                                             |
| `BETTER_AUTH_SECRET`   | yes      | 32+ random bytes (base64). Rotate carefully — invalidates sessions.                |
| `FIELD_ENCRYPTION_KEY` | yes      | Base64-encoded 32-byte key for AES-256-GCM. Required to read encrypted fields.     |
| `AWS_REGION`           | no       | Defaults to `us-east-1`                                                            |
| `DYNAMO_TABLE`         | yes\*    | Required in production. Defaults in dev/test.                                      |
| `DYNAMO_ENDPOINT`      | no       | Set to `http://localhost:8000` when using DynamoDB Local                           |
| `PUBLIC_APP_NAME`      | no       | Defaults to "Private Case Tracker"                                                 |
| `ALLOW_OPEN_SIGNUP`    | no       | Default false. Set true to allow signup without an invite (mostly for first boot). |
| `RESEND_API_KEY`       | no       | If unset, invitation emails are logged to the console (good for dev)               |
| `EMAIL_FROM`           | no       | "Sender Name <noreply@example.com>"                                                |
| `PORT` / `HOST`        | no       | Honored by `adapter-node`. Railway injects `PORT` automatically.                   |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Deploying to Railway

The repo includes `railway.json` so the deploy is hands-off:

1. Create a new Railway project from this repo (GitHub auto-deploy).
2. Provision a DynamoDB table + IAM credentials in AWS and set `AWS_REGION` + `DYNAMO_TABLE` in Railway.
3. Set the remaining variables (`APP_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `FIELD_ENCRYPTION_KEY`, optional `RESEND_API_KEY`, `EMAIL_FROM`).
4. Push to `main`. Railway runs:
    - **Build:** `pnpm install --frozen-lockfile && pnpm build`
    - **Release/Start:** `node build`
    - **Healthcheck:** `GET /health`

The first deploy provisions the DynamoDB table automatically. Sign up at `/signup` — the very first account becomes the workspace owner. From `Settings → Members`, invite the second user.

### Why `adapter-node`?

Because Railway runs a long-lived Node container and our auth path expects native Node crypto (`node:crypto` for AES-GCM, Better Auth session signing). The `adapter-node` build is also the simplest path for self-hosted deployments with a healthcheck endpoint.

## Security model

- **Authentication.** Better Auth stores sessions in DynamoDB. Sessions are 7 days, rolling, in HTTP-only secure cookies. Email + password is the primary factor; passkeys (WebAuthn) and TOTP are supported as additional factors. There is **no SMS-only MFA option**.
- **Authorization.** A single workspace per database. Two roles, `OWNER` and `COLLABORATOR`. Owners manage members and can delete the workspace. All domain reads/writes are scoped by `workspaceId`; cross-workspace access is impossible from the API surface.
- **Encryption at rest.** Receipt numbers are AES-256-GCM-encrypted with `FIELD_ENCRYPTION_KEY`. Lose this key and you lose the cleartext for those fields.
- **Audit log.** All important actions (login, logout, status change, invitation accepted, plus all domain CRUD) are recorded in `ActivityLog`, scoped to the workspace.
- **No automated submissions.** This app does not call any government endpoint. It does not screen-scrape, polled-fetch, or impersonate.

## Non-goals (explicit)

- No government integrations or scraping.
- No OCR pipeline.
- No AI legal advice.
- No chatbot.
- No case prediction.
- No public sharing.
- No payments.
- No SMS-only MFA.
- No custom cryptography.
- No overbuilt admin panel.

## License

Private project. Not licensed for redistribution.
