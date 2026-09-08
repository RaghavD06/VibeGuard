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

    expect(explanation.modelUsed).toBe('meta/llama-3.2-11b-vision-instruct');
    expect(explanation.summary).toBe('This is a mock summary of SQL Injection.');
    expect(explanation.details).toBe('Mock details about how SQLi works.');
    expect(explanation.remediation).toBe('Use parameterized queries.');
    expect(explanation.codeFix).toBe('SELECT * FROM users WHERE id = ?');
    expect(explanation.isAiAssisted).toBe(true);
  });

  it('should correctly mask secrets before sending to AI', () => {
    const explainer = new ContextualExplainer('fake-api-key');
    const rawContext = 'const awsKey = "AKIA1234567890123456"; const token = "super_secret_token"; const db = "postgres://user:pass123@localhost:5432/vibe"; const bearer = "Bearer ya29.a0AfH6SM..."; const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI.eyJzdWIiOiIxMjM0NTY3ODkwIiw.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";';
    const masked = explainer.maskSecrets(rawContext);
    
    expect(masked).not.toContain('AKIA1234567890123456');
    expect(masked).toContain('[MASKED_SECRET]');
    expect(masked).not.toContain('super_secret_token');
    expect(masked).toContain('[MASKED_DATABASE_URL]');
    expect(masked).not.toContain('pass123');
    expect(masked).toContain('[MASKED_BEARER_TOKEN]');
    expect(masked).toContain('[MASKED_JWT]');
    expect(masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI.eyJzdWIiOiIxMjM0NTY3ODkwIiw.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  });
});
