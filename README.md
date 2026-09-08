<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shield-alert.svg" width="72" alt="VibeGuard Logo">
  <h1 align="center">VibeGuard</h1>
  <p align="center">
    <strong>Cloud + Security Posture Platform</strong><br>
    <em>Scanning. Analyzing. Protecting.</em>
  </p>
  <p align="center">
    <a href="#7-security-domains"><img src="https://img.shields.io/badge/Security_Domains-7_Assessed-00E599?style=flat-square" alt="Security Domains"></a>
    <a href="#deterministic-risk-scoring"><img src="https://img.shields.io/badge/Scoring-Deterministic_0--100-white?style=flat-square" alt="Scoring"></a>
    <a href="#automated-testing-suite"><img src="https://img.shields.io/badge/Tests-10_Suites_Passing-10B981?style=flat-square" alt="Tests"></a>
    <a href="https://www.npmjs.com/package/@maverick006/vibeguard"><img src="https://img.shields.io/npm/v/@maverick006/vibeguard?color=00E599&style=flat-square" alt="NPM Version"></a>
  </p>
</div>

---

## One Security Score. Your Entire Stack.

**VibeGuard** is an enterprise-grade Cloud and Security Posture platform that orchestrates specialized deterministic security scanners across an application's entire stack—source code, dependencies, secrets, containers, infrastructure-as-code (IaC), web/API attack surface, and cloud infrastructure.

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
   * Source code **always remains local** on the host machine.
   * Only normalized finding metadata (rule ID, severity, file path, line number, deterministic score) is synchronized to VibeGuard Cloud.
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
Scan the current directory with the interactive terminal dashboard completely offline—zero account, zero network calls, zero configuration:
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
* **Isolated Rescan Verification:** AI patches are automatically verified by executing scanner rules against the proposed fix inside an isolated sandbox, confirming `VERIFIED CLEAN` or `FAILED VERIFICATION` before committing code.

---

## Structured AI Remediation & Rescan Verification

When enabled (powered by server-side NVIDIA NIM / Meta Llama 3.1 70B), VibeGuard provides an end-to-end remediation lifecycle:

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
Status Updated: [VERIFIED CLEAN] or [FAILED VERIFICATION]
```

---

## Repository Architecture

The monorepo is structured cleanly with npm workspaces:

```text
VibeGuard/
├── apps/
│   ├── api/                     # Express API (JWT auth, multi-tenant isolation, SQLite/Prisma, NVIDIA NIM)
│   └── web/                     # React + Vite dashboard (AuthContext, ProtectedRoutes, TopoField WebGL)
├── packages/
│   ├── cli/                     # Command-line interface (credentials store, login, logout, scan --sync)
│   ├── security-engine/         # Scanner orchestrator, deduplication, deterministic scoring
│   ├── ai-engine/               # Contextual explainer & patch verifier (NVIDIA NIM)
│   ├── database/                # Prisma schema & migrations (User, RepositoryMember, Scans)
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
* *(Optional)* Scanner binaries on PATH: `semgrep`, `gitleaks`, `trivy`, `checkov`.

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Optional: API URL for CLI and Web
VIBEGUARD_API_URL="http://localhost:3001"
JWT_SECRET="your-secure-jwt-secret"

# Optional: Server-Side AI Remediation (NVIDIA NIM)
NVIDIA_API_KEY="your-nvidia-nim-api-key"
```

### 3. Build & Test
```bash
# Install dependencies
npm ci

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

## Automated Testing Suite

VibeGuard includes 11 automated test suites covering security scoring, tenant isolation, and scanners:

| Package | Scope | Tests |
| :--- | :--- | :---: |
| `@maverick006/api` | Authentication, password hashing, JWTs, multi-tenant cross-user isolation | 8 |
| `@maverick006/vibeguard` (CLI) | 17 UX trust scenarios, credential storage, cloud sync contract | 22 |
| `@maverick006/security-engine` | Deduplication, sequential IDs, mathematical scoring, overrides | 12 |
| `@maverick006/ai-engine` | Explainer formatting, patch verification, guidance fallbacks | 18 |
| `@maverick006/scanner-*` | Output parsers for Semgrep, Gitleaks, Trivy, Checkov, npm-audit, ZAP, Prowler | 14 |
| **Total** | | **69 tests passed** |

---

## License

Apache-2.0 © VibeGuard Authors.

