import React from "react"; 
import { useNavigate } from "react-router-dom";
import TopoField from "@/components/ui/topo-field";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full min-h-screen bg-black text-[#FAFAFA] flex flex-col items-center justify-center overflow-hidden font-sans">
      
      {/* Animated Topo Field WebGL Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <TopoField className="w-full h-full" opacity={0.75} speed={0.8} />
      </div>

      {/* Subtle vignette/gradient overlay for optimal typography contrast */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

      {/* Hero Content */}
      <div className="relative z-20 w-full max-w-5xl px-6 flex flex-col items-center text-center">
        
        {/* Eyebrow / Tag */}
        <div className="mb-6 px-4 py-1.5 border border-white/10 bg-white/5 backdrop-blur-md text-[#00E599] font-mono text-xs font-semibold tracking-wider uppercase rounded-full flex items-center gap-2 shadow-lg shadow-black/40">
          <span className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse" />
          VibeGuard Security Scanner
        </div>

        <h1 className="font-light mb-6 leading-[1.05] tracking-tight text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] text-white drop-shadow-lg">
          Understand Any <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-200 to-neutral-500 font-extralight">
            Codebase Instantly.
          </span>
        </h1>
        
        <p className="text-neutral-400 leading-relaxed mb-12 text-lg sm:text-xl font-light tracking-tight max-w-2xl mx-auto drop-shadow-md">
          Next-gen AI-Powered DevSecOps Orchestrator with real-time risk scoring, deterministic scanners, and instant code remediation. 
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto mb-16">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-8 py-3.5 bg-white hover:bg-neutral-200 text-black font-medium tracking-tight transition-all duration-300 rounded-full hover:scale-105 hover:shadow-xl hover:shadow-white/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            Launch Dashboard
          </button>
          
          <button
            onClick={() => window.open('https://github.com/Maverickrd007/VibeGuard', '_blank')}
            className="px-8 py-3.5 bg-black/40 backdrop-blur-md border border-white/20 text-[#FAFAFA] hover:border-white/40 hover:bg-white/5 font-medium tracking-tight transition-all duration-300 rounded-full hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            View Documentation
          </button>
        </div>

        {/* Tech Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-16 w-full max-w-3xl pt-10 border-t border-white/10 backdrop-blur-sm">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-bold text-[#FAFAFA] mb-1">
              3.2M<span className="text-[#00E599]">+</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-neutral-400 font-semibold">
              Lines Scanned / Sec
            </div>
          </div>
          
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-bold text-[#FAFAFA] mb-1">
              0.8<span className="text-[#00E599]">s</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-neutral-400 font-semibold">
              Mean Time to Fix
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-bold text-[#FAFAFA] mb-1">
              0<span className="text-[#00E599]">.0</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-neutral-400 font-semibold">
              Zero-Day Exposure
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
