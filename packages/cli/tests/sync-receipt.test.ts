import { isPersistedScanReceipt } from '../src/sync-receipt';

describe('cloud persistence receipt', () => {
  const persisted = {
    id: 'scan-a', repositoryId: 'repo-a', repository: { id: 'repo-a' },
    findings: [{ id: 'finding-a', scanId: 'scan-a' }]
  };

  it('accepts a scan with a matching repository and all persisted findings', () => {
    expect(isPersistedScanReceipt(persisted, 1)).toBe(true);
    expect(isPersistedScanReceipt({ ...persisted, findings: [] }, 0)).toBe(true);
  });

  it('rejects success-shaped but incomplete or unrelated responses', () => {
    expect(isPersistedScanReceipt({ success: true }, 1)).toBe(false);
    expect(isPersistedScanReceipt({ ...persisted, findings: [] }, 1)).toBe(false);
    expect(isPersistedScanReceipt({ ...persisted, repository: { id: 'repo-b' } }, 1)).toBe(false);
    expect(isPersistedScanReceipt({ ...persisted, findings: [{ id: 'finding-a', scanId: 'scan-b' }] }, 1)).toBe(false);
  });
});
