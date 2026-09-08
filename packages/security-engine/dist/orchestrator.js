"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orchestrator = void 0;
const types_1 = require("@maverick006/types");
const deduplication_1 = require("./deduplication");
/**
 * Runs tasks with a bounded concurrency pool (no unlimited Promise.all).
 */
async function runWithConcurrencyLimit(items, limit, fn) {
    const results = new Array(items.length);
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
function withTimeout(promise, timeoutMs, scannerName) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            const err = new Error(`Scanner ${scannerName} timed out after ${timeoutMs}ms`);
            err.code = 'ETIMEDOUT';
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
class Orchestrator {
    scanners = [];
    options;
    constructor(scanners, options = {}) {
        this.scanners = scanners;
        this.options = {
            concurrencyLimit: options.concurrencyLimit ?? 3,
            timeoutMs: options.timeoutMs ?? 120_000
        };
    }
    /**
     * Executes registered scanners using a bounded concurrency pool.
     */
    async runScan(input) {
        const startTime = new Date();
        const concurrency = this.options.concurrencyLimit ?? 3;
        const timeout = this.options.timeoutMs ?? 120_000;
        const executeScanner = async (scanner) => {
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
                            state: types_1.ScannerState.SKIPPED,
                            reason: `Skipped: Not applicable to repository or target`,
                            findings: [],
                            startTime: scanStart,
                            endTime: scanEnd,
                            durationMs: scanEnd.getTime() - scanStart.getTime()
                        };
                    }
                }
                catch (err) {
                    console.warn(`Applicability check error for ${scanner.name}:`, err.message);
                }
            }
            try {
                const scanPromise = scanner.scan(input);
                const result = await withTimeout(scanPromise, timeout, scanner.name);
                const scanEnd = new Date();
                return {
                    ...result,
                    state: result.state || (result.success ? types_1.ScannerState.SUCCESS : types_1.ScannerState.FAILED),
                    durationMs: scanEnd.getTime() - scanStart.getTime(),
                    endTime: scanEnd
                };
            }
            catch (err) {
                const scanEnd = new Date();
                const durationMs = scanEnd.getTime() - scanStart.getTime();
                if (err.code === 'ETIMEDOUT') {
                    return {
                        scanner: scanner.name,
                        success: false,
                        state: types_1.ScannerState.TIMEOUT,
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
                        state: types_1.ScannerState.NOT_INSTALLED,
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
                    state: types_1.ScannerState.FAILED,
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
        let allFindings = [];
        const rawOutputs = {};
        for (const data of scannerResults) {
            if (data.findings && data.findings.length > 0) {
                allFindings = allFindings.concat(data.findings);
            }
            if (data.rawOutput) {
                rawOutputs[data.scanner] = data.rawOutput;
            }
        }
        // High-precision deduplication across scanners with line tolerance
        const deduplicatedFindings = (0, deduplication_1.deduplicateFindings)(allFindings);
        // Standardize finding IDs to VG-FIND-001, VG-FIND-002, etc.
        deduplicatedFindings.forEach((finding, index) => {
            finding.id = `VG-FIND-${String(index + 1).padStart(3, '0')}`;
        });
        // Compute coverage matrix based on successful scanner executions
        const coverage = {
            code: scannerResults.some(r => r.scanner.toLowerCase().includes('semgrep') && r.state === types_1.ScannerState.SUCCESS),
            dependencies: scannerResults.some(r => (r.scanner.toLowerCase().includes('npm') || r.scanner.toLowerCase().includes('audit') || r.scanner.toLowerCase().includes('trivy')) && r.state === types_1.ScannerState.SUCCESS),
            secrets: scannerResults.some(r => r.scanner.toLowerCase().includes('gitleaks') && r.state === types_1.ScannerState.SUCCESS),
            containers: scannerResults.some(r => r.scanner.toLowerCase().includes('trivy') && r.state === types_1.ScannerState.SUCCESS),
            iac: scannerResults.some(r => r.scanner.toLowerCase().includes('checkov') && r.state === types_1.ScannerState.SUCCESS),
            web: scannerResults.some(r => r.scanner.toLowerCase().includes('zap') && r.state === types_1.ScannerState.SUCCESS),
            cloud: scannerResults.some(r => (r.scanner.toLowerCase().includes('prowler') || r.scanner.toLowerCase().includes('cspm')) && r.state === types_1.ScannerState.SUCCESS)
        };
        const endTime = new Date();
        return {
            scanner: 'VibeGuard_Orchestrator',
            success: scannerResults.some(r => r.state === types_1.ScannerState.SUCCESS),
            state: types_1.ScannerState.SUCCESS,
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
exports.Orchestrator = Orchestrator;
//# sourceMappingURL=orchestrator.js.map