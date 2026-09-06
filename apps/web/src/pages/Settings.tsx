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
    <div className="max-w-4xl">
      <div className="mb-8 border-b border-gray-800 pb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <SettingsIcon className="h-7 w-7 text-gray-400" />
          Workspace Settings
        </h2>
        <p className="text-xs text-gray-400 mt-1">Configure global authentication, team members, alerts, and audit logs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left navigation tabs */}
        <div className="col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab('keys')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              activeTab === 'keys' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'text-gray-400 hover:bg-gray-800/40 hover:text-white'
            }`}
          >
            <Key className="h-4 w-4" /> API Keys
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              activeTab === 'team' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'text-gray-400 hover:bg-gray-800/40 hover:text-white'
            }`}
          >
            <Users className="h-4 w-4" /> Team Access
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              activeTab === 'notifications' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'text-gray-400 hover:bg-gray-800/40 hover:text-white'
            }`}
          >
            <Bell className="h-4 w-4" /> Notifications
          </button>
          <button
            onClick={() => setActiveTab('retention')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              activeTab === 'retention' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'text-gray-400 hover:bg-gray-800/40 hover:text-white'
            }`}
          >
            <Database className="h-4 w-4" /> Data Retention
          </button>
        </div>

        {/* Right Tab Content */}
        <div className="col-span-2">
          {activeTab === 'keys' && (
            <div className="bg-[#0D1017] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">API Authentication</h3>
              <p className="text-xs text-gray-400 mb-6">
                Use this API key to authenticate the VibeGuard CLI in your terminal and CI/CD pipelines (GitHub Actions, GitLab CI).
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">VIBEGUARD_API_KEY</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={apiKey} 
                      readOnly 
                      className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none"
                    />
                    <button 
                      onClick={handleCopy}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                
                <div className="pt-4 mt-4 border-t border-gray-800 flex justify-between items-center">
                  <span className="text-[11px] text-gray-500">Key created: Today (Active)</span>
                  <button 
                    disabled={isGenerating}
                    onClick={handleRevoke}
                    className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    {isGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                    Revoke & Generate New Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="bg-[#0D1017] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Team Members & RBAC</h3>
              <p className="text-xs text-gray-400 mb-6">Manage roles and permissions for developers and security auditors.</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-black/40 border border-gray-800 rounded-lg">
                  <div>
                    <div className="text-xs font-semibold text-white">Owner</div>
                    <div className="text-[11px] text-gray-500">Full workspace administrator privileges</div>
                  </div>
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded font-bold">YOU</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-black/40 border border-gray-800 rounded-lg">
                  <div>
                    <div className="text-xs font-semibold text-white">CI/CD Service Account</div>
                    <div className="text-[11px] text-gray-500">Telemetry upload access from GitHub Actions runners</div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">SERVICE</span>
                </div>
              </div>

              <button 
                onClick={() => toast.success('Invite link copied!', { description: 'Share this link with your team member to grant access.' })}
                className="mt-6 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                + Invite Collaborator
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-[#0D1017] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Security Alerts</h3>
              <p className="text-xs text-gray-400 mb-6">Configure where alerts are dispatched when Critical vulnerabilities are detected.</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Email Digest on Critical CVEs</h4>
                    <p className="text-[11px] text-gray-500">Send instant alert to workspace owners.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={e => {
                      setEmailAlerts(e.target.checked);
                      toast.success(e.target.checked ? 'Email alerts enabled' : 'Email alerts disabled');
                    }}
                    className="h-4 w-4 rounded bg-gray-800 border-gray-700 text-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                  <div>
                    <h4 className="text-xs font-bold text-white">Slack / Discord Webhook</h4>
                    <p className="text-[11px] text-gray-500">Dispatch JSON webhook to #sec-alerts channel.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={slackAlerts}
                    onChange={e => {
                      setSlackAlerts(e.target.checked);
                      toast.success(e.target.checked ? 'Slack webhook enabled' : 'Slack webhook disabled');
                    }}
                    className="h-4 w-4 rounded bg-gray-800 border-gray-700 text-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                  <div>
                    <h4 className="text-xs font-bold text-white">Block PRs on Policy Violation</h4>
                    <p className="text-[11px] text-gray-500">Fail GitHub Actions checks if Critical or High severity findings are found.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prBlocking}
                    onChange={e => {
                      setPrBlocking(e.target.checked);
                      toast.success(e.target.checked ? 'PR blocking enabled' : 'PR blocking disabled');
                    }}
                    className="h-4 w-4 rounded bg-gray-800 border-gray-700 text-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'retention' && (
            <div className="bg-[#0D1017] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Audit Log Data Retention</h3>
              <p className="text-xs text-gray-400 mb-6">Set data retention periods for historical scans and finding records.</p>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Retention Duration</label>
                <select
                  value={retentionDays}
                  onChange={e => {
                    setRetentionDays(e.target.value);
                    toast.success(`Data retention policy set to ${e.target.value} days`);
                  }}
                  className="w-full bg-[#05070B] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="30">30 Days (Standard)</option>
                  <option value="90">90 Days (Recommended for SOC2)</option>
                  <option value="180">180 Days (Enterprise)</option>
                  <option value="365">365 Days (Compliance Audit)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
