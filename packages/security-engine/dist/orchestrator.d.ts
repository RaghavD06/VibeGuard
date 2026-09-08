import { ScanInput, ScannerResult, ScannerCoverage } from '@maverick006/types';
import { SecurityScanner } from './scanner';
export interface OrchestratorOptions {
    concurrencyLimit?: number;
    timeoutMs?: number;
}
export interface OrchestratedScanResult extends ScannerResult {
    scannerResults: ScannerResult[];
    coverage: ScannerCoverage;
}
/**
 * Orchestrates the execution of multiple security scanners and aggregates/deduplicates their findings.
 */
export declare class Orchestrator {
    private scanners;
    private options;
    constructor(scanners: SecurityScanner[], options?: OrchestratorOptions);
    /**
     * Executes registered scanners using a bounded concurrency pool.
     */
    runScan(input: ScanInput): Promise<OrchestratedScanResult>;
}
//# sourceMappingURL=orchestrator.d.ts.map