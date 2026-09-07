import React from "react"; 
import { useNavigate } from "react-router-dom";
import { ShaderBackground } from "@/components/ui/animated-shader-hero";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full min-h-screen bg-black text-[#FAFAFA] flex flex-col items-center justify-center overflow-hidden font-sans">
      
      {/* Animated WebGL Shader Background */}
      <ShaderBackground className="opacity-80" />

      {/* Subtle vignette/gradient overlay for optimal typography contrast */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

      {/* Hero Content */}
      <div className="relative z-20 w-full max-w-5xl px-6 flex flex-col items-center text-center">
        
        {/* Eyebrow / Tag */}
        <div className="mb-6 px-4 py-1.5 border border-orange-500/30 bg-black/60 backdrop-blur-md text-[#00E599] font-mono text-xs font-semibold tracking-wider uppercase rounded-full flex items-center gap-2 shadow-lg shadow-orange-500/10">
          <span className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse" />
          VibeGuard Security Scanner
        </div>

        <h1 className="font-bold mb-6 leading-[1.05] tracking-tighter text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] text-white drop-shadow-lg">
          Understand Any <br />
          <span className="bg-gradient-to-r from-orange-400 via-yellow-300 to-amber-200 bg-clip-text text-transparent">
            Codebase Instantly.
          </span>
        </h1>
        
        <p className="text-zinc-300 leading-relaxed mb-12 text-lg sm:text-xl font-medium tracking-tight max-w-2xl mx-auto drop-shadow-md">
          Next-gen AI-Powered DevSecOps Orchestrator with real-time risk scoring, deterministic scanners, and instant code remediation. 
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto mb-16">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-black font-semibold tracking-tight transition-all duration-300 rounded-full hover:scale-105 hover:shadow-xl hover:shadow-orange-500/25 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            Launch Dashboard
          </button>
          
          <button
            onClick={() => window.open('https://github.com/Maverickrd007/VibeGuard', '_blank')}
            className="px-8 py-3.5 bg-black/50 backdrop-blur-md border border-zinc-700 text-[#FAFAFA] hover:border-orange-400/50 hover:bg-orange-500/10 font-semibold tracking-tight transition-all duration-300 rounded-full hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-600"
          >
            View Documentation
          </button>
        </div>

        {/* Tech Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-16 w-full max-w-3xl pt-10 border-t border-zinc-800/80 backdrop-blur-sm">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-bold text-[#FAFAFA] mb-1">
              3.2M<span className="text-orange-400">+</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              Lines Scanned / Sec
            </div>
          </div>
          
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-bold text-[#FAFAFA] mb-1">
              0.8<span className="text-orange-400">s</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              Mean Time to Fix
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-bold text-[#FAFAFA] mb-1">
              0<span className="text-orange-400">.0</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
              Zero-Day Exposure
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
