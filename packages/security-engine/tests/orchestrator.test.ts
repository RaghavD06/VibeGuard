import { Orchestrator } from '../src/orchestrator';
import { SecurityScanner } from '../src/scanner';
import { ScanInput, ScannerResult, ScannerState, Severity } from '@maverick006/types';

describe('Security Orchestrator with Bounded Concurrency', () => {
  const mockInput: ScanInput = {
    scanId: 'test-scan-123',
    repositoryPath: '/mock/repo'
  };

  it('should execute scanners with bounded concurrency and aggregate findings', async () => {
    let runningCount = 0;
    let maxConcurrent = 0;

    const createMockScanner = (name: string, delayMs: number): SecurityScanner => ({
      name,
      scan: async (input: ScanInput): Promise<ScannerResult> => {
        runningCount++;
        maxConcurrent = Math.max(maxConcurrent, runningCount);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        runningCount--;

        return {
          scanner: name,
          success: true,
          state: ScannerState.SUCCESS,
          findings: [
            {
              scanner: name,
              ruleId: `${name}-rule`,
              title: `${name} finding`,
              description: 'sample',
              severity: Severity.LOW,
              file: `${name}.ts`,
              line: 1
            }
          ],
          startTime: new Date(),
          endTime: new Date()
        };
      }
    });

    const scanners: SecurityScanner[] = [
      createMockScanner('Semgrep', 30),
      createMockScanner('Gitleaks', 30),
      createMockScanner('Trivy', 30),
      createMockScanner('npm-audit', 30),
      createMockScanner('Checkov', 30)
    ];

    const orchestrator = new Orchestrator(scanners, { concurrencyLimit: 2 });
    const result = await orchestrator.runScan(mockInput);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(result.scannerResults).toHaveLength(5);
    expect(result.findings).toHaveLength(5);
    expect(result.coverage.code).toBe(true);
    expect(result.coverage.secrets).toBe(true);
  });

  it('should handle timeout gracefully without crashing the whole scan', async () => {
    const normalScanner: SecurityScanner = {
      name: 'Semgrep',
      scan: async () => ({
        scanner: 'Semgrep',
        success: true,
        state: ScannerState.SUCCESS,
        findings: [],
        startTime: new Date(),
        endTime: new Date()
      })
    };

    const slowScanner: SecurityScanner = {
      name: 'SlowScanner',
      scan: async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
          scanner: 'SlowScanner',
          success: true,
          findings: [],
          startTime: new Date(),
          endTime: new Date()
        };
      }
    };

    const orchestrator = new Orchestrator([normalScanner, slowScanner], { timeoutMs: 50 });
    const result = await orchestrator.runScan(mockInput);

    expect(result.scannerResults).toHaveLength(2);
    const slowResult = result.scannerResults.find(r => r.scanner === 'SlowScanner');
    expect(slowResult?.state).toBe(ScannerState.TIMEOUT);
    expect(slowResult?.success).toBe(false);

    const normalResult = result.scannerResults.find(r => r.scanner === 'Semgrep');
    expect(normalResult?.state).toBe(ScannerState.SUCCESS);
  });

  it('should detect when scanner capability detects repo is not applicable and return SKIPPED', async () => {
    const iacScanner: SecurityScanner = {
      name: 'Checkov',
      capabilities: {
        category: 'iac',
        detectApplicability: async () => false // No IaC files
      },
      scan: async () => {
        throw new Error('Should not be called when detectApplicability returns false');
      }
    };

    const orchestrator = new Orchestrator([iacScanner]);
    const result = await orchestrator.runScan(mockInput);

    expect(result.scannerResults).toHaveLength(1);
    expect(result.scannerResults[0].state).toBe(ScannerState.SKIPPED);
    expect(result.scannerResults[0].findings).toHaveLength(0);
  });
});
