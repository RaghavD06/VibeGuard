export function Placeholder({ title }: { title: string }) {
  return (
    <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center shadow-2xl shadow-black/60">
      <h3 className="mt-2 text-base font-medium text-white tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-neutral-400 font-light">This module is currently being provisioned.</p>
    </div>
  );
}
