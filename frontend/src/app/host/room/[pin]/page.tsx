'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSocket, emitWithTimeout, disconnectSocket } from '@/lib/socket';
import { getBackendUrl } from '@/lib/api';
import {
  Users, Play, ArrowRight, Award, Trophy, MessageSquare,
  Flame, Send, Download, Check, HelpCircle, FastForward, Eye, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function HostRoom() {
  const router = useRouter();
  const { pin } = useParams() as { pin: string };

  const [players, setPlayers] = useState<any[]>([]);
  const [sessionState, setSessionState] = useState<string>('LOBBY');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(1);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [stats, setStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setPlayers([]);
    setLeaderboard([]);
    setStats(null);
    setCurrentQuestion(null);
    setErrorMsg(null);

    const socket = getSocket();

    async function syncHost() {
      const res = await emitWithTimeout('player:sync', { pin }, 10000);
      if (res.success && res.data) {
        applySyncState(res.data);
      }
    }

    function applySyncState(sync: any) {
      if (!sync) return;
      setSessionState(sync.status);
      setCurrentQuestionIndex(sync.currentQuestionIndex || 0);
      setTotalQuestions(sync.totalQuestions || 1);
      setRemainingSeconds(sync.remainingSeconds || 0);
      setCurrentQuestion(sync.currentQuestion);
      if (sync.leaderboard) setLeaderboard(sync.leaderboard);
    }

    syncHost();

    socket.on('lobby_update', (playerList: any[]) => {
      setPlayers(playerList.filter((p) => p.name !== '_HOST_MOCK_'));
    });

    socket.on('session:sync', (sync: any) => {
      applySyncState(sync);
    });

    socket.on('question:start', (data: any) => {
      setSessionState('QUESTION_ACTIVE');
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.questionIndex || 0);
      setTotalQuestions(data.totalQuestions || 1);
      setRemainingSeconds(data.remainingSeconds || 20);
      setStats(null);
    });

    socket.on('question:skip', (data: any) => {
      setSessionState('QUESTION_LOCKED');
      if (data.stats) setStats(data.stats);
    });

    socket.on('answer:reveal', (data: any) => {
      setSessionState('ANSWER_REVEAL');
      if (data.stats) setStats(data.stats);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    socket.on('leaderboard:update', (data: any) => {
      setSessionState('LEADERBOARD');
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    socket.on('quiz:finished', (data: any) => {
      setSessionState('QUIZ_FINISHED');
      if (data.leaderboard) setLeaderboard(data.leaderboard);

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });
    });

    socket.on('chat_message', (msg: any) => {
      setChatMessages((prev) => [...prev, msg].slice(-40));
    });

    return () => {
      socket.off('lobby_update');
      socket.off('session:sync');
      socket.off('question:start');
      socket.off('question:skip');
      socket.off('answer:reveal');
      socket.off('leaderboard:update');
      socket.off('quiz:finished');
      socket.off('chat_message');
    };
  }, [pin]);

  // Local second countdown
  useEffect(() => {
    if (sessionState !== 'QUESTION_ACTIVE' || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState, remainingSeconds]);

  const getHostId = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr).id;
      } catch (e) {}
    }
    return 'host_id_default';
  };

  const handleStartGame = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout('host:start', { pin, hostId: getHostId() }, 10000);
    if (res.success && res.data) {
      setSessionState('QUESTION_ACTIVE');
      if (res.data.question) setCurrentQuestion(res.data.question);
      if (res.data.remainingSeconds) setRemainingSeconds(res.data.remainingSeconds);
    } else {
      setErrorMsg(res.message || 'Failed to start quiz');
    }
  };

  const handleSkipQuestion = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout('host:skip', { pin, hostId: getHostId() }, 10000);
    if (!res.success) {
      setErrorMsg(res.message || 'Failed to skip question');
    }
  };

  const handleShowAnswer = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout('host:showAnswer', { pin, hostId: getHostId() }, 10000);
    if (!res.success) {
      setErrorMsg(res.message || 'Failed to show answer');
    }
  };

  const handleShowLeaderboard = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout('host:showLeaderboard', { pin, hostId: getHostId() }, 10000);
    if (!res.success) {
      setErrorMsg(res.message || 'Failed to show leaderboard');
    }
  };

  const handleNextQuestion = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout('host:next', { pin, hostId: getHostId() }, 10000);
    if (!res.success) {
      setErrorMsg(res.message || 'Failed to advance question');
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const socket = getSocket();
    socket.emit('send_chat', { pin, name: 'Host', message: chatInput });
    setChatInput('');
  };

  const handleExportCsv = () => {
    const hostToken = localStorage.getItem('token');
    const backendUrl = getBackendUrl();
    window.open(`${backendUrl}/analytics/session/csv?pin=${pin}&token=${hostToken}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-white flex flex-col relative overflow-hidden">
      <header className="border-b border-slate-800/40 bg-slate-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            Host Control Panel
          </span>
          <span className="text-slate-400 text-sm">
            | Room PIN: <strong className="text-white">{pin}</strong>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-slate-300 text-xs flex items-center gap-1.5 font-bold">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>{players.length} Joined</span>
          </span>
          <button
            onClick={() => {
              disconnectSocket();
              router.push('/host');
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-colors"
          >
            Exit Session
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-2 text-center text-xs text-rose-400 font-bold flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
        <div className="lg:col-span-3 flex flex-col justify-between space-y-8 min-h-[70vh]">
          <AnimatePresence mode="wait">
            {/* LOBBY STATE */}
            {sessionState === 'LOBBY' && (
              <motion.div
                key="lobby-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-3">
                  <p className="text-indigo-400 text-xs font-black uppercase tracking-widest">Join Game PIN</p>
                  <h1 className="text-6xl sm:text-7xl font-black tracking-widest text-white animate-pulse">
                    {pin}
                  </h1>
                  <p className="text-slate-400 text-xs max-w-md mx-auto">
                    Instruct participants to enter this PIN at <strong className="text-white">AuraQuiz</strong>
                  </p>

                  <div className="inline-block p-3 rounded-2xl bg-white border border-slate-100 shadow-xl mt-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                        typeof window !== 'undefined'
                          ? `${window.location.protocol}//${window.location.host}/?pin=${pin}`
                          : `https://auraquiz.com/?pin=${pin}`,
                      )}`}
                      alt="Join QR Code"
                      className="w-32 h-32"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>Lobby Participants ({players.length})</span>
                  </h3>
                  {players.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-900/40 text-center text-xs text-slate-500 border border-slate-800/20 font-bold">
                      Waiting for participants to join...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                      {players.map((p, idx) => (
                        <div
                          key={p.id}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/40 text-center font-extrabold text-slate-200 text-xs shadow-sm"
                        >
                          {p.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 text-center">
                  <button
                    onClick={handleStartGame}
                    disabled={players.length === 0}
                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-xl shadow-indigo-600/30 flex items-center gap-2 mx-auto transition-all"
                  >
                    <span>Launch Quiz Session</span>
                    <Play className="w-4 h-4 fill-white" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* QUESTION ACTIVE STATE */}
            {sessionState === 'QUESTION_ACTIVE' && currentQuestion && (
              <motion.div
                key="playing-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                <div className="text-center space-y-2">
                  <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-black rounded-full uppercase tracking-widest">
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 max-w-3xl mx-auto leading-snug">
                    {currentQuestion.text}
                  </h2>
                </div>

                <div className="flex justify-center my-4">
                  <div className="relative w-36 h-36 flex items-center justify-center rounded-full bg-slate-900 border-4 border-indigo-500/30 shadow-xl">
                    <span className="text-5xl font-black text-indigo-400">{remainingSeconds}</span>
                    <p className="absolute bottom-3 text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">
                      Seconds
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto w-full">
                  {currentQuestion.options?.map((o: any, idx: number) => (
                    <div
                      key={o.id}
                      className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/40 flex items-center gap-3 text-left font-bold text-slate-200 text-xs"
                    >
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded text-white font-black text-xs ${
                          idx === 0
                            ? 'bg-red-500'
                            : idx === 1
                            ? 'bg-blue-500'
                            : idx === 2
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleSkipQuestion}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <FastForward className="w-4 h-4" />
                    <span>Skip Question</span>
                  </button>

                  <button
                    onClick={handleShowAnswer}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Show Answer Statistics</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ANSWER REVEAL / QUESTION LOCKED STATE */}
            {(sessionState === 'ANSWER_REVEAL' || sessionState === 'QUESTION_LOCKED') && stats && (
              <motion.div
                key="reveal-step"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                <div className="text-center space-y-1">
                  <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">
                    Question Answer Revealed
                  </span>
                  <h2 className="text-2xl font-extrabold text-white max-w-2xl mx-auto">{stats.questionText}</h2>
                </div>

                <div className="space-y-3 max-w-2xl mx-auto w-full my-2">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Response Distribution ({stats.totalResponses} submissions)
                  </h3>

                  <div className="space-y-3">
                    {stats.options?.map((o: any, idx: number) => {
                      const percentage = stats.totalResponses > 0 ? (o.count / stats.totalResponses) * 100 : 0;
                      return (
                        <div key={o.id} className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="flex items-center gap-2 text-slate-300">
                              <span
                                className={`w-5 h-5 flex items-center justify-center rounded text-white font-black text-[10px] ${
                                  idx === 0
                                    ? 'bg-red-500'
                                    : idx === 1
                                    ? 'bg-blue-500'
                                    : idx === 2
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                              >
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span>{o.text}</span>
                              {o.isCorrect && <Check className="w-4 h-4 text-emerald-400 stroke-[3px]" />}
                            </span>
                            <span className="text-slate-400">
                              {o.count} ({Math.round(percentage)}%)
                            </span>
                          </div>

                          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                            <div
                              style={{ width: `${percentage}%` }}
                              className={`h-full rounded-full transition-all duration-700 ${
                                o.isCorrect ? 'bg-emerald-500' : 'bg-slate-700'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {stats.questionExplanation && (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 max-w-2xl mx-auto flex gap-2">
                    <HelpCircle className="w-4 h-4 flex-shrink-0 text-indigo-400" />
                    <p>
                      <strong>Explanation:</strong> {stats.questionExplanation}
                    </p>
                  </div>
                )}

                <div className="pt-2 text-center flex justify-center gap-3">
                  <button
                    onClick={handleShowLeaderboard}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Show Leaderboard</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* LEADERBOARD STATE */}
            {sessionState === 'LEADERBOARD' && (
              <motion.div
                key="leaderboard-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-1">
                  <span className="text-indigo-400 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Current Leaderboard
                  </span>
                  <h2 className="text-2xl font-black text-white">Score Standings</h2>
                </div>

                <div className="max-w-2xl mx-auto w-full bg-slate-900/40 border border-slate-800/40 rounded-2xl p-4 divide-y divide-slate-800/40">
                  {leaderboard.slice(0, 5).map((p, idx) => (
                    <div key={p.id} className="flex justify-between items-center py-2.5 font-extrabold text-xs">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : idx === 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="text-slate-200">{p.name}</span>
                        {p.streak >= 2 && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                            <span>{p.streak} Streak</span>
                          </span>
                        )}
                      </div>
                      <span className="text-slate-200">{p.score} pts</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 text-center">
                  <button
                    onClick={handleNextQuestion}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 mx-auto transition-all"
                  >
                    <span>Proceed to Next Question</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* QUIZ FINISHED STATE */}
            {sessionState === 'QUIZ_FINISHED' && (
              <motion.div
                key="finished-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 flex-1 flex flex-col justify-center text-center"
              >
                <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
                <h2 className="text-4xl font-black text-amber-400">Quiz Completed!</h2>

                <div className="max-w-md mx-auto w-full bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Top Winners</h4>
                  {leaderboard.slice(0, 3).map((p, idx) => (
                    <div key={p.id} className="flex justify-between items-center py-2 text-xs font-extrabold">
                      <span className="text-slate-200">
                        #{idx + 1} {p.name}
                      </span>
                      <span className="text-amber-400">{p.score} pts</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={handleExportCsv}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Report (CSV)</span>
                  </button>

                  <button
                    onClick={() => {
                      disconnectSocket();
                      router.push('/host');
                    }}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-colors"
                  >
                    Back to Quizzes
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Chat Panel */}
        <div className="lg:col-span-1 glass rounded-3xl p-5 flex flex-col justify-between h-[70vh] border border-slate-800/40 relative">
          <div className="space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-slate-800/40 pb-3">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Live Room Chat</span>
            </h3>

            <div className="space-y-3 h-[42vh] overflow-y-auto pr-1 text-xs">
              {chatMessages.length === 0 ? (
                <div className="text-center py-20 text-slate-600 font-bold text-[11px]">No chat messages yet.</div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/30 space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-indigo-400">{msg.name}</span>
                      <span className="text-slate-600">{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-200 select-all leading-relaxed break-all text-[11px]">{msg.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleSendChat} className="flex gap-2 border-t border-slate-800/40 pt-4 mt-2">
            <input
              type="text"
              placeholder="Send message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs focus:outline-none placeholder:text-slate-600 text-slate-100"
            />
            <button type="submit" className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
