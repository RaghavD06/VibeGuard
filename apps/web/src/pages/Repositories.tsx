import { useRepo } from '../context/RepoContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderGit2, ExternalLink, Calendar, GitFork, Plus, X, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export function Repositories() {
  const { repositories, setSelectedRepo, addRepository } = useRepo();
  const navigate = useNavigate();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoName.trim()) {
      toast.error('Repository name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const newRepo = await addRepository(repoName.trim(), repoUrl.trim() || undefined);
      if (newRepo) {
        toast.success(`Repository Connected: ${newRepo.name}`);
        setShowConnectModal(false);
        setRepoName('');
        setRepoUrl('');
      } else {
        toast.error('Failed to connect repository.');
      }
    } catch {
      toast.error('Error connecting repository.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectRepo = (name: string) => {
    setSelectedRepo(name);
    navigate(`/dashboard?repo=${encodeURIComponent(name)}`);
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText('npx @maverick006/vibeguard@latest scan .');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
    toast.success('CLI command copied to clipboard!');
  };

  return (
    <div className="bg-black/45 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-light tracking-tight text-white">Monitored Repositories</h3>
          <p className="text-xs text-neutral-400 font-extralight mt-0.5">Click any repository to scope dashboard metrics and audit logs.</p>
        </div>
        <button 
          onClick={() => setShowConnectModal(true)} 
          className="bg-[#00E599] hover:bg-[#00c985] text-black px-4 py-2 rounded-full text-xs font-medium shadow-lg shadow-[#00E599]/15 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Connect Repository
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {repositories.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            <FolderGit2 className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
            <h4 className="text-sm font-light text-white">No repositories connected</h4>
            <p className="text-xs text-neutral-500 mt-1 mb-4 font-extralight">Run a CLI scan or connect a repository to see it here.</p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="bg-white/10 hover:bg-white/15 text-[#00E599] border border-white/15 px-4 py-2 rounded-full text-xs font-medium transition-all"
            >
              Connect First Repo
            </button>
          </div>
        ) : (
          repositories.map((repo) => (
            <div 
              key={repo.id} 
              onClick={() => handleSelectRepo(repo.name)}
              className="bg-black/50 border border-white/10 rounded-2xl p-5 hover:border-[#00E599]/40 transition-all group cursor-pointer relative overflow-hidden backdrop-blur-xl shadow-xl"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#00E599]/5 rounded-full blur-xl pointer-events-none group-hover:bg-[#00E599]/10 transition-all" />
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 group-hover:text-[#00E599] transition-colors">
                    <FolderGit2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white group-hover:text-[#00E599] transition-colors">{repo.name}</h4>
                    <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1 mt-1">
                      <GitFork className="h-3 w-3" /> main
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30 text-[10px] font-mono font-medium">
                  ACTIVE
                </span>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-white/[0.08]">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Added</span>
                  <span className="text-neutral-300 font-mono">{new Date(repo.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Source</span>
                  <span className="text-[#00E599] hover:underline flex items-center gap-1 truncate max-w-[160px] font-mono text-[11px]">
                    {repo.url} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Connect Repository Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-[#00E599]">
                <FolderGit2 className="h-5 w-5" />
                <h3 className="font-light text-white text-base">Connect Git Repository</h3>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-neutral-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConnect} className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-light text-neutral-400 mb-1.5">Repository Name *</label>
                <input
                  type="text"
                  required
                  value={repoName}
                  onChange={e => setRepoName(e.target.value)}
                  placeholder="e.g. backend-api or company/service"
                  className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00E599]"
                />
              </div>

              <div>
                <label className="block text-xs font-light text-neutral-400 mb-1.5">Git URL (Optional)</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/organization/repo.git"
                  className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#00E599]"
                />
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-xs">
                <span className="text-neutral-400 block mb-1.5 font-light">Or scan directly via CLI:</span>
                <div className="flex items-center justify-between bg-black/80 border border-white/10 rounded-lg px-3 py-2 font-mono text-[11px] text-[#00E599]">
                  <span className="truncate">npx @maverick006/vibeguard@latest scan .</span>
                  <button
                    type="button"
                    onClick={handleCopyCli}
                    className="ml-2 text-neutral-400 hover:text-white transition-colors"
                  >
                    {copiedCli ? <Check className="h-3.5 w-3.5 text-[#00E599]" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-light text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#00E599] hover:bg-[#00c985] text-black px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
