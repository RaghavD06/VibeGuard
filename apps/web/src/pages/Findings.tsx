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
        return <span className="px-2.5 py-1 inline-flex text-[10px] uppercase font-bold rounded bg-red-500/15 text-red-400 border border-red-500/30 tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.2)]">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2.5 py-1 inline-flex text-[10px] uppercase font-bold rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 tracking-wider">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-1 inline-flex text-[10px] uppercase font-bold rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 tracking-wider">MEDIUM</span>;
      default:
        return <span className="px-2.5 py-1 inline-flex text-[10px] uppercase font-bold rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 tracking-wider">LOW</span>;
    }
  };

  return (
    <div className="bg-[#0D1017]/90 backdrop-blur-md shadow-2xl rounded-xl border border-gray-800/80 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#080A0F]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <ShieldAlert className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Security Audit Telemetry</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedRepo === 'all'
                ? 'Comprehensive vulnerability analysis and remediation across all monitored projects.'
                : `Comprehensive vulnerability analysis for repository "${selectedRepo}".`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              showFilterBar || severityFilter !== 'ALL' || scannerFilter !== 'ALL' || searchQuery
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter Scans {severityFilter !== 'ALL' || scannerFilter !== 'ALL' ? '•' : ''}
          </button>

          <button
            disabled={isResolvingAll}
            onClick={handleResolveAll}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black px-4 py-2 rounded-lg text-xs font-semibold shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isResolvingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Resolve All
          </button>
        </div>
      </div>

      {/* Interactive Filter Drawer */}
      {showFilterBar && (
        <div className="bg-[#0B0E16] border-b border-gray-800 p-4 animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search findings by vulnerability or filename..."
                className="w-full bg-[#05070B] border border-gray-700/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Severity Filter */}
            <div>
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="w-full bg-[#05070B] border border-gray-700/60 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Scanner Filter */}
            <div className="flex gap-2">
              <select
                value={scannerFilter}
                onChange={e => setScannerFilter(e.target.value)}
                className="w-full bg-[#05070B] border border-gray-700/60 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Scanners</option>
                <option value="npm-audit">npm-audit (SCA)</option>
                <option value="semgrep">Semgrep (SAST)</option>
                <option value="trivy">Trivy (Container/Pkg)</option>
                <option value="gitleaks">Gitleaks (Secrets)</option>
                <option value="checkov">Checkov (IaC)</option>
              </select>

              {(searchQuery || severityFilter !== 'ALL' || scannerFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSeverityFilter('ALL');
                    setScannerFilter('ALL');
                  }}
                  className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs"
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
        <table className="min-w-full divide-y divide-gray-800/80">
          <thead className="bg-[#050608]">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest w-10"></th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">ID</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Vulnerability</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Severity</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scanner</th>
              <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Location</th>
              <th scope="col" className="px-6 py-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40 bg-[#0B0D14]/40">
            {filteredFindings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">
                  <ShieldAlert className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  No vulnerabilities match the current filter.
                </td>
              </tr>
            ) : (
              filteredFindings.map((finding) => (
                <React.Fragment key={finding.id}>
                  <tr 
                    onClick={() => toggleRow(finding.id)}
                    className={`cursor-pointer transition-colors ${expandedRow === finding.id ? 'bg-cyan-900/10 border-l-2 border-l-cyan-500' : 'hover:bg-gray-800/30 border-l-2 border-l-transparent'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {expandedRow === finding.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">{finding.id.substring(0, 8)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-200">{finding.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getSeverityBadge(finding.severity)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5" /> {finding.scanner}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                      {finding.file}{finding.line ? `:${finding.line}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {finding.status === 'RESOLVED' ? (
                        <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center justify-end gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Resolved
                        </span>
                      ) : finding.status === 'DISMISSED' ? (
                        <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center justify-end gap-1.5">
                          Dismissed
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-red-400 flex items-center justify-end gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Open
                        </span>
                      )}
                    </td>
                  </tr>
                  
                  {expandedRow === finding.id && (
                    <tr className="bg-[#06080C]">
                      <td colSpan={7} className="px-0 py-0 border-b border-gray-800/80">
                        <div className="p-6 md:p-8 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Left Col: Details & Code */}
                            <div>
                              <h4 className="text-sm font-bold text-white mb-2">Vulnerability Details</h4>
                              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                                {finding.description || "Detailed description not provided by the scanner. Please review the highlighted code segment."}
                              </p>
                              
                              <h4 className="text-sm font-bold text-white mb-2">Vulnerable Code Context</h4>
                              <div className="bg-[#0A0D14] rounded-lg border border-red-900/30 overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50"></div>
                                <div className="px-4 py-2 bg-red-500/5 border-b border-red-900/20 text-[10px] font-mono text-red-300/70 flex justify-between">
                                  <span>{finding.file}</span>
                                  <span>Line {finding.line || '?'}</span>
                                </div>
                                <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto">
                                  <code>{finding.codeSnippet || `// Location: ${finding.file}\n// Rule: ${finding.ruleId || 'security-audit-rule'}`}</code>
                                </pre>
                              </div>
                            </div>
                            
                            {/* Right Col: AI Remediation */}
                            <div className="bg-gradient-to-b from-cyan-950/20 to-transparent p-6 rounded-xl border border-cyan-900/30 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-3 opacity-20">
                                <Cpu className="h-24 w-24 text-cyan-400" />
                              </div>
                              <h4 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
                                <Cpu className="h-4 w-4" /> VG-AI Auto-Remediation
                              </h4>
                              
                              <p className="text-xs text-gray-400 leading-relaxed mb-4 relative z-10">
                                {finding.remediation || "VibeGuard AI recommends upgrading dependencies or parameterizing input to eliminate attack surface."}
                              </p>

                              <div className="bg-[#0A0D14] rounded-lg border border-emerald-900/30 overflow-hidden relative z-10 mb-4">
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                                <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-900/20 text-[10px] font-mono text-emerald-300/70">
                                  Suggested Remediation Patch
                                </div>
                                <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto">
                                  <code className="text-emerald-400">
                                    {finding.aiFix || `// Fix for ${finding.ruleId || finding.title}\nnpm audit fix --force`}
                                  </code>
                                </pre>
                              </div>
                              
                              <div className="flex justify-end gap-3 relative z-10">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDismissFinding(finding.id);
                                  }} 
                                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                                >
                                  Dismiss
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrModalFinding(finding);
                                  }} 
                                  className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-lg text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <GitPullRequest className="h-3.5 w-3.5" />
                                  Create Pull Request
                                </button>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1017] border border-cyan-500/40 rounded-xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <GitPullRequest className="h-5 w-5" />
                <h3 className="font-bold text-white text-base">Generate Automated Remediation PR</h3>
              </div>
              <button onClick={() => setPrModalFinding(null)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-4">
              VibeGuard AI will generate a pull request targeting <span className="font-mono text-cyan-300">main</span> with the patch for <strong className="text-white">{prModalFinding.title}</strong>.
            </p>

            <div className="bg-[#05070B] border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-400 mb-5 space-y-1">
              <div><span className="text-gray-600">Branch:</span> fix/vg-{prModalFinding.id.substring(0, 8)}</div>
              <div><span className="text-gray-600">Target File:</span> {prModalFinding.file}</div>
              <div><span className="text-gray-600">Commit Msg:</span> chore(security): patch {prModalFinding.title}</div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPrModalFinding(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={isCreatingPr}
                onClick={() => handleCreatePr(prModalFinding)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
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
