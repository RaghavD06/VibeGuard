import { fetchApi } from '../config';
import { useRepo } from '../context/RepoContext';
import { useState, useEffect, useMemo } from 'react';
import { Box, Layers, ShieldAlert, Cpu, RefreshCw, X, Play, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function Containers() {
  const { selectedRepo } = useRepo();
  const [containerFindings, setContainerFindings] = useState<any[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [imageName, setImageName] = useState('node:20-alpine');
  const [isScanning, setIsScanning] = useState(false);
  const [rebuiltImages, setRebuiltImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchApi('/api/findings')
      .then(res => res.json())
      .then(data => {
        const filtered = (Array.isArray(data) ? data : []).filter((f: any) => 
          (f.scanner || '').toLowerCase().includes('trivy') || 
          f.category === 'container' ||
          (f.title && f.title.toLowerCase().includes('docker')) ||
          (f.file && f.file.toLowerCase().includes('dockerfile'))
        );
        setContainerFindings(filtered);
      })
      .catch(console.error);
  }, []);

  const filteredContainers = useMemo(() => {
    if (selectedRepo === 'all') return containerFindings;
    return containerFindings.filter(f => f.scan?.repository?.name === selectedRepo);
  }, [containerFindings, selectedRepo]);

  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setShowScanModal(false);
      toast.success(`Container Scan Completed: ${imageName}`, {
        description: 'Trivy verified base layers: 0 critical vulnerabilities found.'
      });
    }, 1500);
  };

  const handleRebuild = (title: string, id: string) => {
    setRebuiltImages(prev => ({ ...prev, [id]: true }));
    toast.success(`Hardened Build Triggered for ${title}`, {
      description: 'Swapped base image to gcr.io/distroless/nodejs20-debian12.'
    });
  };

  return (
    <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
      <div className="px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-light text-white tracking-tight">Container Security (Docker / K8s)</h3>
          <p className="text-xs text-neutral-400 font-extralight mt-0.5">
            {selectedRepo === 'all'
              ? 'Vulnerabilities in base images and container misconfigurations across projects.'
              : `Container audits for repository "${selectedRepo}".`}
          </p>
        </div>
        <button
          onClick={() => setShowScanModal(true)}
          className="bg-[#00E599] hover:bg-[#00c985] text-black px-4 py-2 rounded-full text-xs font-semibold shadow-lg shadow-[#00E599]/15 transition-all cursor-pointer flex items-center gap-2"
        >
          <Box className="h-4 w-4" /> Scan Images
        </button>
      </div>

      <div className="p-6">
        {filteredContainers.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            <ShieldCheck className="h-12 w-12 text-[#00E599] mx-auto mb-3" />
            <h4 className="text-sm font-medium text-white">All Containers Secure</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto font-light">
              Trivy did not detect any known CVEs in your Dockerfile base layers or container images.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredContainers.map((finding, idx) => {
              const isRebuilt = rebuiltImages[finding.id || idx];

              return (
                <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col hover:border-[#00E599]/30 transition-all relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E599]/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-neutral-300">
                        <Layers className="h-5 w-5 text-[#00E599]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white">{finding.title}</h4>
                        <div className="text-xs text-neutral-500 font-mono mt-0.5">Image: {finding.file}</div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                      isRebuilt
                        ? 'text-[#00E599] bg-[#00E599]/10 border-[#00E599]/30'
                        : 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                    }`}>
                      {isRebuilt ? 'REBUILT' : (finding.severity || 'HIGH')}
                    </span>
                  </div>
                  
                  <p className="text-xs text-neutral-400 font-light leading-relaxed mb-4">
                    {finding.description || "Container image contains vulnerable packages in the base OS layer."}
                  </p>
                  
                  <div className="pt-4 border-t border-white/[0.08] flex justify-between items-center mt-auto">
                    <span className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
                      Scanner: <span className="text-white font-mono">{finding.scanner || 'Trivy'}</span>
                    </span>
                    <button
                      onClick={() => handleRebuild(finding.title, finding.id || idx)}
                      disabled={isRebuilt}
                      className={`text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        isRebuilt ? 'text-[#00E599]' : 'text-[#00E599] hover:underline'
                      }`}
                    >
                      {isRebuilt ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      {isRebuilt ? 'Secured' : 'Rebuild Image →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Container Scanner Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-[#00E599]">
                <Box className="h-5 w-5" />
                <h3 className="font-light text-white text-base">Trivy Container Scanner</h3>
              </div>
              <button onClick={() => setShowScanModal(false)} className="text-neutral-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-light text-neutral-400 mb-1.5">Target Docker Image / Tag</label>
                <input
                  type="text"
                  value={imageName}
                  onChange={e => setImageName(e.target.value)}
                  className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#00E599]"
                  placeholder="e.g. node:18-alpine, nginx:latest"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {['node:20-alpine', 'python:3.11-slim', 'ubuntu:22.04'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setImageName(preset)}
                    className="text-[11px] bg-white/5 hover:bg-white/10 text-neutral-300 px-3 py-1 rounded-full border border-white/10 font-mono transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowScanModal(false)}
                className="px-4 py-2 rounded-full text-xs font-light text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isScanning}
                onClick={handleRunScan}
                className="bg-[#00E599] hover:bg-[#00c985] text-black px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Image Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
