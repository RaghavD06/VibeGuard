import { useCollection } from '../hooks/useCollection';
import { CollectionStatus } from '../components/CollectionStatus';
import { useRepo } from '../context/RepoContext';
import { Download, FileText, FileJson } from 'lucide-react';
import { toast } from 'sonner';

export function Reports() {
  const { selectedRepo } = useRepo();
  const collection = useCollection('/api/findings', selectedRepo);
  const scanCollection = useCollection('/api/scans', selectedRepo);
  const findings = collection.data;
  const scans = scanCollection.data;

  const relevantFindings = selectedRepo === 'all' 
    ? findings 
    : findings.filter(f => f.scan?.repository?.name === selectedRepo);
  const latestScan = scans.find(s => selectedRepo === 'all' || s.repository?.name === selectedRepo);

  const handleDownloadExecutiveSummary = () => {
    const repoLabel = selectedRepo === 'all' ? 'All Monitored Repositories' : selectedRepo;
    const criticals = relevantFindings.filter(f => (f.severity || '').toUpperCase() === 'CRITICAL').length;
    const highs = relevantFindings.filter(f => (f.severity || '').toUpperCase() === 'HIGH').length;
    const mediums = relevantFindings.filter(f => (f.severity || '').toUpperCase() === 'MEDIUM').length;
    const lows = relevantFindings.filter(f => (f.severity || '').toUpperCase() === 'LOW').length;

    const summaryContent = `# VibeGuard Executive Security Summary
**Scope:** ${repoLabel}
**Generated Date:** ${new Date().toUTCString()}
**Latest Scan Score:** ${latestScan?.numericScore == null ? 'N/A (UNASSESSED)' : `${latestScan.numericScore}/100 (${latestScan.score})`}

---

## 1. High-Level Risk Posture
Counts below reflect ${relevantFindings.length} loaded findings. ${collection.hasMore ? "This export is PARTIAL; more records are available in the dashboard." : "All available records in the selected scope were loaded."} Scanner coverage is not recorded in this report.

- **Total Recorded Findings:** ${relevantFindings.length}
- **Critical Risk:** ${criticals}
- **High Risk:** ${highs}
- **Medium Risk:** ${mediums}
- **Low Risk:** ${lows}

---

## 2. Assessment Limits
This finding export is not a SOC 2 or ISO 27001 compliance assessment. Missing findings do not establish that a scanner ran or that a control passed.

---

## 3. Remediation Road Map
1. Review Critical and High findings and apply fixes in the repository.
2. Invalidate and rotate any credentials flagged by Gitleaks.
3. Integrate \`npx @maverick006/vibeguard scan . --ci\` into GitHub Actions.

*Generated from the dashboard's stored scan records; no cryptographic signature is attached.*
`;

    const blob = new Blob([summaryContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `VibeGuard-Executive-Summary-${selectedRepo}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Executive Summary Downloaded!', {
      description: `Generated VibeGuard-Executive-Summary-${selectedRepo}.md`
    });
  };

  const handleDownloadSarif = () => {
    const sarifOutput = {
      $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      version: "2.1.0",
      properties: { partial: collection.hasMore, loadedFindings: relevantFindings.length },
      runs: [
        {
          tool: {
            driver: {
              name: "VibeGuard",
              informationUri: "https://github.com/Maverickrd007/VibeGuard",
              rules: relevantFindings.map(f => ({
                id: f.ruleId || f.id,
                name: f.title,
                shortDescription: { text: f.title },
                defaultConfiguration: {
                  level: (f.severity || '').toUpperCase() === 'CRITICAL' || (f.severity || '').toUpperCase() === 'HIGH' ? 'error' : 'warning'
                }
              }))
            }
          },
          results: relevantFindings.map(f => ({
            ruleId: f.ruleId || f.id,
            level: (f.severity || '').toUpperCase() === 'CRITICAL' || (f.severity || '').toUpperCase() === 'HIGH' ? 'error' : 'warning',
            message: { text: f.description || f.title },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: f.file || 'unknown' },
                  region: { startLine: f.line || 1 }
                }
              }
            ]
          }))
        }
      ]
    };

    const blob = new Blob([JSON.stringify(sarifOutput, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vibeguard-audit-${selectedRepo}.sarif`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('SARIF Export Downloaded!', {
      description: `Exported ${relevantFindings.length} findings to vibeguard-audit-${selectedRepo}.sarif`
    });
  };

  return (
    <div className="max-w-4xl space-y-8">
      <CollectionStatus collection={collection} />
      <div>
        <h2 className="text-2xl font-light text-white flex items-center gap-3 tracking-tight">
          <FileText className="h-6 w-6 text-[#00E599]" />
          Compliance & Reports
        </h2>
        <p className="text-neutral-400 mt-1 text-xs font-extralight">
          Download Executive Summaries and SARIF logs for auditors and CI/CD pipelines.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center hover:border-[#00E599]/30 transition-all shadow-2xl shadow-black/60 group">
          <div className="h-16 w-16 bg-[#00E599]/10 border border-[#00E599]/20 text-[#00E599] rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
            <FileText className="h-8 w-8" />
          </div>
          <h3 className="text-white font-medium text-base mb-2">Executive Summary</h3>
          <p className="text-xs text-neutral-400 font-light mb-6">
            A summary of stored findings and the most recent scan score, with assessment limits stated.
          </p>
          <button 
            onClick={handleDownloadExecutiveSummary} 
            className="w-full py-2.5 rounded-full bg-[#00E599] text-black font-semibold text-xs shadow-lg shadow-[#00E599]/15 flex items-center justify-center gap-2 hover:bg-[#00c985] transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" /> Download Summary (MD)
          </button>
        </div>

        <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center hover:border-[#00E599]/30 transition-all shadow-2xl shadow-black/60 group">
          <div className="h-16 w-16 bg-white/5 border border-white/10 text-neutral-300 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
            <FileJson className="h-8 w-8 text-[#00E599]" />
          </div>
          <h3 className="text-white font-medium text-base mb-2">SARIF 2.1.0 Export</h3>
          <p className="text-xs text-neutral-400 font-light mb-6">
            Static Analysis Results Interchange Format (SARIF) for integration with GitHub Advanced Security.
          </p>
          <button 
            onClick={handleDownloadSarif} 
            className="w-full py-2.5 rounded-full bg-white/10 text-white font-medium text-xs border border-white/15 flex items-center justify-center gap-2 hover:bg-white/15 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" /> Download SARIF (.json)
          </button>
        </div>
      </div>
    </div>
  );
}
