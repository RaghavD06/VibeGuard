# VibeGuard operations and release checklist

The active data model and checked-in migrations are in `apps/api/prisma`. `packages/database` is a private helper workspace and has no independent schema. Back up existing SQLite data before migrating an old deployment: switching `DATABASE_URL` does **not** copy users, repositories, scans, or findings. A new PostgreSQL database starts empty.

## Local PostgreSQL

Set `POSTGRES_PASSWORD` and `JWT_SECRET` to generated values in a local `.env` file (never commit it). URL-encode reserved password characters in PostgreSQL URLs. Run `docker compose up --build`; Compose starts PostgreSQL with a persistent named volume, waits for it to accept connections, runs `prisma migrate deploy`, and starts the API and web app. `/health` reports process liveness; `/ready` queries PostgreSQL and returns 503 if it is unavailable. Stop the database and check `/ready` to test reconnection.

Without Docker, create separate `vibeguard` and `vibeguard_test` databases in PostgreSQL. Set `DATABASE_URL` and `TEST_DATABASE_URL` to their respective URLs. Run `npm ci`, `npm run db:migrate --workspace=apps/api`, `npm run build`, and `npm test`. The API suite changes `TEST_DATABASE_URL` to a fresh random PostgreSQL schema on every run. Do not point either variable at a production database. The random test schemas can be removed by a database administrator after the run; the test runner never drops application data.

Render's Blueprint declares a managed PostgreSQL instance and injects its internal connection string. `JWT_SECRET` and `CORS_ORIGIN` must be set securely in Render; configure `NVIDIA_API_KEY` there only when AI remediation is wanted. `prisma migrate deploy` applies checked-in migrations on startup. The Blueprint has not been deployed from this checkout. Existing SQLite data requires a deliberate export/import migration and validation before traffic is moved.

## Scanner installation and coverage

The seven npm adapters are local workspaces. They normalize output; they do not bundle the third-party executables. Install [Semgrep](https://semgrep.dev/docs/getting-started/quickstart), [Gitleaks](https://github.com/gitleaks/gitleaks#installing), [Trivy](https://www.trivy.dev/docs/latest/getting-started/installation/), and [Checkov](https://www.checkov.io/2.Basics/Installing%20Checkov.html) for code, secret, dependency/container, and IaC coverage. npm-audit requires npm and a lockfile and contacts npm's advisory service. ZAP requires a live web target; Prowler requires cloud credentials. Verify executables on PATH with their `--version` commands. A missing applicable executable gives a nonzero CI scan result and partial coverage. The normal `scan` command does not upload to VibeGuard Cloud unless `--sync` is passed, but scanner tools may use their own networks.

CI installs the four applicable scanner executables, builds, type-checks, runs the PostgreSQL-backed tests, audits production dependencies, validates the CLI package, and executes the CLI policy. The workflow still needs an actual GitHub Actions run before its outcome can be claimed.

## npm release

Publishing needs an authenticated npm account with permission to the `@maverick006` scope and any required two-factor code. Do not run a blanket `npm publish --workspaces`: the API, web, and database workspaces are private and the public packages depend on one another. From a clean checkout, run `npm ci`, `npm run build`, `npm test`, then publish in this order, waiting for registry visibility after each layer:

1. `npm publish --workspace=@maverick006/types --access public`
2. `npm publish --workspace=@maverick006/security-engine --access public` and `npm publish --workspace=@maverick006/ai-engine --access public`
3. `npm publish --workspace=@maverick006/scanner-semgrep --access public`, and likewise `scanner-gitleaks`, `scanner-npm-audit`, `scanner-trivy`, `scanner-checkov`, `scanner-zap`, `scanner-aws-cspm`
4. `npm publish --workspace=@maverick006/vibeguard --access public`

All `@maverick006` dependency ranges must resolve to the newly published versions. Validate each tarball with `npm pack --workspace=<name> --dry-run`; then test `npx --yes @maverick006/vibeguard@latest scan <fixture> --json` in a clean directory and check both the resulting JSON and exit code. npm authentication is unavailable in this local environment, so these versions have **not** been published or verified through `npx @latest`.

The currently published CLI tarball is version 1.0.14 but its bundled executable reports 1.0.12 because that release contains stale compiled output. The local 1.0.15 build reports its package version correctly. Check both the registry metadata and `vibeguard --version` from an unpacked or freshly installed tarball before promoting a release.
