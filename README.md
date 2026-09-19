<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shield-alert.svg" width="72" alt="VibeGuard Logo">
  <h1 align="center">VibeGuard</h1>
  <p align="center">
    <strong>Cloud + Security Posture Platform</strong><br>
    <em>Scanning. Analyzing. Protecting.</em>
  </p>
  <p align="center">
    <a href="#7-security-domains"><img src="https://img.shields.io/badge/Security_Domains-7_Integrated-00E599?style=flat-square" alt="Security Domains"></a>
    <a href="#deterministic-risk-scoring"><img src="https://img.shields.io/badge/Scoring-Deterministic_0--100-white?style=flat-square" alt="Scoring"></a>
    <a href="#automated-testing-suite"><img src="https://img.shields.io/badge/Tests-Run_Locally-10B981?style=flat-square" alt="Tests"></a>
    <a href="https://www.npmjs.com/package/@maverick006/vibeguard"><img src="https://img.shields.io/npm/v/@maverick006/vibeguard?color=00E599&style=flat-square" alt="NPM Version"></a>
  </p>
</div>

---

## One Security Score. Your Entire Stack.

**VibeGuard** orchestrates deterministic security scanners across source code, dependencies, secrets, containers, infrastructure-as-code (IaC), web/API attack surface, and cloud infrastructure. Coverage depends on installed scanner binaries and configured targets.

Findings are normalized into a unified schema, deduplicated with canonical identifiers (`VG-FIND-xxx`), evaluated through a transparent mathematical scoring model, and paired with optional AI-assisted remediation.

```text
Repository & Infrastructure
            ↓
  Security Orchestrator (Parallel Execution)
            ↓
  7 Security Domains:
  [Code] [Dependencies] [Secrets] [Containers] [IaC] [Web/API] [Cloud]
            ↓
  Normalize to Unified SARIF Schema
            ↓
  Cross-Scanner Deduplication (VG-FIND-001, ...)
            ↓
  Deterministic Scoring Engine (Base 100 - Severity Deductions)
            ↓
  ┌─────────────────────────────────────────────────────────┐
  │  Unified Security Posture Score (0-100 · Grade A-F)     │
  └─────────────────────────────────────────────────────────┘
            ↓ (Optional)
  Advisory AI Remediation (Contextual Explanations & Patches)
```

---

## 7 Security Domains

VibeGuard evaluates posture across 7 critical architectural tiers:

