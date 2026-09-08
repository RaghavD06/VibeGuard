import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-[#00E599] animate-spin"></div>
          <ShieldAlert className="w-5 h-5 text-[#00E599] absolute inset-0 m-auto" />
        </div>
        <span className="mt-4 text-xs font-mono text-neutral-400 tracking-widest uppercase animate-pulse">
          Authenticating VibeGuard Session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
