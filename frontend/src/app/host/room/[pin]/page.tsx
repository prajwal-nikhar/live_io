'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { apiRequest, getBackendUrl } from '@/lib/api';
import { 
  Users, Play, ArrowRight, Award, Trophy, MessageSquare, 
  Flame, RefreshCw, Send, Download, BarChart2, Check, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function HostRoom() {
  const router = useRouter();
  const { pin } = useParams() as { pin: string };

  const [session, setSession] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [status, setStatus] = useState<'LOBBY' | 'PLAYING' | 'REVEAL_ANSWER' | 'LEADERBOARD' | 'FINISHED'>('LOBBY');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [stats, setStats] = useState<any>(null);
  const [podium, setPodium] = useState<any[]>([]);

  // Real-time Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Floating reactions state
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);

  useEffect(() => {
    const socket = getSocket();

    // Check reconnection on mount
    socket.emit('player_join', { pin, name: '_HOST_MOCK_' }); // Ping back as host
    
    // Register socket updates
    socket.on('lobby_update', (playerList: any[]) => {
      // Exclude host proxy if any
      setPlayers(playerList.filter(p => p.name !== '_HOST_MOCK_'));
    });

    socket.on('game_started', () => {
      setStatus('PLAYING');
    });

    socket.on('host_question_start', (question: any) => {
      setStatus('PLAYING');
      setCurrentQuestion(question);
      setTimeLeft(question.timeLimit);
      setStats(null); // Reset last answers
    });

    socket.on('timer_tick', (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
    });

    socket.on('answer_revealed', (questionStats: any) => {
      setStatus('REVEAL_ANSWER');
      setStats(questionStats);
    });

    socket.on('leaderboard_update', (rankings: any[]) => {
      setStatus('LEADERBOARD');
      setPlayers(rankings.filter(p => p.name !== '_HOST_MOCK_'));
    });

    socket.on('winner_celebration', (data: { podium: any[]; players: any[] }) => {
      setStatus('FINISHED');
      setPodium(data.podium);
      setPlayers(data.players);
      
      // Trigger full page confetti explosion
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    });

    // Chat listener
    socket.on('chat_message', (msg: any) => {
      setChatMessages(prev => [...prev, msg].slice(-40)); // Keep last 40
    });

    // Reaction listener
    socket.on('new_reaction', (data: { emoji: string }) => {
      const id = Date.now() + Math.random();
      setReactions(prev => [...prev, { id, emoji: data.emoji }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 3000); // Remove after animation
    });

    // Clean up
    return () => {
      socket.off('lobby_update');
      socket.off('game_started');
      socket.off('host_question_start');
      socket.off('timer_tick');
      socket.off('answer_revealed');
      socket.off('leaderboard_update');
      socket.off('winner_celebration');
      socket.off('chat_message');
      socket.off('new_reaction');
    };
  }, [pin]);

  const handleStartGame = () => {
    const socket = getSocket();
    socket.emit('host_start_game', { pin });
  };

  const handleNext = () => {
    const socket = getSocket();
    socket.emit('host_next_question', { pin });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const socket = getSocket();
    socket.emit('send_chat', { pin, name: 'Host (Alex)', message: chatInput });
    setChatInput('');
  };

  // Helper download for analytical summary report
  const handleExportCsv = () => {
    if (!players || players.length === 0) return;
    const hostToken = localStorage.getItem('token');
    const backendUrl = getBackendUrl();
    
    // Simple fetch with credentials trigger
    window.open(`${backendUrl}/analytics/session/${players[0].sessionId}/csv?token=${hostToken}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-white flex flex-col relative overflow-hidden">
      
      {/* Dynamic Floating Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, scale: 0.5, x: '50vw', y: '100vh' }}
              animate={{ 
                opacity: [0, 1, 1, 0], 
                scale: [1, 1.5, 1.5, 1],
                x: `${40 + Math.random() * 20}vw`, 
                y: `${15 + Math.random() * 30}vh` 
              }}
              transition={{ duration: 2.8, ease: 'easeOut' }}
              className="absolute text-4xl select-none"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main header block */}
      <header className="border-b border-slate-800/40 bg-slate-950/50 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            Live Room Control
          </span>
          <span className="text-slate-500 text-sm">| PIN: <strong className="text-white">{pin}</strong></span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm flex items-center gap-1.5 font-bold">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>{players.length} Joined</span>
          </span>
          <button
            onClick={() => {
              disconnectSocket();
              router.push('/host');
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
          >
            Exit Control Panel
          </button>
        </div>
      </header>

      {/* Primary body orchestrator */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
        
        {/* Left Side Game Interface panel (3 columns wide) */}
        <div className="lg:col-span-3 flex flex-col justify-between space-y-8 min-h-[70vh]">
          
          <AnimatePresence mode="wait">
            
            {/* 1. LOBBY STEP */}
            {status === 'LOBBY' && (
              <motion.div
                key="lobby-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-4">
                  <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Join with Code</p>
                  <h1 className="text-6xl sm:text-7xl font-extrabold tracking-widest text-white selection:bg-indigo-600 animate-pulse">
                    {pin}
                  </h1>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Tell your audience to navigate to <strong className="text-white">AuraQuiz</strong> and enter this PIN code to connect.
                  </p>
                  
                  {/* Generated QR Code preview */}
                  <div className="inline-block p-4 rounded-3xl bg-white border border-slate-100 shadow-xl mt-4">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}/?pin=${pin}` : `https://auraquiz.com/?pin=${pin}`
                      )}`}
                      alt="Join QR Code"
                      className="w-36 h-36"
                    />
                  </div>
                </div>

                {/* Participant grid inside lobby */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>Lobby Players ({players.length})</span>
                  </h3>
                  {players.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-900/40 text-center text-slate-500 border border-slate-800/20">
                      Waiting for players to connect. Join to test!
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {players.map((p, idx) => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className="px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800/40 text-center font-bold text-slate-200 line-clamp-1 text-sm shadow-sm"
                        >
                          {p.name}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-6 text-center">
                  <button
                    onClick={handleStartGame}
                    disabled={players.length === 0}
                    className="px-10 py-4 gradient-brand hover:brightness-110 disabled:opacity-40 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center gap-2 mx-auto transition-all"
                  >
                    <span>Launch Quiz Session</span>
                    <Play className="w-5 h-5 fill-white" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* 2. PLAYING COUNTDOWN STEP */}
            {status === 'PLAYING' && currentQuestion && (
              <motion.div
                key="playing-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-8 flex-1 flex flex-col justify-between"
              >
                <div className="text-center space-y-4">
                  <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-bold rounded-full uppercase tracking-widest">
                    Question {currentQuestion.order + 1} of {currentQuestion.quiz?.questions?.length || '5'}
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 max-w-3xl mx-auto leading-snug">
                    {currentQuestion.text}
                  </h2>
                </div>

                {/* Huge animated central timer */}
                <div className="flex justify-center my-6">
                  <div className="relative w-40 h-40 flex items-center justify-center rounded-full bg-slate-900 border-4 border-indigo-500/30">
                    <span className="text-6xl font-black text-indigo-400">{timeLeft}</span>
                    <p className="absolute bottom-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Seconds</p>
                  </div>
                </div>

                {/* Passive Question options previews (Answers hidden for anti-cheat protection) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
                  {currentQuestion.options?.map((o: any, idx: number) => (
                    <div
                      key={o.id}
                      className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/40 flex items-center gap-4 text-left font-bold text-slate-200"
                    >
                      <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-white font-extrabold text-sm ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-blue-500' : idx === 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm sm:text-base">{o.text}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 text-center">
                  <button
                    onClick={handleNext}
                    className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl border border-slate-800 flex items-center gap-2 mx-auto transition-colors"
                  >
                    <span>Skip / Show Answer</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* 3. REVEAL ANSWER STATS STEP */}
            {status === 'REVEAL_ANSWER' && stats && (
              <motion.div
                key="reveal-step"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 flex-1 flex flex-col justify-between"
              >
                <div className="text-center space-y-2">
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Correct Answer Revealed</span>
                  <h2 className="text-3xl font-extrabold leading-snug text-white max-w-2xl mx-auto">
                    {stats.questionText}
                  </h2>
                </div>

                {/* Analytical response columns charts */}
                <div className="space-y-6 max-w-2xl mx-auto w-full my-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Audience Responses Counts</h3>
                  
                  <div className="space-y-4">
                    {stats.options?.map((o: any, idx: number) => {
                      const percentage = stats.totalResponses > 0 ? (o.count / stats.totalResponses) * 100 : 0;
                      return (
                        <div key={o.id} className="space-y-1">
                          <div className="flex justify-between items-center text-sm font-bold">
                            <span className="flex items-center gap-2 text-slate-300">
                              <span className={`w-6 h-6 flex items-center justify-center rounded text-white font-black text-xs ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-blue-500' : idx === 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span>{o.text}</span>
                              {o.isCorrect && <Check className="w-4.5 h-4.5 text-emerald-400 stroke-[3px]" />}
                            </span>
                            <span className="text-slate-400">{o.count} ({Math.round(percentage)}%)</span>
                          </div>
                          
                          <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 1.2, ease: 'easeOut' }}
                              className={`h-full rounded-full ${o.isCorrect ? 'bg-emerald-500' : 'bg-slate-700'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation text */}
                {stats.questionExplanation && (
                  <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs sm:text-sm text-indigo-300 max-w-2xl mx-auto flex gap-2">
                    <HelpCircle className="w-5 h-5 flex-shrink-0 text-indigo-400" />
                    <p><strong>Explanation:</strong> {stats.questionExplanation}</p>
                  </div>
                )}

                <div className="pt-4 text-center">
                  <button
                    onClick={handleNext}
                    className="px-10 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 mx-auto transition-all"
                  >
                    <span>Show Current Leaderboard</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* 4. LEADERBOARD STEP */}
            {status === 'LEADERBOARD' && (
              <motion.div
                key="leaderboard-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-1">
                  <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Leaderboard Standing
                  </span>
                  <h2 className="text-3xl font-extrabold text-white">Current Standings</h2>
                </div>

                {/* List rankings */}
                <div className="max-w-2xl mx-auto w-full bg-slate-900/40 border border-slate-800/20 rounded-2xl p-4 sm:p-6 divide-y divide-slate-800/40">
                  {players.slice(0, 5).map((p, idx) => (
                    <div key={p.id} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold ${idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          #{idx + 1}
                        </span>
                        <span className="font-extrabold text-slate-200">{p.name}</span>
                        {p.streak >= 2 && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                            <span>{p.streak} Streak</span>
                          </span>
                        )}
                      </div>
                      <span className="font-extrabold text-slate-100">{p.score} pts</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 text-center">
                  <button
                    onClick={handleNext}
                    className="px-10 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 mx-auto transition-all"
                  >
                    <span>Proceed to Next Round</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* 5. FINISHED PODIUM CELEBRATION */}
            {status === 'FINISHED' && (
              <motion.div
                key="finished-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-2">
                  <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider">Congratulations!</p>
                  <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-400">
                    Grand Finale Podium
                  </h2>
                </div>

                {/* Graphic Podium pedestals */}
                <div className="flex justify-center items-end gap-3 sm:gap-6 pt-12 pb-6 max-w-md mx-auto w-full">
                  
                  {/* 2nd place */}
                  {podium[1] && (
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-sm text-slate-300 mb-2">{podium[1].name}</span>
                      <div className="w-24 sm:w-28 h-28 bg-slate-800 rounded-t-xl border border-slate-700 flex flex-col items-center justify-center shadow-lg">
                        <span className="text-slate-400 font-extrabold text-3xl">2</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">{podium[1].score} pts</span>
                      </div>
                    </div>
                  )}

                  {/* 1st place */}
                  {podium[0] && (
                    <div className="flex flex-col items-center">
                      <Trophy className="w-10 h-10 text-amber-400 fill-amber-400 mb-2 animate-bounce" />
                      <span className="font-black text-base text-amber-300 mb-2">{podium[0].name}</span>
                      <div className="w-28 sm:w-32 h-36 bg-gradient-to-t from-indigo-900 to-indigo-700 rounded-t-xl border border-indigo-500 flex flex-col items-center justify-center shadow-2xl relative">
                        <span className="text-white font-extrabold text-5xl">1</span>
                        <span className="text-xs text-indigo-200 font-extrabold mt-1">{podium[0].score} pts</span>
                      </div>
                    </div>
                  )}

                  {/* 3rd place */}
                  {podium[2] && (
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-sm text-slate-400 mb-2">{podium[2].name}</span>
                      <div className="w-20 sm:w-24 h-22 bg-slate-900 rounded-t-xl border border-slate-800 flex flex-col items-center justify-center shadow-md">
                        <span className="text-amber-700 font-extrabold text-2xl">3</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">{podium[2].score} pts</span>
                      </div>
                    </div>
                  )}

                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <button
                    onClick={handleExportCsv}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors w-full sm:w-auto justify-center shadow-lg shadow-emerald-600/10"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Analytical Report</span>
                  </button>

                  <button
                    onClick={() => {
                      disconnectSocket();
                      router.push('/host');
                    }}
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold rounded-xl border border-slate-800 transition-colors w-full sm:w-auto justify-center"
                  >
                    Back to Quizzes
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>

        {/* Right Side Live Interactions Channel (1 column wide) */}
        <div className="lg:col-span-1 glass rounded-3xl p-5 flex flex-col justify-between h-[70vh] border border-slate-800/40 relative">
          
          {/* Channel Header */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-slate-800/40 pb-3">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Live Room Chat</span>
            </h3>
            
            {/* Scrollable messages box */}
            <div className="space-y-3 h-[42vh] overflow-y-auto pr-1 text-xs">
              {chatMessages.length === 0 ? (
                <div className="text-center py-20 text-slate-600 font-bold">
                  No chat messages yet.
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/30 space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-indigo-400">{msg.name}</span>
                      <span className="text-slate-600">{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-200 select-all leading-relaxed break-all">{msg.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Interactive Chat Input */}
          <form onSubmit={handleSendChat} className="flex gap-2 border-t border-slate-800/40 pt-4 mt-2">
            <input
              type="text"
              placeholder="Send message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs focus:outline-none placeholder:text-slate-600 text-slate-100"
            />
            <button
              type="submit"
              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

      </main>
    </div>
  );
}