| Domain | Integrated Scanner | Target Inspected | Primary Rulesets |
| :--- | :--- | :--- | :--- |
| **Code (SAST)** | [Semgrep](https://semgrep.dev/) | Application source code | OWASP Top 10, CWE-89, CWE-79, logic flaws |
| **Dependencies** | [npm-audit](https://docs.npmjs.com/cli/commands/npm-audit) / [Trivy](https://aquasecurity.github.io/trivy/) | Package lockfiles & manifests | Known CVEs, GHSA advisories |
| **Secrets** | [Gitleaks](https://github.com/gitleaks/gitleaks) | Git history & working tree | API tokens, private keys, AWS/cloud credentials |
| **Containers** | [Trivy](https://aquasecurity.github.io/trivy/) | Dockerfiles & base images | OS package vulnerabilities, misconfigurations |
| **IaC** | [Checkov](https://www.checkov.io/) | Terraform, CloudFormation, K8s | Security misconfigurations, unencrypted storage |
| **Web / APIs** | [OWASP ZAP](https://www.zaproxy.org/) | Live endpoints & web surfaces | XSS, injection, missing headers, TLS issues |
| **Cloud (CSPM)** | [Prowler](https://github.com/prowler-cloud/prowler) | AWS / Cloud accounts | CIS benchmarks, IAM over-privileging, exposed buckets |

---

## Truth-in-Security Principles

Unlike tools that mask missing scanners or claim uninstalled tools "passed", VibeGuard enforces strict transparency:

1. **Honest Posture Representation:**
   * If all 7 domains run: `COMPLETE POSTURE (7 / 7 security domains assessed)`.
   * If partial scanners run: `PARTIAL POSTURE (X / 7 security domains assessed)`.
2. **Standardized Scanner States:**
   * `✓ SUCCESS` — Scanner executed and produced findings.
   * `○ NOT INSTALLED` — Binary missing from system `PATH`.
   * `— NOT APPLICABLE` — Scanner not relevant to target repository (e.g., ZAP skipped with no web URL, Prowler skipped with no cloud credentials).
   * `⚠ SKIPPED` — Explicitly skipped by configuration.
   * `✗ FAILED` — Execution error with diagnostics.
   * `⏱ TIMEOUT` — Scanner exceeded duration limit.
3. **Local Privacy Guarantee:**
   * Local scans do not upload to VibeGuard Cloud unless `--sync` is requested. Scanner tools may contact their own advisory services.
   * `--sync` sends normalized findings, including description, remediation, and any code snippets or secret evidence present in scanner results. Review data before enabling sync.
   * Built-in secret redaction automatically sanitizes API keys, tokens, and private keys from terminal and JSON output.

---

## Deterministic Risk Scoring

VibeGuard uses pure, reproducible mathematics to calculate security posture:

```text
Base Score: 100 / 100

Deductions:
  - Critical Finding:  -30 points
  - High Finding:      -10 points
  - Medium Finding:    -3 points
  - Low Finding:       -1 point

Final Score = clamp(100 - Total Deductions, 0, 100)
```

### Grade Thresholds & Critical Override
* **Grade A:** 90 – 100
* **Grade B:** 80 – 89
* **Grade C:** 70 – 79
* **Grade D:** 50 – 69
* **Grade F:** 0 – 49
* **Critical Finding Rule:** If **any** Critical vulnerability is detected, the grade is immediately capped at **F** (score capped at `≤ 49`), regardless of other passing domains.

---

## CLI Usage & Cloud Modes

### 1. Local Offline Mode (Zero Setup, 100% Private)
Scan the current directory without a VibeGuard account or cloud upload. `npm audit` contacts the npm advisory registry when a lockfile is present; optional AI calls require `--fix` and an API key:
```bash
vibeguard scan .
```

### 2. Cloud Authentication & Profile Management
Connect the CLI to VibeGuard Cloud to enable multi-tenant repository synchronization:
```bash
# Log in to VibeGuard Cloud (prompts for email & password or use flags)
vibeguard login --email user@example.com --password mysecretpass

# Check active session and connected API URL
vibeguard auth status

# Log out and wipe local credential tokens
vibeguard logout
```
*Credentials are safely stored in `~/.vibeguard/credentials.json` with restricted file permissions.*

### 3. Cloud Synchronization (`--sync`)
Run a local scan and stream normalized finding telemetry to your authenticated VibeGuard Cloud account:
```bash
vibeguard scan . --sync
```
*If unauthenticated, `--sync` cleanly halts cloud transmission: `❌ Authentication required for cloud sync. Run 'vibeguard login' to authenticate.`*

### 4. Automation & CI/CD Mode (`--ci`)
Minimalist, automation-friendly output designed for GitHub Actions, GitLab CI, and Jenkins:
```bash
vibeguard scan . --ci --fail-on high
```
* Exits `0` if policy passes.
* Exits `1` if findings meet or exceed `--fail-on` threshold (`critical`, `high`, `medium`, `low`).
* Exits `2` on execution error.

### 5. Pure JSON Output (`--json`)
Emits machine-readable JSON without ANSI escape sequences:
```bash
vibeguard scan . --json > scan-results.json
```

### 6. Diagnostic Verbose Telemetry (`--verbose`)
Displays exact execution time in milliseconds and actionable installation commands for missing scanner binaries:
```bash
vibeguard scan . --verbose
```

---

## Multi-Tenant Authorization & Architecture

VibeGuard enforces strict server-side tenant isolation:

* **Zero Cross-Tenant Leakage:** User A can **never** view or access User B's repositories, scans, findings, or AI remediation requests. Direct access to unauthorized resources returns `404 Not Found` or `403 Forbidden`.
* **Repository Role Model:** Scopes repository ownership and membership (`OWNER`, `MEMBER`).
* **Server-Side AI Privacy:** The NVIDIA NIM API key remains strictly server-side. Source code stays local—only normalized finding metadata and bounded, redacted contexts are analyzed.
* **Isolated Proposal Check:** The verifier reproduces a finding against supplied original content and rescans a proposed replacement in a temporary directory. A passing proposal does not alter the repository or mark a stored finding verified; apply it and run a full repository scan.

---

## Structured AI Remediation & Rescan Verification

When configured, server-side NVIDIA NIM can propose advisory remediation. The current default model is `meta/llama-3.2-11b-vision-instruct`; a deterministic rescan must assess any proposed patch:

```text
Dashboard / API
      ↓
Authorization Check (Tenant Membership)
      ↓
Bounded Redacted Context Extraction
      ↓
NVIDIA NIM Security Model (Server-Side)
      ↓
Structured Remediation (Issue, Impact, Recommended Fix, Code Patch)
      ↓
Human Review & Rescan Verification Request
      ↓
Isolated Rescan Verifier (Semgrep / Gitleaks / Trivy / Checkov / npm-audit)
      ↓
Proposal result: [VERIFIED IN ISOLATION] or [FAILED / NOT VERIFIED]
```

---

## Repository Architecture

The monorepo is structured cleanly with npm workspaces:

```text
VibeGuard/
├── apps/
│   ├── api/                     # Express API (JWT auth, PostgreSQL/Prisma, NVIDIA NIM)
│   └── web/                     # React + Vite dashboard (AuthContext, ProtectedRoutes, TopoField WebGL)
├── packages/
│   ├── cli/                     # Command-line interface (credentials store, login, logout, scan --sync)
│   ├── security-engine/         # Scanner orchestrator, deduplication, deterministic scoring
│   ├── ai-engine/               # Contextual explainer & patch verifier (NVIDIA NIM)
│   ├── database/                # Private workspace helper; active schema/migrations live in apps/api/prisma
│   └── types/                   # Shared TypeScript interfaces (SARIF models, scores, auth types)
└── scanners/
    ├── semgrep/                 # Code SAST adapter
    ├── gitleaks/                # Secrets detection adapter
    ├── npm-audit/               # JavaScript dependency adapter
    ├── trivy/                   # Container & filesystem adapter
    ├── checkov/                 # Infrastructure-as-Code adapter
    ├── zap/                     # Dynamic web vulnerability adapter
    └── aws-cspm/                # Cloud Security Posture (Prowler) adapter
```

---

## Getting Started Locally

### 1. Prerequisites
* **Node.js:** v20+
* **npm:** v10+
* **PostgreSQL:** local server or `docker compose up`; scanner binaries on PATH for the domains you assess (`semgrep`, `gitleaks`, `trivy`, `checkov`). ZAP and Prowler require configured targets or cloud credentials.

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Optional: API URL for CLI and Web
VIBEGUARD_API_URL="http://localhost:3001"
JWT_SECRET="your-secure-jwt-secret"

# Optional: Server-Side AI Remediation (NVIDIA NIM)
NVIDIA_API_KEY="your-nvidia-nim-api-key"

# PostgreSQL; use a distinct test database for TEST_DATABASE_URL
DATABASE_URL="postgresql://user:password@localhost:5432/vibeguard?schema=public"
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/vibeguard_test"
```

### 3. Build & Test
```bash
# Install dependencies
npm ci

# Apply checked-in PostgreSQL migrations (never use db push in production)
npm run db:migrate --workspace=apps/api

# Build all packages & apps
npm run build

# Run monorepo test suites
npm test
```

### 4. Running the Dashboard & API
```bash
# Starts API on http://localhost:3001 and Web Dashboard on http://localhost:5173
npm run dev
```

---

The API test suite requires `TEST_DATABASE_URL`; it creates a random schema per run. Do not point it at development or production data. Docker Compose requires `POSTGRES_PASSWORD` and `JWT_SECRET` in the local environment and persists PostgreSQL data in a named volume. Render's Blueprint provisions a managed PostgreSQL database; existing SQLite deployments need an explicit data migration before switching. The CLI adapter packages install through npm, but Semgrep, Gitleaks, Trivy, Checkov, ZAP, and Prowler also need their own executables or services. Missing applicable scanners produce a partial/failed policy result.

See [production operations and release steps](docs/production-operations.md) for database, scanner, CI, and npm instructions.

## Automated Testing Suite

VibeGuard includes 11 automated test suites covering security scoring, tenant isolation, and scanners:

| Package | Scope | Tests |
| :--- | :--- | :---: |
| `@maverick006/api` | Authentication, PostgreSQL persistence, JWT revocation, tenant isolation | 15 |
| `@maverick006/vibeguard` (CLI) | 17 UX trust scenarios, credential storage, cloud sync contract | 22 |
| `@maverick006/security-engine` | Deduplication, sequential IDs, mathematical scoring, overrides | 13 |
| `@maverick006/ai-engine` | Explainer formatting, patch verification, guidance fallbacks | 27 |
| `@maverick006/scanner-*` | Output parsers for Semgrep, Gitleaks, Trivy, Checkov, npm-audit, ZAP, Prowler | 14 |
| **Total** | | **91 tests passing locally with PostgreSQL** |

---

## License

Apache-2.0 © VibeGuard Authors.
