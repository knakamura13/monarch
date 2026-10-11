# Architecture Decision Record — monarch-case-tracker (Monarch)

Baseline captured 2026-05-11 from full-index pass (1,047 nodes / 1,903 edges).

## 1. Context

Monarch is a private, two-user "control tower" for managing a marriage-based US immigration process — task tracking, evidence storage, questions, audit log, and a phase-based timeline. It is **not** a USCIS integration, not a legal product, and not public. Explicit non-goals: no SSNs / A-numbers / passport numbers; only receipt numbers (encrypted at rest, masked in UI).

## 2. Stack

- **SvelteKit 2** + **Svelte 5 (runes)** — full-stack framework
- **TypeScript strict**
- **`@sveltejs/adapter-node`** — deployed to **Railway** (`.railway/railway.ts` present) via Node SSR
- **DynamoDB** (single-table design) — primary data store, **`@aws-sdk/client-dynamodb` + `lib-dynamodb`**
- **S3** — file/evidence storage via **`@aws-sdk/client-s3`** + presigned URLs
- **Better Auth** — email + password + passkeys + TOTP 2FA (`better-auth`, `@better-auth/passkey`, built-in TOTP)
- **Argon2** (`@node-rs/argon2`) — password hashing
- **AES-256-GCM** — encryption at rest for receipt numbers
- **Zod v4** — validation everywhere
- **OpenTelemetry** (`@opentelemetry/api`) — observability
- **Melt UI** (`@melt-ui/svelte`) — headless components
- **dnd-kit** — drag/drop
- **svelte-sonner** — toast notifications
- **date-fns**
- **Vite PWA** (`@vite-pwa/sveltekit`)

## 3. Quality / Testing

- **Vitest** — unit tests
- **Vitest component config** (`vitest.component.config.ts`) — component tests with `@testing-library/svelte`
- **Playwright** — E2E smoke tests
- **axe-core/playwright** — a11y testing in E2E
- **ESLint** + `eslint-plugin-security` + `eslint-plugin-svelte` + Prettier
- `svelte-check` for type validation

## 4. Layout

- **src/** (SvelteKit standard) — routes, lib, server code
- **scripts/** — TS utilities (`purge-old-users.ts`, `create-table.ts`, `find-undefined-classes.ts`); run via `tsx`
- **infra/** — infrastructure config
- **settings/** — settings/config assets
- **build/** — adapter-node output
- **.svelte-kit/** — generated
- **docker-compose.yml** — DynamoDB Local for dev
- **playwright.config.ts**, **eslint.config.js**, **.railway/railway.ts**

## 5. Conventions

- **Package manager: pnpm 10** (per `pnpm-lock.yaml`, Node 22)
- **Project type**: `"type": "module"` (ESM throughout)
- **Runes mode**: Svelte 5 runes for state (not legacy stores by default)
- **Single-table DynamoDB** — partition/sort key patterns; data modeling lives in the access layer, not normalized tables
- **Semantic CSS** with calm neutral design system (per README) — no Tailwind by default
- **Defense-in-depth secrets posture**: sensitive PII (SSN, A-#, passport) is *out of scope*, not just protected
- Generated code (`.svelte-kit/`, `build/`) is gitignored

## 6. Auth Model

- Two-user app, login-gated; no anonymous access, no public sharing
- Better Auth handles sessions; passkey + TOTP are first-class
- Audit log records important changes — implies append-only event records in DynamoDB

## 7. Deployment

- `.railway/railway.ts` → Railway hosting
- `docker-compose.yml` provides DynamoDB Local for development
- Adapter-node SSR; build output in `build/`

## 8. Graph Stats Snapshot (2026-05-11)

- Nodes: 1,047 (Functions 209 / Files 205 / Modules 205 / Variables 187 / Types 77 / Interfaces 10 / Methods 27 / Classes 8 / Routes 1)
- Edges: 1,903 (DEFINES 749 / CALLS 584 / CONTAINS_FILE 205 / SEMANTICALLY_RELATED 94 / FILE_CHANGES_WITH 84 / IMPORTS 28 / HTTP_CALLS 2)
- Index mode: full
- Code shape: **functional + module-oriented TS**, very few classes (8) — consistent with idiomatic SvelteKit + access-layer modules

## 9. Notable Constraints

- **Not a legal source of truth.** Official government and county websites remain authoritative.
- **No automated submissions** to any government system.
- **No third-party scraping** of USCIS/county data.
- All sensitive at-rest data uses AES-256-GCM; everything user-facing for receipt numbers is masked.
