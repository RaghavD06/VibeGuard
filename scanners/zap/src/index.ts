import { SecurityScanner, ScannerCapability } from '@maverick006/security-engine';
import { ScanInput, ScannerResult, ScannerState } from '@maverick006/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseZapOutput } from './parser';

export class ZapScanner implements SecurityScanner {
  public name = 'OWASP ZAP';
  public version = 'unknown';

  public capabilities: ScannerCapability = {
    category: 'web',
    detectApplicability: async (repoPath: string, input?: ScanInput) => {
      if (input?.targetUrl) return true;
      try {
        await fs.access(path.join(repoPath, 'zap-report.json'));
        return true;
      } catch {
        return false;
      }
    }
  };

  async scan(input: ScanInput): Promise<ScannerResult> {
    const startTime = new Date();
    
    try {
      const reportPath = path.join(input.repositoryPath, 'zap-report.json');
      
      let rawOutput = '';
      try {
        rawOutput = await fs.readFile(reportPath, 'utf8');
      } catch {
        // If neither zap-report.json nor targetUrl is provided, return SKIPPED
        const endTime = new Date();
        return {
          scanner: this.name,
          success: true,
          state: ScannerState.SKIPPED,
          reason: 'Skipped: No live web target URL or zap-report.json provided',
          findings: [],
          rawOutput: 'No zap-report.json found and no target URL provided',
          startTime,
          endTime,
          durationMs: endTime.getTime() - startTime.getTime()
        };
      }
      
      const findings = parseZapOutput(input.scanId, rawOutput);
      const endTime = new Date();
      
      return {
        scanner: this.name,
        success: true,
        state: ScannerState.SUCCESS,
        findings,
        rawOutput,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime()
      };
    } catch (error: any) {
      const endTime = new Date();
      return {
        scanner: this.name,
        success: false,
        state: ScannerState.FAILED,
        findings: [],
        error: error.message || 'ZAP parser failed',
        rawOutput: '',
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime()
      };
    }
  }
}
