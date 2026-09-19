const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { GitleaksScanner } = require('@maverick006/scanner-gitleaks');
const { ContextualExplainer, RescanVerifier } = require('@maverick006/ai-engine');

(async () => {
  assert(process.env.NVIDIA_API_KEY, 'NVIDIA_API_KEY must be explicitly configured for the live gate');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeguard-live-ai-'));
  try {
    // Deliberately generated test value, not a credential for any external account.
    const original = `const api_key = "${crypto.randomBytes(24).toString('hex')}";\nmodule.exports = { api_key };\n`;
    await fs.writeFile(path.join(directory, 'config.js'), original);
    const scanner = new GitleaksScanner();
    const baseline = await scanner.scan({ repositoryPath: directory, scanId: 'live-ai-baseline' });
    assert.equal(baseline.state, 'SUCCESS');
    assert(baseline.findings.length > 0, 'Gitleaks must reproduce the real baseline');
    const finding = baseline.findings[0];
    const explanation = await new ContextualExplainer().explainFinding(finding, { codeContext: original });
    assert(explanation.isAiAssisted && explanation.codeFix, 'NIM must return a valid remediation, not fallback guidance');
    const verifier = new RescanVerifier();
    const effective = await verifier.verifyPatch({ finding, codeFix: explanation.codeFix, originalFileContent: original, scanner, filePath: 'config.js' });
    const ineffective = await verifier.verifyPatch({ finding, codeFix: original, originalFileContent: original, scanner, filePath: 'config.js' });
    assert.equal(effective.status, 'VERIFIED');
    assert.equal(ineffective.status, 'FAILED_VERIFICATION');
    console.log(JSON.stringify({ provider: 'NVIDIA NIM', model: explanation.modelUsed, realBaselineFindings: baseline.findings.length, validAiPatch: true, effective: effective.status, ineffective: ineffective.status, scope: 'isolated proposal; no stored finding changed' }));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
