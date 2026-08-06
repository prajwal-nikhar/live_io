'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { 
  Smile, Award, Sparkles, Flame, CheckCircle, XCircle, 
  Clock, ShieldAlert, Send, Heart, Star, ThumbsUp, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PlayerRoom() {
  const router = useRouter();
  const { pin } = useParams() as { pin: string };

  const [playerName, setPlayerName] = useState('');
  const [status, setStatus] = useState<'LOBBY' | 'PLAYING' | 'LOCKED' | 'REVEAL_ANSWER' | 'FINISHED'>('LOBBY');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  
  // Real-time answers feedback states
  const [feedback, setFeedback] = useState<any>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // Score states
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // Chat/Reactions
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    // Read player identification details
    const name = sessionStorage.getItem('player_name');
    if (!name) {
      router.push('/');
      return;
    }
    setPlayerName(name);

    const socket = getSocket();

    // Rejoin general room channel
    socket.emit('player_join', { pin, name });

    // Handle game state transitions
    socket.on('game_started', () => {
      setStatus('PLAYING');
    });

    socket.on('question_start', (question: any) => {
      setStatus('PLAYING');
      setCurrentQuestion(question);
      setTimeLeft(question.timeLimit);
      setSelectedOptionId(null);
      setFeedback(null);
    });

    socket.on('timer_tick', (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
    });

    socket.on('answer_acknowledged', (data: any) => {
      setStatus('LOCKED');
      setFeedback(data);
      setScore(data.newScore);
      setStreak(data.newStreak);
    });

    socket.on('answer_revealed', (stats: any) => {
      setStatus('REVEAL_ANSWER');
    });

    socket.on('winner_celebration', (data: { podium: any[]; players: any[] }) => {
      setStatus('FINISHED');
      const myRanking = data.players.find(p => p.name === name);
      if (myRanking) {
        setScore(myRanking.score);
        setStreak(myRanking.streak);
      }
    });

    // Chat listener
    socket.on('chat_message', (msg: any) => {
      setChatMessages(prev => [...prev, msg].slice(-20)); // Keep last 20
    });

    return () => {
      socket.off('game_started');
      socket.off('question_start');
      socket.off('timer_tick');
      socket.off('answer_acknowledged');
      socket.off('answer_revealed');
      socket.off('winner_celebration');
      socket.off('chat_message');
    };
  }, [pin]);

  const handleSubmitAnswer = (optionId: string) => {
    if (selectedOptionId) return; // Prevent double taps
    setSelectedOptionId(optionId);
    
    const socket = getSocket();
    socket.emit('submit_answer', {
      pin,
      name: playerName,
      questionId: currentQuestion.id,
      optionId,
    });
  };

  const handleSendReaction = (emoji: string) => {
    const socket = getSocket();
    socket.emit('send_reaction', { pin, emoji });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const socket = getSocket();
    socket.emit('send_chat', { pin, name: playerName, message: chatInput });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between">
      
      {/* Player Header Banner */}
      <header className="px-6 py-4 bg-slate-950/40 border-b border-slate-800/40 flex justify-between items-center">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-extrabold">Participant Connection</p>
          <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>{playerName}</span>
          </h2>
        </div>

        <div className="flex items-center gap-4 text-xs font-extrabold text-slate-300">
          <div className="flex items-center gap-1">
            <Award className="w-4 h-4 text-amber-400" />
            <span>{score} pts</span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
              <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
              <span>x{streak}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main active game container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          
          {/* LOBBY STEP */}
          {status === 'LOBBY' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <div className="p-4 bg-indigo-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto border border-indigo-500/20">
                <Smile className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-black">You are in the Lobby!</h3>
              <p className="text-slate-400 text-sm max-w-sm">
                Host will launch the quiz shortly. Prepare your mind and get ready for sub-200ms quick-fire answering!
              </p>

              {/* Real-time Interactive Reactions Box */}
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800/40 space-y-3">
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-widest block">Send Live Reaction</span>
                <div className="flex justify-center gap-4">
                  {['👍', '❤️', '🔥', '😮', '⚡', '🎉'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      className="text-3xl active:scale-130 transition-transform transform hover:scale-115"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ACTIVE PLAYING STEP */}
          {status === 'PLAYING' && currentQuestion && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-6"
            >
              <div className="flex justify-between items-center border-b border-slate-800/40 pb-4">
                <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                  Q{currentQuestion.order + 1}: Select correct option
                </span>
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>{timeLeft}s left</span>
                </span>
              </div>

              {/* Large Question display for clarity */}
              <div className="text-center">
                <h3 className="font-extrabold text-xl text-slate-100">{currentQuestion.text}</h3>
              </div>

              {/* Highly optimized, responsive option clickable cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {currentQuestion.options?.map((o: any, idx: number) => (
                  <button
                    key={o.id}
                    onClick={() => handleSubmitAnswer(o.id)}
                    className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 text-left flex items-center gap-4 transition-all hover:scale-102 active:scale-95 text-slate-200"
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-white font-extrabold text-sm ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-blue-500' : idx === 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="font-bold text-sm sm:text-base leading-snug">{o.text}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* LOCKED WAITING STEP */}
          {status === 'LOCKED' && feedback && (
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-xl font-bold text-indigo-400">Answer Locked In!</h3>
              <p className="text-slate-400 text-xs">
                Waiting for the rest of the participants to submit their answers.
              </p>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/30 text-xs space-y-1 inline-block">
                <p className="text-slate-500 uppercase tracking-widest font-extrabold text-[10px]">Your Response Stats</p>
                <p>Speed: <code className="text-indigo-400 font-bold">{Math.round((currentQuestion?.timeLimit - timeLeft) * 1000)}ms</code></p>
                <p>Streak: <code className="text-indigo-400 font-bold">{streak} consecutive</code></p>
              </div>
            </motion.div>
          )}

          {/* REVEAL ANSWER STATS STEP */}
          {status === 'REVEAL_ANSWER' && feedback && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              {feedback.isCorrect ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-black text-emerald-400">Correct Answer!</h3>
                  <p className="text-slate-300 font-extrabold text-xl">+{feedback.pointsEarned} Points</p>
                  {streak > 1 && (
                    <p className="text-orange-400 font-bold text-xs flex items-center justify-center gap-1 animate-bounce">
                      <Flame className="w-4 h-4 fill-orange-500" />
                      <span>{streak} Question Hot Streak!</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto border border-rose-500/20">
                    <XCircle className="w-10 h-10 text-rose-400" />
                  </div>
                  <h3 className="text-3xl font-black text-rose-400">Incorrect!</h3>
                  <p className="text-slate-500 font-extrabold text-sm">Better luck next round.</p>
                  <p className="text-rose-400 font-bold text-xs">{feedback.pointsEarned} points penalty</p>
                </div>
              )}
              <p className="text-xs text-slate-500">Waiting for host to proceed to next slide.</p>
            </motion.div>
          )}

          {/* GAME FINISHED STEP */}
          {status === 'FINISHED' && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <div className="p-4 bg-amber-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto border border-amber-500/20">
                <Award className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-3xl font-black text-amber-400">Quiz Completed!</h3>
              <p className="text-slate-300 text-sm max-w-sm">
                You scored a total of <strong className="text-white">{score}</strong> points during this session.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => {
                    disconnectSocket();
                    router.push('/');
                  }}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
                >
                  Return to Home
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Floating Chat Draw for mobile engagement */}
      <footer className="px-6 py-4 bg-slate-950/60 border-t border-slate-800/40 relative z-10">
        <form onSubmit={handleSendChat} className="flex gap-2">
          <input
            type="text"
            placeholder="Type chat message to room..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs focus:outline-none placeholder:text-slate-600 text-slate-100"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Send
          </button>
        </form>
      </footer>

    </div>
  );
}
