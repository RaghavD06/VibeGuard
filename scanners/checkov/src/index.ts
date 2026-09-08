import { SecurityScanner, ScannerCapability } from '@maverick006/security-engine';
import { ScanInput, ScannerResult, ScannerState } from '@maverick006/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseCheckovOutput } from './parser';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

function hasIacFiles(dirPath: string): boolean {
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
        if (hasIacFiles(path.join(dirPath, file.name))) return true;
      } else if (file.isFile()) {
        const ext = path.extname(file.name).toLowerCase();
        if (['.tf', '.bicep', '.template'].includes(ext)) return true;
        if (file.name.toLowerCase() === 'dockerfile' || file.name.toLowerCase().startsWith('dockerfile.')) return true;
        if (['.yaml', '.yml'].includes(ext)) {
          // Quick content check for k8s or cloudformation
          try {
            const content = fs.readFileSync(path.join(dirPath, file.name), 'utf8').slice(0, 500);
            if (content.includes('apiVersion:') || content.includes('AWSTemplateFormatVersion') || content.includes('Resources:')) {
              return true;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return false;
}

export class CheckovScanner implements SecurityScanner {
  public name = 'Checkov';
  public version = 'unknown';

  public capabilities: ScannerCapability = {
    category: 'iac',
    detectApplicability: (repoPath: string) => {
      const safePath = path.resolve(repoPath);
      return hasIacFiles(safePath);
    }
  };

  async scan(input: ScanInput): Promise<ScannerResult> {
    const startTime = new Date();
    let rawOutput = '';
    
    const safePath = path.resolve(input.repositoryPath);
    const hasIac = hasIacFiles(safePath);

    if (!hasIac) {
      const endTime = new Date();
      return {
        scanner: this.name,
        success: true,
        state: ScannerState.SKIPPED,
        reason: 'Skipped: No Infrastructure-as-Code (IaC) configuration detected',
        findings: [],
        rawOutput: 'No IaC files found',
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime()
      };
    }

    try {
      const checkovCmd = process.platform === 'win32' ? 'checkov.exe' : 'checkov';
      const { stdout } = await execFileAsync(checkovCmd, ['-d', safePath, '-o', 'json'], {
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 50
      });
      
      rawOutput = stdout;
      const findings = parseCheckovOutput(input.scanId, rawOutput);
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
      const durationMs = endTime.getTime() - startTime.getTime();

      if (error.code === 'ENOENT') {
        return {
          scanner: this.name,
          success: false,
          state: ScannerState.NOT_INSTALLED,
          reason: 'Checkov binary not found on PATH',
          findings: [],
          error: error.message,
          startTime,
          endTime,
          durationMs
        };
      }

      if (error.code === 'ETIMEDOUT') {
        return {
          scanner: this.name,
          success: false,
          state: ScannerState.TIMEOUT,
          reason: 'Checkov scan timed out',
          findings: [],
          error: error.message,
          startTime,
          endTime,
          durationMs
        };
      }

      // Checkov returns exit code > 0 if failures are found
      if (error.stdout && error.stdout.includes('"failed_checks"')) {
        try {
          rawOutput = error.stdout;
          const findings = parseCheckovOutput(input.scanId, rawOutput);
          return {
            scanner: this.name,
            success: true,
            state: ScannerState.SUCCESS,
            findings,
            rawOutput,
            startTime,
            endTime,
            durationMs
          };
        } catch {
          // ignore parsing error
        }
      }

      return {
        scanner: this.name,
        success: false,
        state: ScannerState.FAILED,
        findings: [],
        error: error.message || 'Checkov execution failed',
        rawOutput: error.stdout || '',
        startTime,
        endTime,
        durationMs
      };
    }
  }
}
