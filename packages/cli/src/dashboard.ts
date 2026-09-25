import type { NormalizedFinding, ScannerCoverage } from '@maverick006/types';
import type { RenderOptions, ScannerTelemetry } from './formatter';
import {
  color,
  divider,
  error,
  formatDuration,
  glyph,
  header,
  installHint,
  muted,
  row,
  separator,
  section,
  success,
  warning,
  writeLines
} from './terminal-ui';

const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

function severity(value: unknown): string {
  return String(value || 'INFO').toUpperCase();
}

function severityLabel(value: unknown): string {
  const label = severity(value).padEnd(8);
  if (label.trim() === 'CRITICAL') return color.critical(label);
  if (label.trim() === 'HIGH') return color.high(label);
  if (label.trim() === 'MEDIUM') return color.medium(label);
  if (label.trim() === 'LOW') return color.low(label);
  return color.muted(label);
}

function posture(coverage: ScannerCoverage): { count: number; label: string } {
  const count = Object.values(coverage).filter(Boolean).length;
  if (count === 0) return { count, label: 'UNASSESSED' };
  if (count < 7) return { count, label: 'PARTIAL' };
  return { count, label: 'COMPLETE' };
}

function scannerLine(scanner: ScannerTelemetry, mask: (value: string) => string): string[] {
  const state = String(scanner.state).toUpperCase();
  const name = scanner.scanner.padEnd(16);
  const duration = formatDuration(scanner.durationMs || 0).padStart(7);
  const count = scanner.findingsCount || 0;
  const reason = scanner.reason
    ? mask(scanner.reason).replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 180)
    : '';
  if (state === 'SUCCESS') {
    const findings = `${count} finding${count === 1 ? '' : 's'}`.padEnd(12);
    return [success(`${name} completed    ${findings} ${duration}`)];
  }
  if (state === 'NOT_INSTALLED') {
    const hint = installHint(scanner.scanner);
    return [warning(`${name} unavailable`), hint ? `  ${muted(hint)}` : undefined].filter(Boolean) as string[];
  }
  if (state === 'SKIPPED') {
    return [muted(`${glyph('muted')} ${name} not applicable${reason ? ` ${glyph('muted')} ${reason.replace(/^Skipped:\s*/i, '')}` : ''}`)];
  }
  if (state === 'TIMEOUT') return [error(`${name} timed out     ${duration}`)];
  if (state === 'FAILED') return [error(`${name} failed${reason ? ` ${glyph('muted')} ${reason}` : ''}`)];
  return [muted(`${glyph('muted')} ${name} ${state.toLowerCase()}`)];
}

function findingLines(finding: NormalizedFinding, mask: (value: string) => string): string[] {
  const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ''}` : 'Repository';
  return [
    `${severityLabel(finding.severity)} ${color.strong(mask(finding.title || 'Security finding'))}`,
    `  ${muted(`${finding.scanner || 'VibeGuard'} ${separator()} ${location}`)}`
  ];
}

export function renderPolishedDashboard(options: RenderOptions, mask: (value: string) => string): void {
  const {
    findings,
    stats,
    deterministicScore,
    coverage,
    gitInfo,
    duration,
    scanners,
    remediation,
    syncStatus = 'SKIPPED',
    syncError,
    policyThreshold,
    scanPath
  } = options;
  const coverageState = posture(coverage);
  const score = deterministicScore?.score ?? stats.score;
  const grade = deterministicScore?.grade ?? stats.grade;
  const isUnassessed = deterministicScore?.status === 'UNASSESSED' || coverageState.count === 0;

  writeLines([
    '',
    ...header('VibeGuard', `Scanning ${scanPath || gitInfo.name}`),
    ...section('Scanners')
  ]);
  for (const scanner of scanners) writeLines(scannerLine(scanner, mask));
  if (scanners.length === 0) writeLines([warning('No scanner results were returned.')]);

  writeLines([
    ...section('Security summary'),
    row('CRITICAL', String(stats.critical)),
    row('HIGH', String(stats.high)),
    row('MEDIUM', String(stats.medium)),
    row('LOW', String(stats.low)),
    '',
    row('Risk score', isUnassessed || score === null ? 'N/A' : `${score} / 100`),
    row('Grade', isUnassessed ? 'UNASSESSED' : String(grade)),
    row('Coverage', `${coverageState.label} ${separator()} ${coverageState.count} / 7 domains`)
  ]);

  if (findings.length > 0) {
    const top = [...findings]
      .sort((a, b) => (severityRank[severity(a.severity)] ?? 9) - (severityRank[severity(b.severity)] ?? 9))
      .slice(0, 3);
    writeLines(section('Top findings'));
    for (const finding of top) writeLines([...findingLines(finding, mask), '']);
    const urgent = findings.filter(f => ['CRITICAL', 'HIGH'].includes(severity(f.severity))).length;
    writeLines([
      urgent > 0
        ? warning(`${urgent} critical/high finding${urgent === 1 ? '' : 's'} require attention.`)
        : `${findings.length} finding${findings.length === 1 ? '' : 's'} detected in assessed domains.`,
      muted('Run with --json for complete finding data.')
    ]);
  } else {
    writeLines(['', isUnassessed ? warning('No security posture could be assessed.') : success('No findings detected in assessed domains.')]);
  }

  if (remediation) {
    writeLines(section(remediation.status === 'UNAVAILABLE' ? 'Remediation unavailable' : 'Proposed remediation'));
    if (remediation.status === 'UNAVAILABLE') {
      writeLines([warning(remediation.unavailableReason || 'AI remediation is unavailable.')]);
    } else {
      writeLines([
        row('Finding', remediation.findingId),
        remediation.severity ? row('Severity', remediation.severity) : undefined,
        '',
        mask(remediation.issue)
      ]);
      if (remediation.impact) writeLines(['', color.strong('Impact'), mask(remediation.impact)]);
      if (remediation.recommendation) writeLines(['', color.strong('Recommendation'), mask(remediation.recommendation)]);
      if (remediation.hasConcretePatch && remediation.suggestedFix) {
        writeLines(['', color.strong('Suggested change')]);
        for (const line of mask(remediation.suggestedFix).split('\n')) {
          writeLines([line.trimStart().startsWith('+') ? color.success(line) : line.trimStart().startsWith('-') ? color.error(line) : line]);
        }
      } else {
        writeLines(['', warning('No patch generated; guidance only.')]);
      }
      writeLines(['', row('Status', remediation.status)]);
    }
  }

  writeLines([
    ...section('Result'),
    isUnassessed ? warning(`Scan attempt completed in ${duration}`) : success(`Local scan completed in ${duration}`),
    row('Repository', gitInfo.name),
    row('Revision', `${gitInfo.branch} ${separator()} ${gitInfo.commit}`),
    policyThreshold ? row('Policy', `fail-on ${policyThreshold}`) : undefined
  ]);

  if (syncStatus === 'SYNCED') {
    writeLines(['', success('Authenticated with VibeGuard Cloud'), success(`Scan uploaded ${separator()} ${findings.length} finding${findings.length === 1 ? '' : 's'} synchronized`)]);
  } else if (syncStatus === 'FAILED') {
    writeLines(['', warning('Local results are preserved.'), error('Cloud sync failed.'), syncError ? `  ${muted(syncError)}` : undefined]);
  } else {
    writeLines(['', muted(`Cloud sync skipped ${separator()} add --sync to upload this scan`)]);
  }
  writeLines(['', muted('Privacy: source snippets remain local; sync sends redacted finding metadata.'), '']);
}
