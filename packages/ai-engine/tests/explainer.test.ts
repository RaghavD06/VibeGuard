import { ContextualExplainer } from '../src/explainer';
import { NormalizedFinding, Severity, Confidence } from '@maverick006/types';

// Mock the OpenAI module
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "This is a mock summary of SQL Injection.",
                    details: "Mock details about how SQLi works.",
                    remediation: "Use parameterized queries.",
                    codeFix: "SELECT * FROM users WHERE id = ?"
                  })
                }
              }
            ]
          })
        }
      }
    };
  });
});

describe('ContextualExplainer', () => {
  const mockFinding: NormalizedFinding = {
    scanId: 'scan-1',
    scanner: 'test-scanner',
    scannerVersion: '1.0',
    ruleId: 'sqli',
    title: 'SQL Injection',
    description: 'Found SQLi',
    severity: Severity.HIGH,
    confidence: Confidence.HIGH,
    category: 'sast',
    file: 'db.ts',
    line: 10
  };

  it('should return a deterministic fallback explanation if no API key is provided', async () => {
    // Delete env var if it exists for test
    const oldEnv = process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_API_KEY;

    const explainer = new ContextualExplainer();
    const explanation = await explainer.explainFinding(mockFinding);

    expect(explanation.modelUsed).toBe('deterministic-rules');
    expect(explanation.isAiAssisted).toBe(false);
    expect(explanation.summary).toBe('SQL Injection');

    // Restore env var
    process.env.NVIDIA_API_KEY = oldEnv;
  });

  it('should call the generative AI and parse the response correctly', async () => {
    const explainer = new ContextualExplainer('fake-api-key');
    const explanation = await explainer.explainFinding(mockFinding, {
      codeContext: 'const query = "SELECT * FROM users WHERE id = " + req.query.id;'
    });

    expect(explanation.modelUsed).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(explanation.summary).toBe('This is a mock summary of SQL Injection.');
    expect(explanation.details).toBe('Mock details about how SQLi works.');
    expect(explanation.remediation).toBe('Use parameterized queries.');
    expect(explanation.codeFix).toBe('SELECT * FROM users WHERE id = ?');
    expect(explanation.isAiAssisted).toBe(true);
  });

  it('should correctly mask secrets before sending to AI', () => {
    const explainer = new ContextualExplainer('fake-api-key');
    const fakeJwt = [
      'eyJhbGciOiJIUzI1NiJ9',
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    ].join('.');
    const fakeAwsKey = ['AKIA123456', '7890123456'].join('');
    const fakeToken = ['super', 'secret', 'token'].join('_');
    const fakeBearer = ['ya29', 'a0AfH6SM...'].join('.');
    const rawContext = `const awsKey = "${fakeAwsKey}"; const token = "${fakeToken}"; const db = "postgres://user:pass123@localhost:5432/vibe"; const bearer = "Bearer ${fakeBearer}"; const jwt = "${fakeJwt}";`;
    const masked = explainer.maskSecrets(rawContext);
    
    expect(masked).not.toContain(fakeAwsKey);
    expect(masked).toContain('[MASKED_SECRET]');
    expect(masked).not.toContain(fakeToken);
    expect(masked).toContain('[MASKED_DATABASE_URL]');
    expect(masked).not.toContain('pass123');
    expect(masked).toContain('[MASKED_BEARER_TOKEN]');
    expect(masked).toContain('[MASKED_JWT]');
    expect(masked).not.toContain(fakeJwt);
  });

  it('rejects a structured patch object instead of presenting it as verified code', async () => {
    const OpenAI = require('openai');
    OpenAI.mockImplementationOnce(() => ({
      chat: { completions: { create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          summary: 'An issue', details: 'Risk', remediation: 'Update the dependency',
          codeFix: { before: 'old', after: 'new' }
        }) } }]
      }) } }
    }));
    const explainer = new ContextualExplainer('test-only-key');
    const result = await explainer.explainFinding(mockFinding);
    expect(result.isAiAssisted).toBe(false);
    expect(result.codeFix).toBeUndefined();
    expect(result.verificationStatus).toBe('NOT_APPLIED');
  });
});
