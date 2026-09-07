import React from "react"; 
import { useNavigate } from "react-router-dom";
import TopoField from "@/components/ui/topo-field";
import { VibeGuardLogo } from "@/components/ui/logo";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full min-h-screen bg-black text-[#FAFAFA] flex flex-col items-center overflow-x-hidden overflow-y-auto font-sans selection:bg-[#00E599] selection:text-black py-16 sm:py-24">
      
      {/* Animated Topo Field WebGL Background (Fixed) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <TopoField className="w-full h-full" opacity={0.7} speed={0.7} />
      </div>

      {/* Subtle vignette/gradient overlays for optimal typography contrast */}
      <div className="fixed inset-0 z-10 bg-gradient-to-b from-black/70 via-black/30 to-black/85 pointer-events-none" />
      <div className="fixed inset-0 z-10 bg-[radial-gradient(circle_at_50%_0%,transparent_0%,#000000_80%)] opacity-80 pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-20 w-full max-w-5xl px-6 flex flex-col items-center text-center">
        
        {/* Brand Shield Radar Emblem */}
        <div className="mb-6 flex items-center justify-center">
          <div className="p-3 rounded-2xl bg-black/60 border border-white/10 shadow-[0_0_30px_rgba(0,229,153,0.18)] backdrop-blur-xl hover:border-white/20 transition-all duration-300">
            <VibeGuardLogo size={42} />
          </div>
        </div>

        {/* Hero Headline */}
        <h1 className="font-light mb-6 leading-[1.05] tracking-tight text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] text-white drop-shadow-lg">
          One Security Score. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-200 to-neutral-400 font-extralight">
            Your Entire Stack.
          </span>
        </h1>
        
        {/* Hero Subtitle */}
        <p className="text-neutral-400 leading-relaxed mb-12 text-lg sm:text-xl font-light tracking-tight max-w-3xl mx-auto drop-shadow-md">
          Cloud & security orchestration that combines code, dependency, secrets, IaC, container, web, and cloud scanning into one deterministic security score.
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

        {/* Defensible Product Capability Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-16 w-full max-w-3xl pt-10 border-t border-white/10 backdrop-blur-sm">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-light text-white mb-1">
              7<span className="text-[#00E599]">+</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-neutral-400 font-medium">
              Security Scanners
            </div>
          </div>
          
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-light text-white mb-1">
              0–100
            </div>
            <div className="text-xs uppercase tracking-widest text-neutral-400 font-medium">
              Risk Score
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="font-mono text-3xl font-light text-white mb-1">
              A–F
            </div>
            <div className="text-xs uppercase tracking-widest text-neutral-400 font-medium">
              Security Grade
            </div>
          </div>
        </div>

        {/* Competitive Positioning & Entire Stack Coverage */}
        <div className="mt-28 w-full max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-6 text-xs font-mono text-neutral-300 uppercase tracking-wider">
            Full-Spectrum Application & Cloud Posture
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white mb-4">
            Don’t just review the code. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-200 to-neutral-400 font-extralight">
              Understand the security posture of the entire stack.
            </span>
          </h2>
          
          <p className="text-neutral-400 text-sm sm:text-base font-light max-w-2xl mx-auto mb-10 leading-relaxed">
            VibeGuard orchestrates deterministic security analysis across every architectural tier — preventing silos between source code, supply chain, and runtime infrastructure.
          </p>

          {/* Stack Tier Pills */}
          <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 mb-16">
            {[
              { tier: "Code", scanner: "Semgrep" },
              { tier: "Dependencies", scanner: "Trivy / npm-audit" },
              { tier: "Secrets", scanner: "Gitleaks" },
              { tier: "Containers", scanner: "Trivy" },
              { tier: "IaC", scanner: "Checkov" },
              { tier: "Web / APIs", scanner: "OWASP ZAP" },
              { tier: "Cloud", scanner: "Prowler" },
            ].map((item) => (
              <div
                key={item.tier}
                className="px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-light text-neutral-200 flex items-center gap-2 shadow-lg backdrop-blur-md"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E599]" />
                <span className="font-medium text-white">{item.tier}</span>
                <span className="text-neutral-500 font-mono text-[11px]">· {item.scanner}</span>
              </div>
            ))}
          </div>

          {/* Visual Orchestration Pipeline */}
          <div className="relative rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 sm:p-10 shadow-2xl text-left overflow-hidden">
            <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-8">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#00E599]">Pipeline Architecture</span>
                <h3 className="text-lg font-light text-white tracking-tight mt-0.5">Multi-Scanner Security Orchestration</h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400 border border-white/10 rounded-full px-2.5 py-0.5 bg-white/5">
                Deterministic
              </span>
            </div>

            {/* Pipeline Step Flow */}
            <div className="space-y-4">
              {/* Step 1: Ingestion */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs text-neutral-300">
                    01
                  </div>
                  <div>
                    <div className="text-sm font-light text-white">Repository & Infrastructure Workspace</div>
                    <div className="text-xs text-neutral-500 font-extralight">Git repository, infrastructure manifests, container registries, lockfiles</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">Target Input</span>
              </div>

              {/* Connector */}
              <div className="flex justify-center text-neutral-600">
                <span className="font-mono text-xs">↓</span>
              </div>

              {/* Step 2: Multi-Scanner Orchestration */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#00E599]/10 border border-[#00E599]/30 flex items-center justify-center font-mono text-xs text-[#00E599]">
                      02
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Security Orchestrator</div>
                      <div className="text-xs text-neutral-400 font-extralight">Parallel execution of specialized deterministic scanners</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[#00E599]">7+ Integrated Scanners</span>
                </div>
                
                {/* Scanner Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 pt-2 border-t border-white/[0.06]">
                  {["Trivy", "Semgrep", "Gitleaks", "Checkov", "npm-audit", "ZAP", "Prowler"].map((s) => (
                    <div key={s} className="px-2 py-1.5 bg-black/60 border border-white/[0.08] rounded-lg text-center font-mono text-[11px] text-neutral-300">
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Connector */}
              <div className="flex justify-center text-neutral-600">
                <span className="font-mono text-xs">↓</span>
              </div>

              {/* Step 3: Normalization & Deduplication */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs text-neutral-300">
                    03
                  </div>
                  <div>
                    <div className="text-sm font-light text-white">Normalize + Deduplicate</div>
                    <div className="text-xs text-neutral-500 font-extralight">SARIF standard output conversion, false-positive filtering, cross-scanner deduplication</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">Unified Schema</span>
              </div>

              {/* Connector */}
              <div className="flex justify-center text-neutral-600">
                <span className="font-mono text-xs">↓</span>
              </div>

              {/* Step 4: Deterministic Risk Engine */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs text-neutral-300">
                    04
                  </div>
                  <div>
                    <div className="text-sm font-light text-white">Deterministic Risk Engine</div>
                    <div className="text-xs text-neutral-500 font-extralight">Mathematical severity-weighted risk scoring algorithm across all findings</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">Deterministic Math</span>
              </div>

              {/* Connector */}
              <div className="flex justify-center text-neutral-600">
                <span className="font-mono text-xs">↓</span>
              </div>

              {/* Step 5: Unified Posture Score & Remediation */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-white/[0.04] via-black to-white/[0.04] border border-[#00E599]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center px-4 py-2.5 rounded-xl bg-[#00E599]/10 border border-[#00E599]/30">
                    <span className="font-mono text-2xl font-bold text-[#00E599]">82</span>
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Score / 100</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">Unified Security Posture</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Grade B</span>
                    </div>
                    <div className="text-xs text-neutral-400 font-extralight mt-0.5">
                      Deterministic posture score with optional AI-assisted code remediation diffs
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-neutral-500 italic">
                  * Illustrative output example
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info note */}
        <div className="mt-20 pt-8 border-t border-white/10 w-full max-w-3xl flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 font-light gap-2">
          <span>VibeGuard · Cloud & Security Orchestration</span>
          <span className="font-mono text-[11px] text-neutral-600">Deterministic Scoring · Multi-Scanner Analysis</span>
        </div>
      </div>
    </div>
  );
}
