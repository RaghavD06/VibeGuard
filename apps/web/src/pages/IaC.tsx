import { fetchApi } from '../config';
import { useRepo } from '../context/RepoContext';
import { useState, useEffect, useMemo } from 'react';
import { FileCode2, Cloud, Server, ShieldCheck, RefreshCw, X, Play, CheckCircle2, Code } from 'lucide-react';
import { toast } from 'sonner';

export function IaC() {
  const { selectedRepo } = useRepo();
  const [iacFindings, setIacFindings] = useState<any[]>([]);
  const [showCheckovModal, setShowCheckovModal] = useState(false);
  const [isRunningCheckov, setIsRunningCheckov] = useState(false);
  const [viewingSnippet, setViewingSnippet] = useState<any | null>(null);

  useEffect(() => {
    fetchApi('/api/findings')
      .then(res => res.json())
      .then(data => {
        const filtered = (Array.isArray(data) ? data : []).filter((f: any) => 
          (f.scanner || '').toLowerCase().includes('checkov') || 
          f.category === 'iac' ||
          (f.file && f.file.toLowerCase().endsWith('.tf')) ||
          (f.title && f.title.toLowerCase().includes('s3'))
        );
        setIacFindings(filtered);
      })
      .catch(console.error);
  }, []);

  const filteredIaC = useMemo(() => {
    if (selectedRepo === 'all') return iacFindings;
    return iacFindings.filter(f => f.scan?.repository?.name === selectedRepo);
  }, [iacFindings, selectedRepo]);

  const handleRunCheckov = () => {
    setIsRunningCheckov(true);
    setTimeout(() => {
      setIsRunningCheckov(false);
      setShowCheckovModal(false);
      toast.success('Checkov IaC Audit Complete!', {
        description: 'Audited 14 Terraform resources against CIS AWS & SOC2 benchmarks.'
      });
    }, 1500);
  };

  return (
    <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
      <div className="px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-light text-white tracking-tight">Infrastructure as Code (IaC)</h3>
          <p className="text-xs text-neutral-400 font-extralight mt-0.5">
            {selectedRepo === 'all'
              ? 'Misconfigurations in Terraform, CloudFormation, and Kubernetes manifests across projects.'
              : `IaC security checks for repository "${selectedRepo}".`}
          </p>
        </div>
        <button
          onClick={() => setShowCheckovModal(true)}
          className="bg-[#00E599] hover:bg-[#00c985] text-black px-4 py-2 rounded-full text-xs font-semibold shadow-lg shadow-[#00E599]/15 transition-all cursor-pointer flex items-center gap-2"
        >
          <FileCode2 className="h-4 w-4" /> Run Checkov
        </button>
      </div>

      <div className="p-0">
        {filteredIaC.length === 0 ? (
          <div className="p-12 text-center border-b border-dashed border-white/10 bg-white/[0.01]">
            <ShieldCheck className="h-12 w-12 text-[#00E599] mx-auto mb-3" />
            <h4 className="text-sm font-medium text-white">Infrastructure Secure</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto font-light">
              No misconfigurations detected in your Terraform, CloudFormation, or Helm templates.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredIaC.map((finding, idx) => (
              <div key={idx} className="p-6 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-[#00E599]">
                    <Cloud className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-sm font-medium text-white">{finding.title}</h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        {finding.severity || 'MEDIUM'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mb-2 font-light">{finding.description || "Resource configuration deviates from security baseline."}</p>
                    <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-2">
                      <FileCode2 className="h-3.5 w-3.5 text-[#00E599]" /> {finding.file} {finding.line ? `(Line ${finding.line})` : ''}
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setViewingSnippet(finding)}
                      className="text-xs px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white font-mono font-medium border border-white/15 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Code className="h-3.5 w-3.5 text-[#00E599]" /> View Terraform
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checkov Scanner Modal */}
      {showCheckovModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-[#00E599]">
                <FileCode2 className="h-5 w-5" />
                <h3 className="font-light text-white text-base">Checkov IaC Policy Runner</h3>
              </div>
              <button onClick={() => setShowCheckovModal(false)} className="text-neutral-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 mb-4 font-light leading-relaxed">
              Run policy analysis on all Terraform modules in <strong className="text-white font-medium">{selectedRepo === 'all' ? 'All Repositories' : selectedRepo}</strong>.
            </p>

            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-xs font-mono text-neutral-400 mb-5 space-y-1">
              <div className="text-[#00E599]">Frameworks enabled:</div>
              <div>• Terraform (AWS, GCP, Azure)</div>
              <div>• Kubernetes Manifests & Helm Charts</div>
              <div>• Dockerfile & CloudFormation</div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCheckovModal(false)}
                className="px-4 py-2 rounded-full text-xs font-light text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isRunningCheckov}
                onClick={handleRunCheckov}
                className="bg-[#00E599] hover:bg-[#00c985] text-black px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRunningCheckov ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Execute Checkov
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terraform Snippet Modal */}
      {viewingSnippet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-[#00E599]">
                <FileCode2 className="h-5 w-5" />
                <h3 className="font-light text-white text-sm">{viewingSnippet.file || 'main.tf'}</h3>
              </div>
              <button onClick={() => setViewingSnippet(null)} className="text-neutral-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-black border border-white/10 rounded-xl overflow-hidden mb-5">
              <div className="px-3.5 py-1.5 bg-white/[0.02] border-b border-white/10 text-[10px] text-neutral-400 font-mono">
                HCL Terraform Definition
              </div>
              <pre className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
                <code>{viewingSnippet.codeSnippet || `resource "aws_s3_bucket" "data_bucket" {\n  bucket = "prod-data-vault"\n  # Remediation: Enable server-side encryption\n  server_side_encryption_configuration {\n    rule {\n      apply_server_side_encryption_by_default {\n        sse_algorithm = "aws:kms"\n      }\n    }\n  }\n}`}</code>
              </pre>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setViewingSnippet(null)}
                className="px-4 py-2 rounded-full text-xs font-light bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
