import { ScanInput, ScannerResult } from '@maverick006/types';

export interface ScannerCapability {
  category: 'code' | 'dependencies' | 'secrets' | 'containers' | 'iac' | 'web' | 'cloud';
  requiresCredentials?: boolean;
  detectApplicability?: (repoPath: string, input?: ScanInput) => Promise<boolean> | boolean;
}

/**
 * Base interface that all VibeGuard scanners must implement.
 * This provides the core abstraction allowing new scanners to be added
 * without rewriting the rest of the application.
 */
export interface SecurityScanner {
  /**
   * The name of the scanner (e.g., 'Semgrep', 'Gitleaks')
   */
  name: string;

  /**
   * The version of the scanner, if known/applicable.
   */
  version?: string;

  /**
   * Optional capability metadata and applicability detection.
   */
  capabilities?: ScannerCapability;

  /**
   * Executes the scanner against the given input.
   * 
   * @param input The configuration and path for the scan.
   * @returns A promise resolving to the normalized scanner results.
   */
  scan(input: ScanInput): Promise<ScannerResult>;
}
