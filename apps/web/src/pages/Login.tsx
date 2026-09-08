import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VibeGuardLogo } from '../components/ui/logo';
import TopoField from '../components/ui/topo-field';
import { Lock, Mail, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Invalid credentials');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex items-center justify-center p-6 selection:bg-[#00E599] selection:text-black overflow-hidden">
      {/* Topo Field Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <TopoField className="w-full h-full" opacity={0.7} speed={0.5} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/80">
        <div className="flex flex-col items-center text-center mb-8">
          <Link to="/" className="flex items-center gap-2 mb-4 group">
            <VibeGuardLogo size={32} className="transition-transform group-hover:scale-110" />
            <span className="font-light tracking-wider text-xl text-white">VIBE</span>
            <span className="text-[#00E599] font-bold text-xl ml-0.5">GUARD</span>
          </Link>
          <h2 className="text-xl font-light text-white tracking-tight">Welcome Back</h2>
          <p className="text-xs text-neutral-400 font-light mt-1">
            Sign in to access your security posture dashboard
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-black/50 border border-white/15 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00E599] transition-colors font-light"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-black/50 border border-white/15 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00E599] transition-colors font-light"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-[#00E599] hover:bg-[#00c985] text-black font-medium text-xs py-3 rounded-2xl shadow-lg shadow-[#00E599]/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Sign In <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-neutral-400 font-light">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#00E599] hover:underline font-normal">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
