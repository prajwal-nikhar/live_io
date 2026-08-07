"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import {
  Shield,
  Sparkles,
  Mail,
  Lock,
  User,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("HOST");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = tab === "LOGIN" ? "/auth/login" : "/auth/register";
      const body =
        tab === "LOGIN" ? { email, password } : { email, password, name, role };

      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Secure tokens in local storage
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect to host dashboard
      router.push("/host");
    } catch (err: any) {
      setError(
        err.message || "Authentication failed. Please verify credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleMock = async () => {
    setError("");
    setLoading(true);

    try {
      const mockEmail =
        email || `oauth-${Math.floor(Math.random() * 100000)}@gmail.com`;
      const mockName = name || "Google Contributor";

      const data = await apiRequest("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          token: "mock-google-token-xyz-123",
          email: mockEmail,
          name: mockName,
        }),
      });

      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      router.push("/host");
    } catch (err: any) {
      setError(err.message || "Google signup simulation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen gradient-dark flex flex-col justify-center items-center text-slate-100 px-4 py-12 overflow-hidden">
      {/* Visual background rings */}
      <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-indigo-950/50 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-950/40 rounded-full blur-[160px] pointer-events-none" />

      {/* Floating Sparkle logo */}
      <div
        className="mb-8 text-center relative z-10 cursor-pointer"
        onClick={() => router.push("/")}
      >
        <div className="inline-flex p-3 gradient-brand rounded-2xl shadow-xl shadow-indigo-500/20 mb-4 hover:scale-105 transition-transform">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight">
          AuraQuiz Portals
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          Enterprise host and administrator access node
        </p>
      </div>

      {/* Auth Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg glass rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 border border-white/5"
      >
        {/* Title instead of tab switcher */}
        <div className="mb-8 text-center">
          <h3 className="text-xl font-bold text-slate-100">
            Sign In to Dashboard
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            Access to host and manage events
          </p>
        </div>

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <AnimatePresence mode="wait">
            {tab === "REGISTER" && (
              <motion.div
                key="register-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Professor Alex"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-slate-100 smooth-transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Platform Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-slate-100 smooth-transition"
                  >
                    <option value="HOST">Host (Create Quizzes & Rooms)</option>
                    <option value="MODERATOR">
                      Moderator (Filter chats & logs)
                    </option>
                    <option value="ADMIN">Administrator (Full Control)</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-slate-100 smooth-transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-slate-100 smooth-transition"
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2.5 text-rose-400 text-xs font-semibold bg-rose-500/10 p-4 rounded-xl border border-rose-500/20"
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-brand hover:brightness-110 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 smooth-transition"
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                <span>Sign In Securely</span>
                <CheckCircle2 className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Professional Security Notice */}
        <div className="mt-8 p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 text-xs text-slate-400 space-y-1.5 text-center">
          <div className="flex items-center justify-center gap-1.5 font-bold text-slate-200">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Secure Access</span>
          </div>
          <p className="text-slate-300 font-medium">
            Only authorized administrators can access this dashboard.
          </p>
          <p className="text-slate-500 text-[11px]">
            All authentication attempts are logged and monitored.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
