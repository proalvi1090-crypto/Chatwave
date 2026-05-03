import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import Button from "../components/ui/Button";

export default function Register() {
  const navigate = useNavigate();
  const { register, loading } = useAuthStore();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="auth-shell px-4 py-8 md:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="auth-layout mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_30px_80px_rgba(6,24,44,0.22)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/85"
      >
        <section className="auth-hero relative hidden overflow-hidden p-10 text-white lg:block">
          <motion.div
            animate={{ y: [0, -8, 0], opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
          />
          <motion.div
            animate={{ y: [0, 10, 0], opacity: [0.2, 0.3, 0.2] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute -bottom-16 left-0 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl"
          />
          <motion.div className="relative z-10 h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.55 }}>
            <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/90">
              <Sparkles size={12} /> NEW WORKSPACE
            </div>

            <motion.div
              animate={{ opacity: [0.35, 0.75, 0.35] }}
              transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-10 rounded-[2rem] border border-cyan-300/30"
            />
            <motion.div
              animate={{ scale: [1, 1.05, 1], rotate: [0, -1.2, 0] }}
              transition={{ duration: 8.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-20 rounded-[1.5rem] border border-blue-300/25"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
              className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/20"
            />

            <div className="absolute inset-0">
              {Array.from({ length: 18 }).map((_, idx) => (
                <motion.span
                  key={`reg-node-${idx}`}
                  className="absolute h-2 w-2 rounded-full bg-cyan-200/80 shadow-[0_0_18px_rgba(103,232,249,0.85)]"
                  style={{
                    left: `${12 + (idx % 6) * 14}%`,
                    top: `${16 + Math.floor(idx / 6) * 24}%`
                  }}
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.15, 0.8] }}
                  transition={{ duration: 2.2 + (idx % 4) * 0.35, repeat: Infinity, ease: "easeInOut", delay: idx * 0.08 }}
                />
              ))}
            </div>
          </motion.div>
        </section>

        <section className="p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mx-auto max-w-md"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Get started</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-slate-50">Create account</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Set up your profile and start chatting in seconds.</p>

            <motion.form onSubmit={submit} className="mt-8 space-y-4" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
              <input
                required
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15 dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                required
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15 dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                required
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15 dark:border-slate-700 dark:bg-slate-800"
              />
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
              <Button type="submit" className="w-full rounded-2xl py-3 text-sm font-semibold">{loading ? "Creating..." : "Create Account"}</Button>
            </motion.form>

            <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
              Already have account? <Link className="font-semibold text-[#2563eb]" to="/login">Sign in</Link>
            </p>
          </motion.div>
        </section>
      </motion.div>
    </div>
  );
}
