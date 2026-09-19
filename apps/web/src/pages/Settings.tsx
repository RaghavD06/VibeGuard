import { useState } from 'react';
import { Settings as SettingsIcon, Key, Bell, Users, Database, Copy } from 'lucide-react';

export function Settings() {
  const [activeTab, setActiveTab] = useState<'keys' | 'team' | 'notifications' | 'retention'>('keys');
  const [apiKey] = useState('Not configured');


  return (
    <div className="max-w-4xl space-y-8">
      <div className="border-b border-white/10 pb-6">
        <h2 className="text-2xl font-light text-white flex items-center gap-3 tracking-tight">
          <SettingsIcon className="h-6 w-6 text-[#00E599]" />
          Workspace Settings
        </h2>
        <p className="text-xs text-neutral-400 mt-1 font-extralight">Account settings. Team, alert, and retention controls are not configured yet.</p>
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
                      disabled
                      className="px-4 py-2 bg-white/10 text-neutral-500 rounded-xl text-xs font-mono flex items-center gap-1.5 border border-white/10"
                    >
                      <Copy className="h-3.5 w-3.5" /> Unavailable
                    </button>
                  </div>
                </div>
                
                <div className="pt-4 mt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-[11px] text-neutral-500 font-mono">API key management is not configured.</span>
                  <button 
                    disabled
                    className="text-xs text-neutral-500 font-mono flex items-center gap-1"
                  >
                    Revoke & Generate New Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60">
              <h3 className="text-base font-medium text-white mb-1">Team Members & RBAC</h3>
              <p className="text-xs text-neutral-400 mb-6 font-light">Membership management is not available in this dashboard.</p>

              <button 
                disabled
                className="mt-6 w-full py-2.5 bg-white/10 text-neutral-500 border border-white/15 rounded-full text-xs font-medium"
              >
                + Invite Collaborator
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60">
              <h3 className="text-base font-medium text-white mb-1">Security Alerts</h3>
              <p className="text-xs text-neutral-400 mb-6 font-light">Alert delivery is not configured. These controls are unavailable.</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-medium text-white">Email Digest on Critical CVEs</h4>
                    <p className="text-[11px] text-neutral-400 font-light">Send instant alert to workspace owners.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
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
                    checked={false}
                    disabled
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
                    checked={false}
                    disabled
                    className="h-4 w-4 rounded bg-black border-white/20 accent-[#00E599] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'retention' && (
            <div className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60">
              <h3 className="text-base font-medium text-white mb-1">Audit Log Data Retention</h3>
              <p className="text-xs text-neutral-400 mb-6 font-light">Automated data retention is not configured.</p>

              <div>
                <label className="block text-xs font-light text-neutral-400 mb-2">Retention Duration</label>
                <select
                  value="90"
                  disabled
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
