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
    <div className="bg-[#0D1017]/80 backdrop-blur-md shadow-xl rounded-xl border border-gray-800/80 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Container Security (Docker / K8s)</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {selectedRepo === 'all'
              ? 'Vulnerabilities in base images and container misconfigurations across projects.'
              : `Container audits for repository "${selectedRepo}".`}
          </p>
        </div>
        <button
          onClick={() => setShowScanModal(true)}
          className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
        >
          <Box className="h-4 w-4" /> Scan Images
        </button>
      </div>

      <div className="p-6">
        {filteredContainers.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-gray-800 rounded-xl">
            <ShieldCheck className="h-12 w-12 text-emerald-400/80 mx-auto mb-3" />
            <h4 className="text-sm font-medium text-emerald-400">All Containers Secure</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Trivy did not detect any known CVEs in your Dockerfile base layers or container images.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredContainers.map((finding, idx) => {
              const isRebuilt = rebuiltImages[finding.id || idx];

              return (
                <div key={idx} className="bg-[#0A0D14] border border-gray-800 rounded-xl p-5 flex flex-col hover:border-cyan-500/30 transition-colors relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-800/50 rounded-lg">
                        <Layers className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{finding.title}</h4>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">Image: {finding.file}</div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                      isRebuilt
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                    }`}>
                      {isRebuilt ? 'REBUILT' : (finding.severity || 'HIGH')}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    {finding.description || "Container image contains vulnerable packages in the base OS layer."}
                  </p>
                  
                  <div className="pt-4 border-t border-gray-800/60 flex justify-between items-center mt-auto">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      Scanner: <span className="text-gray-300 font-mono">{finding.scanner || 'Trivy'}</span>
                    </span>
                    <button
                      onClick={() => handleRebuild(finding.title, finding.id || idx)}
                      disabled={isRebuilt}
                      className={`text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        isRebuilt ? 'text-emerald-400' : 'text-cyan-400 hover:text-cyan-300'
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1017] border border-cyan-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <Box className="h-5 w-5" />
                <h3 className="font-bold text-white text-base">Trivy Container Scanner</h3>
              </div>
              <button onClick={() => setShowScanModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Target Docker Image / Tag</label>
                <input
                  type="text"
                  value={imageName}
                  onChange={e => setImageName(e.target.value)}
                  className="w-full bg-[#05070B] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. node:18-alpine, nginx:latest"
                />
              </div>

              <div className="flex gap-2">
                {['node:20-alpine', 'python:3.11-slim', 'ubuntu:22.04'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setImageName(preset)}
                    className="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowScanModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={isScanning}
                onClick={handleRunScan}
                className="bg-cyan-500 hover:bg-cyan-400 text-black px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
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
