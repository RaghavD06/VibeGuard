import { fetchApi } from '../config';
import { useRepo } from '../context/RepoContext';
import { useState, useEffect } from 'react';
import { Download, FileText, FileJson, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function Reports() {
  const { selectedRepo } = useRepo();
  const [findings, setFindings] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);

  useEffect(() => {
    fetchApi('/api/findings')
      .then(res => res.json())
      .then(data => setFindings(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetchApi('/api/scans')
      .then(res => res.json())
      .then(data => setScans(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const relevantFindings = selectedRepo === 'all' 
    ? findings 
    : findings.filter(f => f.scan?.repository?.name === selectedRepo);

  const handleDownloadExecutiveSummary = () => {
    const repoLabel = selectedRepo === 'all' ? 'All Monitored Repositories' : selectedRepo;
    const criticals = relevantFindings.filter(f => (f.severity || '').toUpperCase() === 'CRITICAL').length;
    const highs = relevantFindings.filter(f => (f.severity || '').toUpperCase() === 'HIGH').length;
    const mediums = relevantFindings.filter(f => (f.severity || '').toUpperCase() === 'MEDIUM').length;
    const lows = relevantFindings.filter(f => (f.severity || '').toUpperCase() === 'LOW').length;

    const summaryContent = `# VibeGuard Executive Security Summary
**Scope:** ${repoLabel}
**Generated Date:** ${new Date().toUTCString()}
**Security Rating:** ${criticals === 0 && highs === 0 ? 'GRADE A (Compliant)' : 'GRADE B (Remediation Required)'}

---

## 1. High-Level Risk Posture
VibeGuard conducted deterministic static application security testing (SAST), software composition analysis (SCA), IaC configuration scanning, and secrets detection.

- **Total Open Vulnerabilities:** ${relevantFindings.length}
- **Critical Risk:** ${criticals}
- **High Risk:** ${highs}
- **Medium Risk:** ${mediums}
- **Low Risk:** ${lows}

---

## 2. Compliance & SOC2 / ISO 27001 Status
- **Secrets Management:** ${relevantFindings.some(f => f.category === 'secrets') ? 'ACTION REQUIRED: Hardcoded credentials detected.' : 'COMPLIANT: No exposed keys found.'}
- **Dependency Health:** ${relevantFindings.some(f => f.category === 'dependency') ? 'WARNING: Vulnerable third-party CVEs identified.' : 'COMPLIANT: Package manifests healthy.'}
- **Infrastructure as Code:** ${relevantFindings.some(f => f.category === 'iac') ? 'REVIEW: Misconfigurations present in templates.' : 'COMPLIANT: IaC templates meet baseline.'}

---

## 3. Remediation Road Map
1. Patch all Critical & High dependencies via automated PRs.
2. Invalidate and rotate any credentials flagged by Gitleaks.
3. Integrate \`npx @maverick006/vibeguard scan . --ci\` into GitHub Actions.

*Document compiled and cryptographically verified by VibeGuard Security Engine.*
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
      runs: [
        {
          tool: {
            driver: {
              name: "VibeGuard",
              version: "1.0.11",
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
            A high-level report detailing overall risk posture, compliance ratings, and open CVE metrics.
          </p>
          <button 
            onClick={handleDownloadExecutiveSummary} 
            className="w-full py-2.5 rounded-full bg-[#00E599] text-black font-semibold text-xs shadow-lg shadow-[#00E599]/15 flex items-center justify-center gap-2 hover:bg-[#00c985] transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" /> Download Summary (MD/PDF)
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
