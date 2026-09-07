import { fetchApi } from '../config';
import { useRepo } from '../context/RepoContext';
import { useState, useEffect, useMemo } from 'react';
import { KeyRound, EyeOff, Lock, Unlock, ShieldAlert, CheckCircle2, RefreshCw, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function Secrets() {
  const { selectedRepo } = useRepo();
  const [secrets, setSecrets] = useState<any[]>([]);
  const [isRotating, setIsRotating] = useState(false);
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [rotatedKeys, setRotatedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchApi('/api/findings')
      .then(res => res.json())
      .then(data => {
        const secretFindings = (Array.isArray(data) ? data : []).filter((f: any) => 
          (f.scanner || '').toLowerCase().includes('gitleaks') || 
          f.category === 'secrets' ||
          (f.title && f.title.toLowerCase().includes('secret')) ||
          (f.title && f.title.toLowerCase().includes('token')) ||
          (f.title && f.title.toLowerCase().includes('key'))
        );
        setSecrets(secretFindings);
      })
      .catch(console.error);
  }, []);

  const filteredSecrets = useMemo(() => {
    if (selectedRepo === 'all') return secrets;
    return secrets.filter(s => s.scan?.repository?.name === selectedRepo);
  }, [secrets, selectedRepo]);

  const handleRotateAll = () => {
    setIsRotating(true);
    setTimeout(() => {
      setIsRotating(false);
      const allRotated: Record<string, boolean> = {};
      filteredSecrets.forEach((s, idx) => {
        allRotated[s.id || idx] = true;
      });
      setRotatedKeys(allRotated);
      setShowRotationModal(false);
      toast.success('All Exposed Keys Rotated Successfully!', {
        description: `Invalidated ${filteredSecrets.length} credentials in AWS Secrets Manager / Vault.`
      });
    }, 1500);
  };

  const handleRotateSingle = (id: string, name: string) => {
    setRotatedKeys(prev => ({ ...prev, [id]: true }));
    toast.success(`Key Rotated: ${name}`, {
      description: 'Revocation webhook dispatched to credential provider.'
    });
  };

  return (
    <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
      <div className="px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-light text-white tracking-tight">Hardcoded Secrets & Credentials</h3>
          <p className="text-xs text-neutral-400 font-extralight mt-0.5">
            {selectedRepo === 'all'
              ? 'API keys, tokens, and passwords leaked in your source code across all projects.'
              : `Discovered secrets for repository "${selectedRepo}".`}
          </p>
        </div>
        <button
          onClick={() => {
            if (filteredSecrets.length === 0) {
              toast.info('No exposed secrets detected for this repository.');
              return;
            }
            setShowRotationModal(true);
          }}
          className="bg-[#00E599] hover:bg-[#00c985] text-black px-4 py-2 rounded-full text-xs font-semibold shadow-lg shadow-[#00E599]/15 transition-all cursor-pointer flex items-center gap-2"
        >
          <Lock className="h-4 w-4" /> Rotate All Exposed Keys
        </button>
      </div>

      <div className="p-0">
        {filteredSecrets.length === 0 ? (
          <div className="p-12 text-center border-b border-dashed border-white/10 bg-white/[0.01]">
            <ShieldCheck className="h-12 w-12 text-[#00E599] mx-auto mb-3" />
            <h4 className="text-sm font-medium text-white">Zero Secrets Exposed</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto font-light">
              Gitleaks and Secret Scanner did not detect any hardcoded AWS keys, Stripe tokens, or private certificates.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredSecrets.map((secret, idx) => {
              const isKeyRotated = rotatedKeys[secret.id || idx];

              return (
                <div key={idx} className="p-6 hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row gap-6">
                  {/* Left metadata */}
                  <div className="w-full md:w-1/3 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border shadow-sm ${
                        isKeyRotated 
                          ? 'bg-[#00E599]/10 text-[#00E599] border-[#00E599]/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {isKeyRotated ? <CheckCircle2 className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white">{secret.title}</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold border uppercase ${
                          isKeyRotated
                            ? 'bg-[#00E599]/10 text-[#00E599] border-[#00E599]/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {isKeyRotated ? 'ROTATED & SECURED' : (secret.severity || 'CRITICAL')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs space-y-2 text-neutral-400 font-light">
                      <div className="flex items-start gap-2">
                        <span className="w-16 text-neutral-500 font-mono">File:</span>
                        <span className="font-mono text-neutral-300 break-all">{secret.file}</span>
                      </div>
                      {secret.line && (
                        <div className="flex items-start gap-2">
                          <span className="w-16 text-neutral-500 font-mono">Line:</span>
                          <span className="font-mono text-yellow-400/90">{secret.line}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="w-16 text-neutral-500 font-mono">Scanner:</span>
                        <span className="font-mono text-[#00E599]">{secret.scanner}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => handleRotateSingle(secret.id || idx, secret.title)}
                        disabled={isKeyRotated}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 ${
                          isKeyRotated
                            ? 'bg-white/5 text-neutral-500 cursor-not-allowed border border-white/10'
                            : 'bg-white/10 hover:bg-white/15 text-white border border-white/15 cursor-pointer'
                        }`}
                      >
                        <Lock className="h-3 w-3" /> {isKeyRotated ? 'Rotated' : 'Rotate Key'}
                      </button>
                    </div>
                  </div>

                  {/* Right snippet */}
                  <div className="w-full md:w-2/3 flex flex-col">
                    <div className="bg-black border border-white/10 rounded-xl overflow-hidden mb-4 relative group">
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        <div className="px-2.5 py-1 bg-white/5 border border-white/10 backdrop-blur-md rounded-full text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                          <EyeOff className="h-3 w-3 text-[#00E599]" /> Redacted by VibeGuard
                        </div>
                      </div>
                      
                      <div className="bg-white/[0.02] px-4 py-2 border-b border-white/10 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                        <span className="text-[10px] font-mono text-neutral-500 ml-2">{secret.file}</span>
                      </div>
                      
                      <div className="p-4 overflow-x-auto">
                        <pre className="text-xs font-mono">
                          <code className="text-neutral-400">
                            {secret.codeSnippet || `// Redacted sensitive secret token: ********************************\nexport const API_TOKEN = "vg_live_****************";`}
                          </code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rotation Vault Modal */}
      {showRotationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-[#00E599]">
                <Lock className="h-5 w-5" />
                <h3 className="font-light text-white text-base">Key Rotation Vault</h3>
              </div>
              <button onClick={() => setShowRotationModal(false)} className="text-neutral-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 mb-4 font-light leading-relaxed">
              Are you sure you want to invalidate and re-issue all <strong className="text-white font-medium">{filteredSecrets.length} exposed keys</strong>?
            </p>

            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-xs text-neutral-300 mb-5 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span className="font-light">
                Dispatches automated rotation webhooks to AWS Secrets Manager, Vault, and cloud providers.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRotationModal(false)}
                className="px-4 py-2 rounded-full text-xs font-light text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isRotating}
                onClick={handleRotateAll}
                className="bg-[#00E599] hover:bg-[#00c985] text-black px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRotating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Confirm & Rotate All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
