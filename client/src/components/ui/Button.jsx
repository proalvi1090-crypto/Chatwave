export default function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] px-4 py-2 font-medium text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
