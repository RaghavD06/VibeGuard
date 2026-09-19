import { Shield } from "lucide-react";

export const Component = () => {
  return (
    <main className="hero-section w-full h-full absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      <div className="glyph-field absolute inset-0 flex items-center justify-center opacity-30">
        <div className="glyph-container glyph-1 absolute w-[300px] h-[300px] border border-cyan-500/10 rounded-full">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
          <div className="glyph-part part-3"></div>
        </div>

        <div className="glyph-container glyph-2 absolute w-[450px] h-[450px] border border-blue-500/10 rounded-full">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
        </div>

        <div className="glyph-container glyph-3 absolute w-[600px] h-[600px] border border-emerald-500/10 rounded-full">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
          <div className="glyph-part part-3"></div>
        </div>
      </div>

      <div className="orrery-field absolute inset-0 flex items-center justify-center">
        <div className="orbit orbit-1 absolute w-[300px] h-[300px] border border-cyan-500/20 rounded-full animate-[orbit-rotate_20s_linear_infinite]">
          <div className="security-shield absolute -top-[13px] left-1/2 -translate-x-1/2 text-cyan-400 bg-black rounded-full p-0.5">
            <Shield size={14} strokeWidth={1.8} />
          </div>
        </div>

        <div className="orbit orbit-2 absolute w-[450px] h-[450px] border border-blue-500/20 rounded-full animate-[orbit-rotate_35s_linear_infinite_reverse]">
          <div className="security-shield absolute top-1/2 -right-[13px] -translate-y-1/2 text-blue-400 bg-black rounded-full p-0.5">
            <Shield size={12} strokeWidth={1.8} />
          </div>
        </div>

        <div className="orbit orbit-3 absolute w-[600px] h-[600px] border border-emerald-500/20 rounded-full animate-[orbit-rotate_50s_linear_infinite]">
          <div className="security-shield absolute -bottom-[13px] left-1/2 -translate-x-1/2 text-emerald-400 bg-black rounded-full p-0.5">
            <Shield size={15} strokeWidth={1.8} />
          </div>
        </div>

        <div className="orbit orbit-4 absolute w-[750px] h-[750px] border border-indigo-500/10 rounded-full animate-[orbit-rotate_65s_linear_infinite_reverse]">
          <div className="security-shield absolute top-1/2 -left-[13px] -translate-y-1/2 text-indigo-400 bg-black rounded-full p-0.5">
            <Shield size={11} strokeWidth={1.8} />
          </div>
        </div>
      </div>

      {/* Keep the center completely empty so this can be used as a visual hero background */}
      <div className="relative z-10 text-center p-8 max-w-2xl"></div>
    </main>
  );
};
