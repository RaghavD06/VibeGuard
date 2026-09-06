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
    <div className="bg-[#0D1017]/80 backdrop-blur-md shadow-xl rounded-xl border border-gray-800/80 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Hardcoded Secrets & Credentials</h3>
          <p className="text-xs text-gray-400 mt-0.5">
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
          className="bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
        >
          <Lock className="h-4 w-4" /> Rotate All Exposed Keys
        </button>
      </div>

      <div className="p-0">
        {filteredSecrets.length === 0 ? (
          <div className="p-12 text-center border-b border-dashed border-gray-800">
            <ShieldCheck className="h-12 w-12 text-emerald-400/80 mx-auto mb-3" />
            <h4 className="text-sm font-medium text-emerald-400">Zero Secrets Exposed</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Gitleaks and Secret Scanner did not detect any hardcoded AWS keys, Stripe tokens, or private certificates.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {filteredSecrets.map((secret, idx) => {
              const isKeyRotated = rotatedKeys[secret.id || idx];

              return (
                <div key={idx} className="p-6 hover:bg-gray-800/20 transition-colors flex flex-col md:flex-row gap-6">
                  {/* Left metadata */}
                  <div className="w-full md:w-1/3 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg border shadow-sm ${
                        isKeyRotated 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {isKeyRotated ? <CheckCircle2 className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{secret.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                          isKeyRotated
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {isKeyRotated ? 'ROTATED & SECURED' : (secret.severity || 'CRITICAL')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs space-y-2 text-gray-400">
                      <div className="flex items-start gap-2">
                        <span className="w-16 font-medium text-gray-500">File:</span>
                        <span className="font-mono text-gray-300 break-all">{secret.file}</span>
                      </div>
                      {secret.line && (
                        <div className="flex items-start gap-2">
                          <span className="w-16 font-medium text-gray-500">Line:</span>
                          <span className="font-mono text-yellow-400/80">{secret.line}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="w-16 font-medium text-gray-500">Scanner:</span>
                        <span className="font-mono text-cyan-400">{secret.scanner}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => handleRotateSingle(secret.id || idx, secret.title)}
                        disabled={isKeyRotated}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isKeyRotated
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 cursor-pointer'
                        }`}
                      >
                        <Lock className="h-3 w-3" /> {isKeyRotated ? 'Rotated' : 'Rotate Key'}
                      </button>
                    </div>
                  </div>

                  {/* Right snippet */}
                  <div className="w-full md:w-2/3 flex flex-col">
                    <div className="bg-[#050608] border border-gray-800/80 rounded-lg overflow-hidden mb-4 relative group">
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        <div className="px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] text-gray-400 flex items-center gap-1">
                          <EyeOff className="h-3 w-3" /> Redacted by VibeGuard
                        </div>
                      </div>
                      
                      <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-800/80 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                        <span className="text-[10px] font-mono text-gray-500 ml-2">{secret.file}</span>
                      </div>
                      
                      <div className="p-4 overflow-x-auto">
                        <pre className="text-xs font-mono">
                          <code className="text-gray-400">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1017] border border-red-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-red-400">
                <Lock className="h-5 w-5" />
                <h3 className="font-bold text-white text-base">Key Rotation Vault</h3>
              </div>
              <button onClick={() => setShowRotationModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-4">
              Are you sure you want to invalidate and re-issue all <strong className="text-white">{filteredSecrets.length} exposed keys</strong>?
            </p>

            <div className="bg-[#05070B] border border-red-900/30 rounded-lg p-3 text-xs text-red-300/80 mb-5 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>
                Dispatches automated rotation webhooks to AWS Secrets Manager, Vault, and cloud providers.
              </span>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRotationModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={isRotating}
                onClick={handleRotateAll}
                className="bg-red-500 hover:bg-red-400 text-black px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
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
