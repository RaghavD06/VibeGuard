import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderGit2, Activity, ShieldAlert, PackageSearch, KeyRound, Box, FileCode2, TestTube2, FileText, Settings, LogOut } from 'lucide-react';
import TopoField from './ui/topo-field';
import { VibeGuardLogo } from './ui/logo';

import { useRepo } from '../context/RepoContext';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { repositories, selectedRepo, setSelectedRepo } = useRepo();
  const { user, logout } = useAuth();
  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Repositories', path: '/repositories', icon: FolderGit2 },
    { name: 'Scans', path: '/scans', icon: Activity },
    { name: 'Findings', path: '/findings', icon: ShieldAlert },
    { name: 'Dependencies', path: '/dependencies', icon: PackageSearch },
    { name: 'Secrets', path: '/secrets', icon: KeyRound },
    { name: 'Containers', path: '/containers', icon: Box },
    { name: 'IaC', path: '/iac', icon: FileCode2 },
    { name: 'Experiments', path: '/experiments', icon: TestTube2 },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="relative flex h-screen bg-black text-white font-sans selection:bg-[#00E599] selection:text-black overflow-hidden">
      {/* Topo Field Animated Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <TopoField className="w-full h-full" opacity={0.65} speed={0.5} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      </div>

      {/* Translucent Glass Sidebar */}
      <aside className="relative z-20 w-64 bg-black/40 backdrop-blur-2xl border-r border-white/10 text-white flex flex-col hidden md:flex">
        <NavLink to="/" className="h-16 flex items-center px-6 font-light text-lg tracking-wider border-b border-white/10 hover:text-[#00E599] transition-colors group">
          <VibeGuardLogo size={24} className="mr-3 transition-transform group-hover:scale-110" />
          <span className="font-light tracking-tight text-white">VIBE</span>
          <span className="text-[#00E599] font-bold ml-0.5">GUARD</span>
        </NavLink>
        <nav className="flex-1 overflow-y-auto py-5">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-3.5 py-2.5 text-sm font-light rounded-xl transition-all ${
                      isActive
                        ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.06)] font-normal'
                        : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                    }`
                  }
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
        {/* Translucent Glass Topbar */}
        <header className="h-16 bg-black/30 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-light text-white tracking-wide uppercase hidden sm:block">Security Dashboard</h2>

            {/* Repository Filter Selector */}
            <div className="flex items-center gap-2 bg-black/60 border border-white/15 rounded-full px-3.5 py-1.5 backdrop-blur-md shadow-inner">
              <FolderGit2 className="h-3.5 w-3.5 text-[#00E599]" />
              <span className="text-xs text-neutral-400 font-light hidden lg:inline">Repository:</span>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="bg-transparent text-xs font-light text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-[#050505] text-white">All Repositories</option>
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.name} className="bg-[#050505] text-white">
                    {repo.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 bg-black/60 border border-white/15 rounded-full px-3 py-1 backdrop-blur-md">
                  <div className="w-5 h-5 rounded-full bg-[#00E599]/20 border border-[#00E599]/40 flex items-center justify-center text-[#00E599] text-[10px] font-mono font-bold">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-light text-neutral-300 max-w-[140px] truncate hidden sm:inline">
                    {user.name || user.email}
                  </span>
                </div>
                <button
                  onClick={logout}
                  title="Sign out of VibeGuard"
                  className="p-1.5 rounded-full bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="text-xs px-3.5 py-1.5 rounded-full bg-[#00E599] text-black font-medium hover:bg-[#00c985] transition-all"
              >
                Sign In
              </NavLink>
            )}
          </div>
        </header>


        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-8 bg-transparent">
          {children}
        </main>
      </div>
    </div>
  );
}
