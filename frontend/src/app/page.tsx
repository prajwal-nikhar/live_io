"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  Trophy,
  Play,
  Radio,
  Lock,
  Activity,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPin = searchParams?.get("pin") || "";

  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [step, setStep] = useState<"pin" | "nickname">("pin");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (urlPin && urlPin.length >= 6) {
      setPin(urlPin);
      setStep("nickname");
    }
  }, [urlPin]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 6) {
      setError("Please enter a valid 6-digit Game PIN");
      return;
    }
    setError("");
    setStep("nickname");
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError("Please enter a nickname");
      return;
    }
    setIsJoining(true);
    // Navigate to player room with PIN and encoded name query
    router.push(
      `/player/room/${pin}?name=${encodeURIComponent(nickname.trim())}`,
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-indigo-600/30 via-cyan-500/20 to-purple-600/30 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-900/20 blur-[140px] pointer-events-none rounded-full" />

      {/* Header Bar */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between relative z-10 pt-safe">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="p-2 sm:p-2.5 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/30 shrink-0">
            <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse shrink-0" />
          </div>
          <span className="text-lg sm:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-300 truncate">
            Cognition | GIM{" "}
            <span className="hidden xs:inline-block text-xs px-2 py-0.5 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-full font-mono uppercase tracking-wider ml-1">
              PRO
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/auth")}>
            Host Login
          </Button>
          <Button variant="glowing" size="sm" onClick={() => router.push("/host")}>
            Create Quiz
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-16 sm:pb-24 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Headline & Hero Info */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 space-y-4 sm:space-y-6 text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/30 text-[11px] sm:text-xs font-semibold text-indigo-300 shadow-md backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
            <span>Next-Generation Real-Time Interactive Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-white">
            Engage Audiences with{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400">
              Instant Real-Time Quizzes
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-xl font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            Ultra-fast Kahoot & Slido tier real-time quiz platform. Powered by
            Socket.IO clustering, sub-200ms latency, and enterprise
            observability.
          </p>

          {/* Key Feature Bullets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-2 sm:pt-4 text-xs sm:text-sm font-semibold text-slate-300">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
              <span>Up to 1,000+ Players</span>
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
              <span>Sub-200ms Updates</span>
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
              <span>Zero Connection Drops</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: PIN Join Glass Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="lg:col-span-5 w-full max-w-md mx-auto"
        >
          <Card
            variant="glass"
            className="p-5 sm:p-8 border-indigo-500/30 shadow-2xl shadow-indigo-500/10"
          >
            <div className="text-center mb-5 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-500/10 rounded-2xl border border-indigo-500/30 flex items-center justify-center mx-auto mb-2.5 sm:mb-3 text-indigo-400 shadow-inner shrink-0">
                <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5 fill-indigo-400 shrink-0" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Join Live Game</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your 6-digit Game PIN to enter the lobby
              </p>
            </div>

            {step === "pin" ? (
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="GAME PIN"
                    value={pin}
                    onFocus={(e) =>
                      e.target.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      })
                    }
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, ""));
                      setError("");
                    }}
                    className="w-full text-center text-2xl sm:text-3xl tracking-[0.2em] sm:tracking-[0.3em] font-black py-3.5 sm:py-4 bg-slate-950 border border-slate-800 rounded-2xl text-indigo-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 uppercase"
                  />
                  {error && (
                    <p className="text-xs text-rose-400 font-medium text-center mt-2">
                      {error}
                    </p>
                  )}
                </div>

                <Button variant="glowing" size="xl" className="w-full">
                  Enter Game <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleJoinGame} className="space-y-4">
                <div>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="YOUR NICKNAME"
                    value={nickname}
                    onFocus={(e) =>
                      e.target.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      })
                    }
                    onChange={(e) => {
                      setNickname(e.target.value);
                      setError("");
                    }}
                    className="w-full text-center text-xl font-bold py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20"
                    autoFocus
                  />
                  {error && (
                    <p className="text-xs text-rose-400 font-medium text-center mt-2">
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-1/3"
                    onClick={() => setStep("pin")}
                  >
                    Back
                  </Button>
                  <Button
                    variant="glowing"
                    size="lg"
                    className="w-2/3"
                    isLoading={isJoining}
                  >
                    Join Lobby
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </motion.div>
      </main>

      {/* Enterprise Platform Features Grid */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-800/80">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-white">
            Engineered for Enterprise Scale
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Built on NestJS, Socket.IO clustering, PostgreSQL, and Next.js 15
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="interactive" className="p-6">
            <Zap className="w-10 h-10 text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              Sub-200ms Latency
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Optimized WebSocket event broadcasts deliver instant question
              transitions and answer acknowledgements.
            </p>
          </Card>

          <Card variant="interactive" className="p-6">
            <ShieldCheck className="w-10 h-10 text-indigo-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              Resilient Reconnections
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Cryptographic reconnect tokens preserve player scores and state
              during network switches.
            </p>
          </Card>

          <Card variant="interactive" className="p-6">
            <Activity className="w-10 h-10 text-emerald-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              SRE Observability
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Prometheus metrics and Sentry context tracing power live
              operations control panel.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>}>
      <LandingPageContent />
    </Suspense>
  );
}
