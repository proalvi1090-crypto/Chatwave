export default function Avatar({ src, name, size = "md" }) {
  const classes = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  return src ? (
    <img src={src} alt={name} className={`${classes} rounded-full object-cover ring-1 ring-white/10 shadow-sm`} />
  ) : (
    <div className={`${classes} flex items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-xs font-semibold text-white ring-1 ring-white/10 shadow-sm`}>
      {(name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}
