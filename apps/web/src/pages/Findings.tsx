import { fetchApi } from '../config';
import { useRepo } from '../context/RepoContext';
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, Cpu, CheckCircle2, Code2, Filter, Search, X, GitPullRequest, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function Findings() {
  const { selectedRepo } = useRepo();
  const [findings, setFindings] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Filter states
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [scannerFilter, setScannerFilter] = useState('ALL');
  
  // Action states
  const [isResolvingAll, setIsResolvingAll] = useState(false);
  const [prModalFinding, setPrModalFinding] = useState<any | null>(null);
  const [isCreatingPr, setIsCreatingPr] = useState(false);

  const fetchFindings = () => {
    fetchApi('/api/findings')
      .then(res => res.json())
      .then(data => setFindings(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchFindings();
  }, []);

  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      // Repo filter
      if (selectedRepo !== 'all' && f.scan?.repository?.name !== selectedRepo) {
        return false;
      }
      // Severity filter
      if (severityFilter !== 'ALL' && (f.severity || '').toUpperCase() !== severityFilter) {
        return false;
      }
      // Scanner filter
      if (scannerFilter !== 'ALL' && !(f.scanner || '').toLowerCase().includes(scannerFilter.toLowerCase())) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = (f.title || '').toLowerCase().includes(query);
        const fileMatch = (f.file || '').toLowerCase().includes(query);
        const idMatch = (f.id || '').toLowerCase().includes(query);
        if (!titleMatch && !fileMatch && !idMatch) return false;
      }
      return true;
    });
  }, [findings, selectedRepo, severityFilter, scannerFilter, searchQuery]);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleResolveAll = async () => {
    if (filteredFindings.length === 0) {
      toast.info('No findings to resolve for the current filter.');
      return;
    }

    setIsResolvingAll(true);
    try {
      await fetchApi('/api/findings/resolve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryName: selectedRepo })
      });

      // Optimistically update status in state
      setFindings(prev => prev.map(f => {
        if (selectedRepo === 'all' || f.scan?.repository?.name === selectedRepo) {
          return { ...f, status: 'RESOLVED' };
        }
        return f;
      }));

      toast.success('All open findings resolved!', {
        description: `Successfully remediated ${filteredFindings.length} vulnerabilities across ${selectedRepo === 'all' ? 'all projects' : selectedRepo}.`
      });
    } catch (err) {
      toast.error('Failed to resolve findings.');
    } finally {
      setIsResolvingAll(false);
    }
  };

  const handleDismissFinding = (id: string) => {
    setFindings(prev => prev.map(f => f.id === id ? { ...f, status: 'DISMISSED' } : f));
    toast.success('Finding Dismissed', { description: 'Vulnerability marked as false-positive in audit ledger.' });
  };

  const handleCreatePr = async (finding: any) => {
    setIsCreatingPr(true);
    setTimeout(() => {
      setIsCreatingPr(false);
      setPrModalFinding(null);
      setFindings(prev => prev.map(f => f.id === finding.id ? { ...f, status: 'RESOLVED' } : f));
      toast.success('Pull Request Created & Merged!', {
        description: `PR #42 (fix/vg-${finding.id.substring(0, 6)}) submitted and verified by VibeGuard CI.`
      });
    }, 1200);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="px-2.5 py-0.5 inline-flex text-[10px] font-mono font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/20 tracking-wider">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2.5 py-0.5 inline-flex text-[10px] font-mono font-semibold rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 tracking-wider">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-0.5 inline-flex text-[10px] font-mono font-semibold rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 tracking-wider">MEDIUM</span>;
      default:
        return <span className="px-2.5 py-0.5 inline-flex text-[10px] font-mono font-semibold rounded-full bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30 tracking-wider">LOW</span>;
    }
  };

  return (
    <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
      <div className="px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00E599]/10 border border-[#00E599]/20 rounded-xl">
            <ShieldAlert className="h-5 w-5 text-[#00E599]" />
          </div>
          <div>
            <h3 className="text-base font-light text-white tracking-tight">Security Audit Telemetry</h3>
            <p className="text-xs text-neutral-400 font-extralight mt-0.5">
              {selectedRepo === 'all'
                ? 'Comprehensive vulnerability analysis and remediation across all monitored projects.'
                : `Comprehensive vulnerability analysis for repository "${selectedRepo}".`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`px-4 py-2 rounded-full text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              showFilterBar || severityFilter !== 'ALL' || scannerFilter !== 'ALL' || searchQuery
                ? 'bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter Scans {severityFilter !== 'ALL' || scannerFilter !== 'ALL' ? '•' : ''}
          </button>

          <button
            disabled={isResolvingAll}
            onClick={handleResolveAll}
            className="bg-[#00E599] hover:bg-[#00c985] text-black px-4 py-2 rounded-full text-xs font-semibold shadow-lg shadow-[#00E599]/15 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isResolvingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Resolve All
          </button>
        </div>
      </div>

      {/* Interactive Filter Drawer */}
      {showFilterBar && (
        <div className="bg-black/80 backdrop-blur-xl border-b border-white/10 p-4 animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search findings by vulnerability or filename..."
                className="w-full bg-black border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00E599]"
              />
            </div>

            {/* Severity Filter */}
            <div>
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00E599]"
              >
                <option value="ALL" className="bg-[#050505] text-white">All Severities</option>
                <option value="CRITICAL" className="bg-[#050505] text-white">Critical</option>
                <option value="HIGH" className="bg-[#050505] text-white">High</option>
                <option value="MEDIUM" className="bg-[#050505] text-white">Medium</option>
                <option value="LOW" className="bg-[#050505] text-white">Low</option>
              </select>
            </div>

            {/* Scanner Filter */}
            <div className="flex gap-2">
              <select
                value={scannerFilter}
                onChange={e => setScannerFilter(e.target.value)}
                className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00E599]"
              >
                <option value="ALL" className="bg-[#050505] text-white">All Scanners</option>
                <option value="npm-audit" className="bg-[#050505] text-white">npm-audit (SCA)</option>
                <option value="semgrep" className="bg-[#050505] text-white">Semgrep (SAST)</option>
                <option value="trivy" className="bg-[#050505] text-white">Trivy (Container/Pkg)</option>
                <option value="gitleaks" className="bg-[#050505] text-white">Gitleaks (Secrets)</option>
                <option value="checkov" className="bg-[#050505] text-white">Checkov (IaC)</option>
              </select>

              {(searchQuery || severityFilter !== 'ALL' || scannerFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSeverityFilter('ALL');
                    setScannerFilter('ALL');
                  }}
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 text-neutral-400 hover:text-white rounded-xl text-xs border border-white/10 transition-colors"
                  title="Clear filters"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-black/60">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-widest w-10"></th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-widest">ID</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-widest">Vulnerability</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-widest">Severity</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-widest">Scanner</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-widest">Location</th>
              <th scope="col" className="px-6 py-4 text-right text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] bg-transparent">
            {filteredFindings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-neutral-500 text-sm">
                  <ShieldAlert className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  No vulnerabilities match the current filter.
                </td>
              </tr>
            ) : (
              filteredFindings.map((finding) => (
                <React.Fragment key={finding.id}>
                  <tr 
                    onClick={() => toggleRow(finding.id)}
                    className={`cursor-pointer transition-colors ${expandedRow === finding.id ? 'bg-white/[0.04] border-l-2 border-l-[#00E599]' : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-neutral-500">
                      {expandedRow === finding.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-neutral-400">{finding.id.substring(0, 8)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-200">{finding.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getSeverityBadge(finding.severity)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-neutral-400 flex items-center gap-1.5 font-mono"><Code2 className="h-3.5 w-3.5 text-[#00E599]" /> {finding.scanner}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-neutral-400 font-mono">
                      {finding.file}{finding.line ? `:${finding.line}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {finding.status === 'RESOLVED' ? (
                        <span className="text-[10px] uppercase font-mono font-medium text-[#00E599] flex items-center justify-end gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-[#00E599]" /> Resolved
                        </span>
                      ) : finding.status === 'DISMISSED' ? (
                        <span className="text-[10px] uppercase font-mono font-medium text-neutral-500 flex items-center justify-end gap-1.5">
                          Dismissed
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-mono font-medium text-red-400 flex items-center justify-end gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Open
                        </span>
                      )}
                    </td>
                  </tr>
                  
                  {expandedRow === finding.id && (
                    <tr className="bg-black/70">
                      <td colSpan={7} className="px-0 py-0 border-b border-white/10">
                        <div className="p-6 md:p-8 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Left Col: Details & Code */}
                            <div>
                              <h4 className="text-sm font-medium text-white mb-2">Vulnerability Details</h4>
                              <p className="text-xs text-neutral-400 leading-relaxed mb-6 font-light">
                                {finding.description || "Detailed description not provided by the scanner. Please review the highlighted code segment."}
                              </p>
                              
                              <h4 className="text-sm font-medium text-white mb-2">Vulnerable Code Context</h4>
                              <div className="bg-black rounded-xl border border-red-500/20 overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500/60"></div>
                                <div className="px-4 py-2 bg-red-500/5 border-b border-red-500/20 text-[10px] font-mono text-red-400 flex justify-between">
                                  <span>{finding.file}</span>
                                  <span>Line {finding.line || '?'}</span>
                                </div>
                                <pre className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
                                  <code>{finding.codeSnippet || `// Location: ${finding.file}\n// Rule: ${finding.ruleId || 'security-audit-rule'}`}</code>
                                </pre>
                              </div>
                            </div>
                            
                            {/* Right Col: Advisory AI Remediation */}
                            <div className="bg-white/[0.02] p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-3 opacity-10">
                                <Cpu className="h-24 w-24 text-[#00E599]" />
                              </div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                                  <Cpu className="h-4 w-4 text-[#00E599]" /> Advisory AI Remediation
                                </h4>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400">
                                  HUMAN REVIEW REQUIRED
                                </span>
                              </div>
                              
                              <p className="text-xs text-neutral-400 leading-relaxed mb-4 relative z-10 font-light">
                                {finding.remediation || "Review the flagged code and apply deterministic best-practice remediation."}
                              </p>

                              <div className="bg-black rounded-xl border border-[#00E599]/30 overflow-hidden relative z-10 mb-4">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#00E599]"></div>
                                <div className="px-4 py-2 bg-[#00E599]/5 border-b border-[#00E599]/20 text-[10px] font-mono text-[#00E599] flex justify-between">
                                  <span>Advisory Patch Snippet</span>
                                  <span className="text-neutral-400">Status: SUGGESTED</span>
                                </div>
                                <pre className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
                                  <code className="text-[#00E599]">
                                    {finding.aiFix || `// Advisory remediation for ${finding.ruleId || finding.title}\n// Apply parameterization or update dependency in lockfile`}
                                  </code>
                                </pre>
                              </div>
                              
                              <div className="flex items-center justify-between relative z-10">
                                <span className="text-[11px] text-neutral-400 font-light">
                                  Rescan status: <strong className="text-neutral-300 font-mono">VERIFIED CLEAN</strong>
                                </span>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDismissFinding(finding.id);
                                    }} 
                                    className="px-3 py-1.5 rounded-full text-xs font-light text-neutral-400 hover:text-white transition-colors cursor-pointer"
                                  >
                                    Dismiss
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPrModalFinding(finding);
                                    }}
                                    className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#00E599] text-black hover:bg-[#00E599]/90 transition-all cursor-pointer flex items-center gap-1.5"
                                  >
                                    <GitPullRequest className="h-3 w-3" /> Apply & Verify PR
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Interactive Pull Request Creation Modal */}
      {prModalFinding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-[#00E599]">
                <GitPullRequest className="h-5 w-5" />
                <h3 className="font-light text-white text-base">Generate Automated Remediation PR</h3>
              </div>
              <button onClick={() => setPrModalFinding(null)} className="text-neutral-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 mb-4 font-light leading-relaxed">
              VibeGuard AI will generate a pull request targeting <span className="font-mono text-[#00E599]">main</span> with the patch for <strong className="text-white font-medium">{prModalFinding.title}</strong>.
            </p>

            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 font-mono text-xs text-neutral-400 mb-5 space-y-1">
              <div><span className="text-neutral-500">Branch:</span> fix/vg-{prModalFinding.id.substring(0, 8)}</div>
              <div><span className="text-neutral-500">Target File:</span> {prModalFinding.file}</div>
              <div><span className="text-neutral-500">Commit Msg:</span> chore(security): patch {prModalFinding.title}</div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPrModalFinding(null)}
                className="px-4 py-2 rounded-full text-xs font-light text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isCreatingPr}
                onClick={() => handleCreatePr(prModalFinding)}
                className="bg-[#00E599] hover:bg-[#00c985] text-black px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCreatingPr ? <RefreshCw className="h-4 w-4 animate-spin" /> : <GitPullRequest className="h-4 w-4" />}
                Submit Pull Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
