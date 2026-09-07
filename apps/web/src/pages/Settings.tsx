import { useState } from 'react';
import { Settings as SettingsIcon, Key, Bell, Users, Database, Copy, Check, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function Settings() {
  const [activeTab, setActiveTab] = useState<'keys' | 'team' | 'notifications' | 'retention'>('keys');
  const [apiKey, setApiKey] = useState('vg_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Notifications state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(false);
  const [prBlocking, setPrBlocking] = useState(true);

  // Retention state
  const [retentionDays, setRetentionDays] = useState('90');

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('API Key copied to clipboard!');
  };

  const handleRevoke = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newKey = 'vg_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      setApiKey(newKey);
      setIsGenerating(false);
      toast.success('New API Key Generated!', {
        description: 'Previous key has been revoked from all active CI runners.'
      });
    }, 800);
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div className="border-b border-white/10 pb-6">
        <h2 className="text-2xl font-light text-white flex items-center gap-3 tracking-tight">
          <SettingsIcon className="h-6 w-6 text-[#00E599]" />
          Workspace Settings
        </h2>
        <p className="text-xs text-neutral-400 mt-1 font-extralight">Configure global authentication, team members, alerts, and audit logs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left navigation tabs */}
        <div className="col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab('keys')}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-light flex items-center gap-3 transition-colors cursor-pointer ${
              activeTab === 'keys' ? 'bg-white/10 text-white border border-white/20 font-normal' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
            }`}
          >
            <Key className="h-4 w-4 text-[#00E599]" /> API Keys
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-light flex items-center gap-3 transition-colors cursor-pointer ${
              activeTab === 'team' ? 'bg-white/10 text-white border border-white/20 font-normal' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
            }`}
          >
            <Users className="h-4 w-4 text-[#00E599]" /> Team Access
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-light flex items-center gap-3 transition-colors cursor-pointer ${
              activeTab === 'notifications' ? 'bg-white/10 text-white border border-white/20 font-normal' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
            }`}
          >
            <Bell className="h-4 w-4 text-[#00E599]" /> Notifications
          </button>
          <button
            onClick={() => setActiveTab('retention')}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-light flex items-center gap-3 transition-colors cursor-pointer ${
              activeTab === 'retention' ? 'bg-white/10 text-white border border-white/20 font-normal' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
            }`}
          >
            <Database className="h-4 w-4 text-[#00E599]" /> Data Retention
          </button>
        </div>

        {/* Right Tab Content */}
        <div className="col-span-2">
          {activeTab === 'keys' && (
            <div className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60">
              <h3 className="text-base font-medium text-white mb-1">API Authentication</h3>
              <p className="text-xs text-neutral-400 mb-6 font-light">
                Use this API key to authenticate the VibeGuard CLI in your terminal and CI/CD pipelines (GitHub Actions, GitLab CI).
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-light text-neutral-400 mb-1.5 font-mono">VIBEGUARD_API_KEY</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={apiKey} 
                      readOnly 
                      className="flex-1 bg-black border border-white/15 rounded-xl px-3.5 py-2 text-xs text-[#00E599] font-mono focus:outline-none"
                    />
                    <button 
                      onClick={handleCopy}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer border border-white/10"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-[#00E599]" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                
                <div className="pt-4 mt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-[11px] text-neutral-500 font-mono">Key created: Today (Active)</span>
                  <button 
                    disabled={isGenerating}
                    onClick={handleRevoke}
                    className="text-xs text-red-400 hover:underline font-mono cursor-pointer flex items-center gap-1"
                  >
                    {isGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                    Revoke & Generate New Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60">
              <h3 className="text-base font-medium text-white mb-1">Team Members & RBAC</h3>
              <p className="text-xs text-neutral-400 mb-6 font-light">Manage roles and permissions for developers and security auditors.</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-black/60 border border-white/10 rounded-xl">
                  <div>
                    <div className="text-xs font-medium text-white">Owner</div>
                    <div className="text-[11px] text-neutral-400 font-light">Full workspace administrator privileges</div>
                  </div>
                  <span className="text-[10px] bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30 px-2.5 py-0.5 rounded-full font-mono font-medium">YOU</span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-black/60 border border-white/10 rounded-xl">
                  <div>
                    <div className="text-xs font-medium text-white">CI/CD Service Account</div>
                    <div className="text-[11px] text-neutral-400 font-light">Telemetry upload access from GitHub Actions runners</div>
                  </div>
                  <span className="text-[10px] bg-white/10 text-neutral-300 border border-white/15 px-2.5 py-0.5 rounded-full font-mono font-medium">SERVICE</span>
                </div>
              </div>

              <button 
                onClick={() => toast.success('Invite link copied!', { description: 'Share this link with your team member to grant access.' })}
                className="mt-6 w-full py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-full text-xs font-medium transition-colors cursor-pointer"
              >
                + Invite Collaborator
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60">
              <h3 className="text-base font-medium text-white mb-1">Security Alerts</h3>
              <p className="text-xs text-neutral-400 mb-6 font-light">Configure where alerts are dispatched when Critical vulnerabilities are detected.</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-medium text-white">Email Digest on Critical CVEs</h4>
                    <p className="text-[11px] text-neutral-400 font-light">Send instant alert to workspace owners.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={e => {
                      setEmailAlerts(e.target.checked);
                      toast.success(e.target.checked ? 'Email alerts enabled' : 'Email alerts disabled');
                    }}
                    className="h-4 w-4 rounded bg-black border-white/20 accent-[#00E599] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <div>
                    <h4 className="text-xs font-medium text-white">Slack / Discord Webhook</h4>
                    <p className="text-[11px] text-neutral-400 font-light">Dispatch JSON webhook to #sec-alerts channel.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={slackAlerts}
                    onChange={e => {
                      setSlackAlerts(e.target.checked);
                      toast.success(e.target.checked ? 'Slack webhook enabled' : 'Slack webhook disabled');
                    }}
                    className="h-4 w-4 rounded bg-black border-white/20 accent-[#00E599] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <div>
                    <h4 className="text-xs font-medium text-white">Block PRs on Policy Violation</h4>
                    <p className="text-[11px] text-neutral-400 font-light">Fail GitHub Actions checks if Critical or High severity findings are found.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prBlocking}
                    onChange={e => {
                      setPrBlocking(e.target.checked);
                      toast.success(e.target.checked ? 'PR blocking enabled' : 'PR blocking disabled');
                    }}
                    className="h-4 w-4 rounded bg-black border-white/20 accent-[#00E599] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'retention' && (
            <div className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60">
              <h3 className="text-base font-medium text-white mb-1">Audit Log Data Retention</h3>
              <p className="text-xs text-neutral-400 mb-6 font-light">Set data retention periods for historical scans and finding records.</p>

              <div>
                <label className="block text-xs font-light text-neutral-400 mb-2">Retention Duration</label>
                <select
                  value={retentionDays}
                  onChange={e => {
                    setRetentionDays(e.target.value);
                    toast.success(`Data retention policy set to ${e.target.value} days`);
                  }}
                  className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00E599] cursor-pointer"
                >
                  <option value="30" className="bg-[#050505] text-white">30 Days (Standard)</option>
                  <option value="90" className="bg-[#050505] text-white">90 Days (Recommended for SOC2)</option>
                  <option value="180" className="bg-[#050505] text-white">180 Days (Enterprise)</option>
                  <option value="365" className="bg-[#050505] text-white">365 Days (Compliance Audit)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
