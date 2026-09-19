const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeguard-real-scanners-'));
  try {
    await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'vibeguard-security-fixture', version: '1.0.0', dependencies: { lodash: '4.17.20' } }));
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit'], { cwd: directory, timeout: 120000, stdio: 'pipe', shell: process.platform === 'win32' });
    await fs.writeFile(path.join(directory, 'app.js'), "const express = require('express');\nconst app = express();\napp.get('/run', (req, res) => res.send(eval(req.query.code)));\n");
    await fs.writeFile(path.join(directory, 'config.js'), `const api_key = "${crypto.randomBytes(24).toString('hex')}";\n`);
    await fs.writeFile(path.join(directory, 'Dockerfile'), 'FROM node:22\nUSER root\nCOPY . /app\n');
    await fs.writeFile(path.join(directory, 'main.tf'), 'resource "aws_s3_bucket" "unsafe" {\n  bucket = "vibeguard-deliberately-insecure-fixture"\n}\nresource "aws_s3_bucket_public_access_block" "unsafe" {\n  bucket = aws_s3_bucket.unsafe.id\n  block_public_acls = false\n  block_public_policy = false\n  ignore_public_acls = false\n  restrict_public_buckets = false\n}\n');
    const scanners = [
      new (require('@maverick006/scanner-npm-audit').NpmAuditScanner)(),
      new (require('@maverick006/scanner-gitleaks').GitleaksScanner)(),
      new (require('@maverick006/scanner-semgrep').SemgrepScanner)(),
      new (require('@maverick006/scanner-checkov').CheckovScanner)(),
      new (require('@maverick006/scanner-trivy').TrivyScanner)()
    ];
    for (const scanner of scanners) {
      const result = await scanner.scan({ repositoryPath: directory, scanId: 'real-scanner-gate' });
      console.log(JSON.stringify({ scanner: scanner.name, state: result.state, findings: result.findings.length, durationMs: result.durationMs }));
      assert.equal(result.state, 'SUCCESS', `${scanner.name} did not execute successfully`);
      assert(result.findings.length > 0, `${scanner.name} missed its known unsafe fixture`);
      assert(result.findings.every(finding => finding.ruleId && finding.severity && finding.file), `${scanner.name} lost required normalized fields`);
    }
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
