import { fetchApi } from '../config';
import { useRepo } from '../context/RepoContext';
import { ShieldAlert, CheckCircle, AlertTriangle, Activity, Terminal, ExternalLink, FolderGit2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NavLink } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';

export function Overview() {
  const { selectedRepo, setSelectedRepo } = useRepo();
  const [scans, setScans] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);

  useEffect(() => {
    fetchApi('/api/scans')
      .then(res => res.json())
      .then(data => setScans(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetchApi('/api/findings')
      .then(res => res.json())
      .then(data => setFindings(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const filteredScans = useMemo(() => {
    if (selectedRepo === 'all') return scans;
    return scans.filter(s => s.repository?.name === selectedRepo);
  }, [scans, selectedRepo]);

  const filteredFindings = useMemo(() => {
    if (selectedRepo === 'all') return findings;
    return findings.filter(f => f.scan?.repository?.name === selectedRepo);
  }, [findings, selectedRepo]);

  const stats = useMemo(() => {
    let c = 0, h = 0, m = 0, l = 0;
    filteredFindings.forEach((f: any) => {
      const s = (f.severity || '').toUpperCase();
      if (s === 'CRITICAL') c++;
      else if (s === 'HIGH') h++;
      else if (s === 'MEDIUM') m++;
      else l++;
    });

    const latest = filteredScans[0];
    return {
      critical: c,
      high: h,
      medium: m,
      low: l,
      totalScans: filteredScans.length,
      grade: latest?.score || 'A',
      score: latest?.numericScore ?? (c === 0 && h === 0 ? 100 : Math.max(20, 100 - c * 25 - h * 10))
    };
  }, [filteredFindings, filteredScans]);

  const chartData = useMemo(() => {
    const grouped = filteredFindings.reduce((acc: any, f: any) => {
      const date = new Date(f.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
      if (!acc[date]) acc[date] = { name: date, critical: 0, high: 0, medium: 0, low: 0 };
      const s = (f.severity || '').toUpperCase();
      if (s === 'CRITICAL') acc[date].critical++;
      else if (s === 'HIGH') acc[date].high++;
      else if (s === 'MEDIUM') acc[date].medium++;
      else acc[date].low++;
      return acc;
    }, {});

    const cData = Object.values(grouped);
    if (cData.length === 0) {
      return [
        { name: 'Mon', critical: 0, high: 0, medium: 0, low: 0 },
        { name: 'Tue', critical: 0, high: 0, medium: 0, low: 0 },
      ];
    }
    return cData;
  }, [filteredFindings]);

  return (
    <div className="space-y-8">
      {/* Active Repository Indicator */}
      {selectedRepo !== 'all' && (
        <div className="bg-black/50 border border-white/15 rounded-2xl px-5 py-3.5 flex items-center justify-between backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-2.5 text-sm text-neutral-300">
            <FolderGit2 className="h-4 w-4 text-[#00E599]" />
            <span className="font-light">Filtering telemetry for repository: <strong className="text-white font-medium">{selectedRepo}</strong></span>
          </div>
          <button
            onClick={() => setSelectedRepo('all')}
            className="text-xs text-[#00E599] hover:underline cursor-pointer font-light"
          >
            Show All Repositories
          </button>
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Security Score */}
        <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/60 relative overflow-hidden group hover:border-[#00E599]/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-[#00E599]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-[#00E599]/10 border border-[#00E599]/20 rounded-xl p-3">
              <CheckCircle className="h-6 w-6 text-[#00E599]" />
            </div>
            <div className="ml-4 w-0 flex-1">
              <dt className="text-xs font-light text-neutral-400 uppercase tracking-widest">Security Score</dt>
              <dd className="text-2xl font-bold text-white mt-1">
                {stats.grade.replace(' RISK', '')} <span className="text-sm font-normal text-[#00E599]">({stats.score}/100)</span>
              </dd>
            </div>
          </div>
        </div>

        {/* Critical / High */}
        <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/60 relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
              <ShieldAlert className="h-6 w-6 text-rose-400" />
            </div>
            <div className="ml-4 w-0 flex-1">
              <dt className="text-xs font-light text-neutral-400 uppercase tracking-widest">Critical / High</dt>
              <dd className="text-2xl font-bold text-white mt-1">
                {stats.critical} <span className="text-sm font-normal text-neutral-500">/ {stats.high}</span>
              </dd>
            </div>
          </div>
        </div>

        {/* Medium / Low */}
        <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/60 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <div className="ml-4 w-0 flex-1">
              <dt className="text-xs font-light text-neutral-400 uppercase tracking-widest">Medium / Low</dt>
              <dd className="text-2xl font-bold text-white mt-1">
                {stats.medium} <span className="text-sm font-normal text-neutral-500">/ {stats.low}</span>
              </dd>
            </div>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/60 relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3">
              <Activity className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="ml-4 w-0 flex-1">
              <dt className="text-xs font-light text-neutral-400 uppercase tracking-widest">Total Scans</dt>
              <dd className="text-2xl font-bold text-white mt-1">{stats.totalScans}</dd>
            </div>
          </div>
        </div>
      </div>

      {/* CLI Quick Trigger Callout */}
      <div className="bg-gradient-to-r from-black/60 via-white/[0.02] to-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#00E599]">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white tracking-tight">Trigger CLI Security Scan</h4>
            <p className="text-xs text-neutral-400 font-light">Run local scan and stream telemetry directly to this dashboard.</p>
          </div>
        </div>
        <div className="bg-black/80 border border-white/15 rounded-full px-5 py-2.5 text-xs font-mono text-[#00E599] flex items-center gap-2 shadow-inner">
          <span>npx @maverick006/vibeguard@latest scan .</span>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-black/45 backdrop-blur-xl shadow-2xl shadow-black/60 rounded-2xl border border-white/10 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-base font-light tracking-tight text-white">Security Vulnerability Trends</h3>
            <p className="text-xs text-neutral-400 font-extralight mt-0.5">7-day telemetry breakdown across all integrated deterministic scanners.</p>
          </div>
          <NavLink
            to="/findings"
            className="text-xs text-neutral-300 hover:text-white font-light rounded-full border border-white/15 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-1.5"
          >
            View All Findings <ExternalLink className="h-3.5 w-3.5" />
          </NavLink>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="lowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#050505', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }}
              />
              <Area type="monotone" dataKey="critical" stackId="1" stroke="#EF4444" fill="url(#criticalGrad)" />
              <Area type="monotone" dataKey="high" stackId="1" stroke="#F97316" fill="url(#highGrad)" />
              <Area type="monotone" dataKey="medium" stackId="1" stroke="#F59E0B" fill="url(#medGrad)" />
              <Area type="monotone" dataKey="low" stackId="1" stroke="#06B6D4" fill="url(#lowGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
