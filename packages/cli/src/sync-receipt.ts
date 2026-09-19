/** Accept only the persisted scan shape returned by POST /api/scans/upload. */
export function isPersistedScanReceipt(value: unknown, expectedFindings: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const scan = value as Record<string, unknown>;
  if (typeof scan.id !== 'string' || !scan.id ||
      typeof scan.repositoryId !== 'string' || !scan.repositoryId ||
      !Array.isArray(scan.findings) || scan.findings.length !== expectedFindings ||
      !scan.repository || typeof scan.repository !== 'object') return false;
  const repository = scan.repository as Record<string, unknown>;
  return repository.id === scan.repositoryId && scan.findings.every(finding =>
    Boolean(finding && typeof finding === 'object' &&
      typeof (finding as Record<string, unknown>).id === 'string' &&
      (finding as Record<string, unknown>).scanId === scan.id)
  );
}
