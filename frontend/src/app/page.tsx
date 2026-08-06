'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { Sparkles, Play, Award, ShieldAlert, Monitor, CheckCircle, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [step, setStep] = useState<'PIN' | 'NICKNAME' | 'JOINING'>('PIN');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Sync theme setting
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme as any);
    document.documentElement.className = savedTheme;

    // Check url search params for pin
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get('pin');
      if (urlPin && urlPin.trim().length === 6) {
        setPin(urlPin);
        setStep('NICKNAME');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.className = nextTheme;
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.trim().length !== 6) {
      setError('Please enter a valid 6-digit numeric game PIN');
      return;
    }
    setError('');
    setStep('NICKNAME');
  };

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || nickname.trim().length < 2) {
      setError('Nickname must be at least 2 characters long');
      return;
    }

    setError('');
    setStep('JOINING');

    const socket = getSocket();
    
    // Connect to room and validate details
    socket.emit('player_join', { pin, name: nickname });

    socket.once('join_success', (data) => {
      // Save details to sessionStorage for reconnection / state management
      sessionStorage.setItem('player_pin', pin);
      sessionStorage.setItem('player_name', nickname);
      sessionStorage.setItem('player_id', data.player.id);
      
      // Redirect to the participant's dynamic room
      router.push(`/player/room/${pin}`);
    });

    socket.once('join_error', (err) => {
      setError(err.message || 'Unable to join. Verify your PIN and try again.');
      setStep('NICKNAME');
    });
  };

  return (
    <div className="relative min-h-screen gradient-dark flex flex-col justify-between overflow-hidden text-slate-100 px-4">
      {/* Background visual graphics */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-900/30 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating Header */}
      <header className="w-full max-w-6xl mx-auto flex justify-between items-center py-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 gradient-brand rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
            AuraQuiz
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl glass hover:bg-white/10 text-slate-300 smooth-transition"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button
            onClick={() => router.push('/auth')}
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/20 active:scale-95 smooth-transition"
          >
            Host a Quiz
          </button>
        </div>
      </header>

      {/* Main Form container */}
      <main className="flex-1 flex flex-col items-center justify-center py-10 relative z-10">
        <div className="w-full max-w-md">
          {/* Animated Hero text */}
          <div className="text-center mb-8">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-3"
            >
              Enterprise Live <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-pink-400 to-purple-400">
                Engagement Platform
              </span>
            </motion.h1>
            <p className="text-slate-400 text-sm sm:text-base">
              Enter a game PIN below to play instantly. No app download required.
            </p>
          </div>

          {/* Form Box (Glassmorphic Card) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-3xl p-8 sm:p-10 shadow-2xl relative"
          >
            <AnimatePresence mode="wait">
              {step === 'PIN' && (
                <motion.form
                  key="pin-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handlePinSubmit}
                  className="space-y-6"
                >
                  <div>
                    <label className="block text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3 text-center">
                      Game PIN
                    </label>
                    <input
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, '');
                        setPin(num);
                      }}
                      placeholder="e.g. 540982"
                      className="w-full text-center text-3xl font-extrabold py-4 px-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-white tracking-widest placeholder:text-slate-600 placeholder:tracking-normal focus:outline-none smooth-transition"
                    />
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 text-rose-400 text-sm font-medium bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/20"
                    >
                      <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    className="w-full gradient-brand hover:brightness-110 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 group smooth-transition active:scale-98"
                  >
                    <span>Enter Quiz</span>
                    <Play className="w-5 h-5 fill-white group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.form>
              )}

              {step === 'NICKNAME' && (
                <motion.form
                  key="nickname-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleNicknameSubmit}
                  className="space-y-6"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStep('PIN');
                      setError('');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mb-2 inline-block hover:underline"
                  >
                    ← Back to enter PIN
                  </button>

                  <div>
                    <label className="block text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3 text-center">
                      Choose Your Nickname
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="e.g. MasterCoder"
                      className="w-full text-center text-2xl font-bold py-4 px-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-white placeholder:text-slate-600 focus:outline-none smooth-transition"
                    />
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 text-rose-400 text-sm font-medium bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/20"
                    >
                      <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 smooth-transition active:scale-98"
                  >
                    <span>Join Lobby</span>
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </motion.form>
              )}

              {step === 'JOINING' && (
                <motion.div
                  key="joining"
                  className="flex flex-col items-center justify-center py-10 space-y-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                  <p className="text-slate-300 font-semibold text-lg">
                    Securing safe connection channel...
                  </p>
                  <p className="text-xs text-slate-500">
                    Handshaking with real-time room {pin}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Quick link for mobile hosting */}
          <div className="mt-6 text-center sm:hidden">
            <button
              onClick={() => router.push('/auth')}
              className="text-indigo-400 hover:text-indigo-300 font-bold text-sm underline active:scale-95 transition-transform"
            >
              Are you a Host? Log in here
            </button>
          </div>
        </div>
      </main>

      {/* Trust & Performance Footer */}
      <footer className="w-full py-8 text-center border-t border-slate-800 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 px-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span>High Performance Gateway — 10,000+ Concurrent Nodes Active</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1">
              <Monitor className="w-4 h-4 text-indigo-400" />
              <span>Sub-200ms Synced Latency</span>
            </div>
            <div className="flex items-center gap-1">
              <Award className="w-4 h-4 text-pink-400" />
              <span>WCAG AA Complaint</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
