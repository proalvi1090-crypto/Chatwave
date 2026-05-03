export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-lg rounded-[1.75rem] border border-white/20 p-5 shadow-2xl shadow-slate-950/25">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1.5 text-sm hover:bg-slate-200/60 dark:hover:bg-slate-700/60">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
