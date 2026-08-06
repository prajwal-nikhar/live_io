'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSocket, emitWithTimeout, disconnectSocket } from '@/lib/socket';
import {
  Smile, Award, Sparkles, Flame, CheckCircle, XCircle,
  Clock, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PlayerRoom() {
  const router = useRouter();
  const { pin } = useParams() as { pin: string };

  const [player, setPlayer] = useState<any>(null);
  const [sessionState, setSessionState] = useState<string>('LOBBY');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Scores & Streaks
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const storedDataStr = localStorage.getItem(`aura_quiz_player_${pin}`);
    const nameFromSession = sessionStorage.getItem('player_name');

    async function initSession() {
      if (storedDataStr) {
        try {
          const storedData = JSON.parse(storedDataStr);
          setPlayer(storedData);

          const res = await emitWithTimeout('player:reconnect', {
            pin,
            playerId: storedData.playerId,
            reconnectToken: storedData.reconnectToken,
          }, 10000);

          if (res.success && res.data) {
            const p = res.data.player;
            setPlayer(p);
            setScore(p.score || 0);
            setStreak(p.streak || 0);
            if (res.data.syncState) {
              applySyncState(res.data.syncState);
            }
          } else {
            joinNewPlayer(nameFromSession);
          }
        } catch (e) {
          joinNewPlayer(nameFromSession);
        }
      } else if (nameFromSession) {
        joinNewPlayer(nameFromSession);
      } else {
        router.push(`/?pin=${pin}`);
      }
    }

    async function joinNewPlayer(nameVal: string | null) {
      const pName = nameVal || `Player_${Math.floor(100 + Math.random() * 900)}`;
      const res = await emitWithTimeout('player:join', { pin, name: pName }, 10000);

      if (res.success && res.data?.player) {
        const p = res.data.player;
        setPlayer(p);
        setScore(p.score || 0);
        setStreak(p.streak || 0);

        localStorage.getItem(
          `aura_quiz_player_${pin}`,
        );
        localStorage.setItem(
          `aura_quiz_player_${pin}`,
          JSON.stringify({
            pin,
            playerId: p.id,
            name: p.name,
            reconnectToken: p.reconnectToken,
          }),
        );
      } else {
        setReconnectError(res.message || 'Failed to join quiz room');
      }
    }

    function applySyncState(sync: any) {
      if (!sync) return;
      setSessionState(sync.status);
      setRemainingSeconds(sync.remainingSeconds || 0);
      setCurrentQuestion(sync.currentQuestion);
      setHasAnswered(sync.hasAnswered);
      if (sync.selectedOptionId) {
        setSelectedOptionId(sync.selectedOptionId);
      }
      if (sync.leaderboard) {
        setLeaderboard(sync.leaderboard);
      }
      if (sync.player) {
        setScore(sync.player.score || 0);
        setStreak(sync.player.streak || 0);
      }
    }

    initSession();

    // Canonical & Legacy Event Listeners
    socket.on('session:sync', (sync: any) => {
      applySyncState(sync);
    });

    socket.on('question:start', (data: any) => {
      setSessionState('QUESTION_ACTIVE');
      setCurrentQuestion(data.question);
      setRemainingSeconds(data.remainingSeconds);
      setHasAnswered(false);
      setSelectedOptionId(null);
      setAnswerResult(null);
    });

    socket.on('quiz_started', (data: any) => {
      setSessionState('QUESTION_ACTIVE');
      if (data.question) setCurrentQuestion(data.question);
      if (data.remainingSeconds) setRemainingSeconds(data.remainingSeconds);
      setHasAnswered(false);
      setSelectedOptionId(null);
      setAnswerResult(null);
    });

    socket.on('question:skip', () => {
      setSessionState('QUESTION_LOCKED');
    });

    socket.on('answer:reveal', (data: any) => {
      setSessionState('ANSWER_REVEAL');
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    socket.on('quiz:finished', (data: any) => {
      setSessionState('QUIZ_FINISHED');
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    return () => {
      socket.off('session:sync');
      socket.off('question:start');
      socket.off('quiz_started');
      socket.off('question:skip');
      socket.off('answer:reveal');
      socket.off('quiz:finished');
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

  const handleSelectOption = async (optionId: string) => {
    if (hasAnswered || selectedOptionId || sessionState !== 'QUESTION_ACTIVE' || !player) return;

    setSelectedOptionId(optionId);
    setHasAnswered(true);

    const res = await emitWithTimeout('player:answer', {
      pin,
      playerId: player.id,
      questionId: currentQuestion.id,
      optionId,
    }, 10000);

    if (res.success && res.data) {
      if (res.data.newScore !== undefined) setScore(res.data.newScore);
      if (res.data.newStreak !== undefined) setStreak(res.data.newStreak);
      setAnswerResult(res.data);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between">
      <header className="px-6 py-4 bg-slate-950/60 border-b border-slate-800/40 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Room PIN: {pin}</p>
          <h2 className="text-sm font-extrabold text-indigo-400 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>{player?.name || 'Participant'}</span>
          </h2>
        </div>

        <div className="flex items-center gap-4 text-xs font-black text-slate-200">
          <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full">
            <Award className="w-4 h-4 text-amber-400" />
            <span>{score} pts</span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
              <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
              <span>x{streak}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {reconnectError && (
            <motion.div
              key="err"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-4 bg-rose-500/10 border border-rose-500/30 p-6 rounded-2xl"
            >
              <h3 className="text-lg font-bold text-rose-400">{reconnectError}</h3>
              <button
                onClick={() => {
                  localStorage.removeItem(`aura_quiz_player_${pin}`);
                  window.location.reload();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors"
              >
                Rejoin as New Player
              </button>
            </motion.div>
          )}

          {!reconnectError && sessionState === 'LOBBY' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <div className="p-4 bg-indigo-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                <Smile className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-black text-white">You're in the Lobby!</h3>
              <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
                Waiting for the host to launch the quiz. Refreshing will not drop your connection!
              </p>
            </motion.div>
          )}

          {!reconnectError && sessionState === 'QUESTION_ACTIVE' && currentQuestion && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-6"
            >
              <div className="flex justify-between items-center border-b border-slate-800/40 pb-4">
                <span className="text-xs text-indigo-400 font-extrabold uppercase tracking-wider">
                  Question #{currentQuestion.order + 1}
                </span>
                <span className="text-xs font-black text-slate-300 flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                  <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  <span>{remainingSeconds}s</span>
                </span>
              </div>

              <div className="text-center">
                <h3 className="font-extrabold text-lg text-slate-100 leading-snug">{currentQuestion.text}</h3>
              </div>

              {!hasAnswered ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {currentQuestion.options?.map((o: any, idx: number) => (
                    <button
                      key={o.id}
                      onClick={() => handleSelectOption(o.id)}
                      className={`p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-left flex items-center gap-3 transition-all hover:scale-102 active:scale-95 text-slate-200`}
                    >
                      <span
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-white font-black text-xs ${
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
                      <span className="font-bold text-xs leading-snug">{o.text}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 space-y-3">
                  <CheckCircle className="w-10 h-10 text-indigo-400 mx-auto" />
                  <h4 className="font-extrabold text-base text-indigo-300">Answer Submitted!</h4>
                  <p className="text-xs text-slate-400">Waiting for question timer to finish...</p>
                </div>
              )}
            </motion.div>
          )}

          {!reconnectError && sessionState === 'QUESTION_LOCKED' && (
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-lg font-bold text-indigo-400">Time's Up!</h3>
              <p className="text-xs text-slate-400">Host is revealing answer statistics...</p>
            </motion.div>
          )}

          {!reconnectError && sessionState === 'ANSWER_REVEAL' && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 w-full"
            >
              {answerResult?.isCorrect ? (
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="text-2xl font-black text-emerald-400">Correct!</h3>
                  <p className="text-sm font-extrabold text-white">+{answerResult.pointsEarned} Points</p>
                </div>
              ) : (
                <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
                  <XCircle className="w-12 h-12 text-rose-400 mx-auto" />
                  <h3 className="text-2xl font-black text-rose-400">Incorrect!</h3>
                  <p className="text-xs text-slate-400">No points awarded for this question.</p>
                </div>
              )}

              <p className="text-xs text-slate-500">Host is reviewing leaderboard...</p>
            </motion.div>
          )}

          {!reconnectError && sessionState === 'LEADERBOARD' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-4 text-center"
            >
              <h3 className="text-xl font-black text-amber-400 flex items-center justify-center gap-2">
                <Award className="w-6 h-6" />
                <span>Current Leaderboard</span>
              </h3>
              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                {leaderboard.map((p, idx) => (
                  <div key={p.id} className="py-2.5 flex justify-between items-center text-xs font-extrabold">
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className={p.id === player?.id ? 'text-indigo-400 font-black' : 'text-slate-200'}>
                        {p.name} {p.id === player?.id ? '(You)' : ''}
                      </span>
                    </span>
                    <span className="text-slate-300">{p.score} pts</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {!reconnectError && sessionState === 'QUIZ_FINISHED' && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="p-4 bg-amber-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto border border-amber-500/20">
                <Award className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-3xl font-black text-amber-400">Quiz Completed!</h3>
              <p className="text-slate-300 text-sm">
                Final Score: <strong className="text-white font-extrabold">{score} pts</strong>
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem(`aura_quiz_player_${pin}`);
                  disconnectSocket();
                  router.push('/');
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/20"
              >
                Return to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="px-6 py-4 bg-slate-950/60 border-t border-slate-800/40">
        <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest font-black">
          Real-Time Quiz Platform Gateway
        </p>
      </footer>
    </div>
  );
}
