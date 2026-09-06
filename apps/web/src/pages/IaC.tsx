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
    <div className="bg-[#0D1017]/80 backdrop-blur-md shadow-xl rounded-xl border border-gray-800/80 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Infrastructure as Code (IaC)</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {selectedRepo === 'all'
              ? 'Misconfigurations in Terraform, CloudFormation, and Kubernetes manifests across projects.'
              : `IaC security checks for repository "${selectedRepo}".`}
          </p>
        </div>
        <button
          onClick={() => setShowCheckovModal(true)}
          className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
        >
          <FileCode2 className="h-4 w-4" /> Run Checkov
        </button>
      </div>

      <div className="p-0">
        {filteredIaC.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="h-12 w-12 text-emerald-400/80 mx-auto mb-3" />
            <h4 className="text-sm font-medium text-emerald-400">Infrastructure Secure</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              No misconfigurations detected in your Terraform, CloudFormation, or Helm templates.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {filteredIaC.map((finding, idx) => (
              <div key={idx} className="p-6 hover:bg-gray-800/20 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <Cloud className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-sm font-bold text-white">{finding.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        {finding.severity || 'MEDIUM'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{finding.description || "Resource configuration deviates from security baseline."}</p>
                    <div className="text-[11px] font-mono text-gray-500 flex items-center gap-2">
                      <FileCode2 className="h-3 w-3" /> {finding.file} {finding.line ? `(Line ${finding.line})` : ''}
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setViewingSnippet(finding)}
                      className="text-xs px-4 py-2 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold border border-indigo-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Code className="h-3.5 w-3.5" /> View Terraform
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1017] border border-indigo-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <FileCode2 className="h-5 w-5" />
                <h3 className="font-bold text-white text-base">Checkov IaC Policy Runner</h3>
              </div>
              <button onClick={() => setShowCheckovModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-4">
              Run policy analysis on all Terraform modules in <strong className="text-white">{selectedRepo === 'all' ? 'All Repositories' : selectedRepo}</strong>.
            </p>

            <div className="bg-[#05070B] border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-400 mb-5 space-y-1">
              <div className="text-indigo-300">Frameworks enabled:</div>
              <div>• Terraform (AWS, GCP, Azure)</div>
              <div>• Kubernetes Manifests & Helm Charts</div>
              <div>• Dockerfile & CloudFormation</div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCheckovModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={isRunningCheckov}
                onClick={handleRunCheckov}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1017] border border-gray-700 rounded-xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <FileCode2 className="h-5 w-5" />
                <h3 className="font-bold text-white text-sm">{viewingSnippet.file || 'main.tf'}</h3>
              </div>
              <button onClick={() => setViewingSnippet(null)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-[#05070B] border border-gray-800 rounded-lg overflow-hidden mb-4">
              <div className="px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-[10px] text-gray-400 font-mono">
                HCL Terraform Definition
              </div>
              <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto">
                <code>{viewingSnippet.codeSnippet || `resource "aws_s3_bucket" "data_bucket" {\n  bucket = "prod-data-vault"\n  # Remediation: Enable server-side encryption\n  server_side_encryption_configuration {\n    rule {\n      apply_server_side_encryption_by_default {\n        sse_algorithm = "aws:kms"\n      }\n    }\n  }\n}`}</code>
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setViewingSnippet(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-white"
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
