import { NormalizedFinding, ScanInput, ScannerResult, ScannerState, ScannerCoverage } from '@maverick006/types';
import { SecurityScanner } from './scanner';
import { deduplicateFindings } from './deduplication';

export interface OrchestratorOptions {
  concurrencyLimit?: number; // default: 3
  timeoutMs?: number;        // default: 120,000ms (2 mins per scanner)
}

export interface OrchestratedScanResult extends ScannerResult {
  scannerResults: ScannerResult[];
  coverage: ScannerCoverage;
}

/**
 * Runs tasks with a bounded concurrency pool (no unlimited Promise.all).
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Wraps a promise with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, scannerName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Scanner ${scannerName} timed out after ${timeoutMs}ms`);
      (err as any).code = 'ETIMEDOUT';
      reject(err);
    }, timeoutMs);

    promise
      .then(val => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Orchestrates the execution of multiple security scanners and aggregates/deduplicates their findings.
 */
export class Orchestrator {
  private scanners: SecurityScanner[] = [];
  private options: OrchestratorOptions;

  constructor(scanners: SecurityScanner[], options: OrchestratorOptions = {}) {
    this.scanners = scanners;
    this.options = {
      concurrencyLimit: options.concurrencyLimit ?? 3,
      timeoutMs: options.timeoutMs ?? 120_000
    };
  }

  /**
   * Executes registered scanners using a bounded concurrency pool.
   */
  async runScan(input: ScanInput): Promise<OrchestratedScanResult> {
    const startTime = new Date();
    const concurrency = this.options.concurrencyLimit ?? 3;
    const timeout = this.options.timeoutMs ?? 120_000;

    const executeScanner = async (scanner: SecurityScanner): Promise<ScannerResult> => {
      const scanStart = new Date();

      // Check applicability if scanner provides capability detection
      if (scanner.capabilities?.detectApplicability) {
        try {
          const isApplicable = await scanner.capabilities.detectApplicability(input.repositoryPath, input);
          if (!isApplicable) {
            const scanEnd = new Date();
            return {
              scanner: scanner.name,
              success: true,
              state: ScannerState.SKIPPED,
              reason: `Skipped: Not applicable to repository or target`,
              findings: [],
              startTime: scanStart,
              endTime: scanEnd,
              durationMs: scanEnd.getTime() - scanStart.getTime()
            };
          }
        } catch (err: any) {
          console.warn(`Applicability check error for ${scanner.name}:`, err.message);
        }
      }

      try {
        const scanPromise = scanner.scan(input);
        const result = await withTimeout(scanPromise, timeout, scanner.name);
        const scanEnd = new Date();

        return {
          ...result,
          state: result.state || (result.success ? ScannerState.SUCCESS : ScannerState.FAILED),
          durationMs: scanEnd.getTime() - scanStart.getTime(),
          endTime: scanEnd
        };
      } catch (err: any) {
        const scanEnd = new Date();
        const durationMs = scanEnd.getTime() - scanStart.getTime();

        if (err.code === 'ETIMEDOUT') {
          return {
            scanner: scanner.name,
            success: false,
            state: ScannerState.TIMEOUT,
            error: err.message,
            reason: `Execution exceeded timeout of ${timeout}ms`,
            findings: [],
            startTime: scanStart,
            endTime: scanEnd,
            durationMs
          };
        }

        if (err.code === 'ENOENT') {
          return {
            scanner: scanner.name,
            success: false,
            state: ScannerState.NOT_INSTALLED,
            error: err.message,
            reason: `Scanner executable was not found on PATH`,
            findings: [],
            startTime: scanStart,
            endTime: scanEnd,
            durationMs
          };
        }

        return {
          scanner: scanner.name,
          success: false,
          state: ScannerState.FAILED,
          error: err.message || String(err),
          findings: [],
          startTime: scanStart,
          endTime: scanEnd,
          durationMs
        };
      }
    };

    // Execute through bounded concurrency worker pool
    const scannerResults = await runWithConcurrencyLimit(this.scanners, concurrency, executeScanner);

    let allFindings: NormalizedFinding[] = [];
    const rawOutputs: Record<string, string> = {};

    for (const data of scannerResults) {
      if (data.findings && data.findings.length > 0) {
        allFindings = allFindings.concat(data.findings);
      }
      if (data.rawOutput) {
        rawOutputs[data.scanner] = data.rawOutput;
      }
    }

    // High-precision deduplication across scanners with line tolerance
    const deduplicatedFindings = deduplicateFindings(allFindings);

    // Standardize finding IDs to VG-FIND-001, VG-FIND-002, etc.
    deduplicatedFindings.forEach((finding, index) => {
      finding.id = `VG-FIND-${String(index + 1).padStart(3, '0')}`;
    });

    // Compute coverage matrix based on successful scanner executions
    const coverage: ScannerCoverage = {
      code: scannerResults.some(r => r.scanner.toLowerCase().includes('semgrep') && r.state === ScannerState.SUCCESS),
      dependencies: scannerResults.some(r => (r.scanner.toLowerCase().includes('npm') || r.scanner.toLowerCase().includes('audit') || r.scanner.toLowerCase().includes('trivy')) && r.state === ScannerState.SUCCESS),
      secrets: scannerResults.some(r => r.scanner.toLowerCase().includes('gitleaks') && r.state === ScannerState.SUCCESS),
      containers: scannerResults.some(r => r.scanner.toLowerCase().includes('trivy') && r.state === ScannerState.SUCCESS),
      iac: scannerResults.some(r => r.scanner.toLowerCase().includes('checkov') && r.state === ScannerState.SUCCESS),
      web: scannerResults.some(r => r.scanner.toLowerCase().includes('zap') && r.state === ScannerState.SUCCESS),
      cloud: scannerResults.some(r => (r.scanner.toLowerCase().includes('prowler') || r.scanner.toLowerCase().includes('cspm')) && r.state === ScannerState.SUCCESS)
    };

    const endTime = new Date();
    return {
      scanner: 'VibeGuard_Orchestrator',
      success: scannerResults.some(r => r.state === ScannerState.SUCCESS),
      state: ScannerState.SUCCESS,
      durationMs: endTime.getTime() - startTime.getTime(),
      findings: deduplicatedFindings,
      scannerResults,
      coverage,
      rawOutput: JSON.stringify(rawOutputs),
      startTime,
      endTime
    };
  }
}
