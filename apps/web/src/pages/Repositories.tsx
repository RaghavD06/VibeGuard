import { useRepo } from '../context/RepoContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderGit2, ExternalLink, Calendar, GitFork, Plus, X, Terminal, Copy, Check } from 'lucide-react';
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
    <div className="bg-[#0D1017]/80 backdrop-blur-md shadow-xl rounded-xl border border-gray-800/80 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Monitored Repositories</h3>
          <p className="text-xs text-gray-400 mt-0.5">Click any repository to scope dashboard metrics and audit logs.</p>
        </div>
        <button 
          onClick={() => setShowConnectModal(true)} 
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-cyan-500/10 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Connect Repository
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {repositories.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed border-gray-800 rounded-xl">
            <FolderGit2 className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <h4 className="text-sm font-medium text-white">No repositories connected</h4>
            <p className="text-xs text-gray-500 mt-1 mb-4">Run a CLI scan or connect a repository to see it here.</p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="bg-gray-800 hover:bg-gray-700 text-cyan-400 px-4 py-2 rounded-lg text-xs font-semibold"
            >
              Connect First Repo
            </button>
          </div>
        ) : (
          repositories.map((repo) => (
            <div 
              key={repo.id} 
              onClick={() => handleSelectRepo(repo.name)}
              className="bg-[#0A0D14] border border-gray-800/80 rounded-xl p-5 hover:border-cyan-500/40 transition-colors group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-cyan-500/10 transition-all" />
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-800/50 text-gray-300 group-hover:text-cyan-400 transition-colors">
                    <FolderGit2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">{repo.name}</h4>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                      <GitFork className="h-3 w-3" /> main
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                  ACTIVE
                </span>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-gray-800/60">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Added</span>
                  <span className="text-gray-300 font-mono">{new Date(repo.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Source</span>
                  <span className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 truncate max-w-[160px]">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1017] border border-cyan-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <FolderGit2 className="h-5 w-5" />
                <h3 className="font-bold text-white text-base">Connect Git Repository</h3>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConnect} className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Repository Name *</label>
                <input
                  type="text"
                  required
                  value={repoName}
                  onChange={e => setRepoName(e.target.value)}
                  placeholder="e.g. backend-api or company/service"
                  className="w-full bg-[#05070B] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Git URL (Optional)</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/organization/repo.git"
                  className="w-full bg-[#05070B] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="bg-[#05070B] border border-gray-800 rounded-lg p-3 text-xs">
                <span className="text-gray-400 block mb-1">Or scan directly via CLI:</span>
                <div className="flex items-center justify-between bg-black/60 border border-gray-800 rounded px-2.5 py-1.5 font-mono text-[11px] text-cyan-300">
                  <span className="truncate">npx @maverick006/vibeguard@latest scan .</span>
                  <button
                    type="button"
                    onClick={handleCopyCli}
                    className="ml-2 text-gray-400 hover:text-white"
                  >
                    {copiedCli ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
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
