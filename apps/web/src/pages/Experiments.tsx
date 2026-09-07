import { FlaskConical, Bot, Zap, Network } from 'lucide-react';

export function Experiments() {
  const experiments = [
    { id: 'ai-remediation', name: 'Auto-Remediation (VG-AI)', desc: 'Automatically generate pull requests with code fixes for SAST vulnerabilities.', icon: Bot, enabled: true },
    { id: 'real-time', name: 'Real-time IDE Sync', desc: 'Stream telemetry directly from developers VS Code extensions to this dashboard.', icon: Zap, enabled: true },
    { id: 'custom-rules', name: 'Custom Semgrep Rulesets', desc: 'Enforce organization-specific security rules using custom YAML definitions.', icon: Network, enabled: false },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-light text-white flex items-center gap-3 tracking-tight">
          <FlaskConical className="h-6 w-6 text-[#00E599]" />
          Experimental Features
        </h2>
        <p className="text-neutral-400 mt-1 text-xs font-extralight">Opt-in to beta features to supercharge your DevSecOps pipeline.</p>
      </div>

      <div className="space-y-4">
        {experiments.map(exp => (
          <div key={exp.id} className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60 flex items-center justify-between hover:border-[#00E599]/30 transition-all">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl border ${exp.enabled ? 'bg-[#00E599]/10 text-[#00E599] border-[#00E599]/30' : 'bg-white/5 text-neutral-500 border-white/10'}`}>
                <exp.icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-0.5">{exp.name}</h4>
                <p className="text-xs text-neutral-400 font-light">{exp.desc}</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked={exp.enabled} />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/20 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00E599]"></div>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
