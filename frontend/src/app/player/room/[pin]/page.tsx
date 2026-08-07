"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getSocket, emitWithTimeout, disconnectSocket } from "@/lib/socket";
import {
  Smile,
  Award,
  Flame,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Triangle,
  Diamond,
  Circle,
  Square,
  Wifi,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";

export default function PlayerRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pin } = useParams() as { pin: string };
  const queryName = searchParams.get("name");

  const [player, setPlayer] = useState<any>(null);
  const [sessionState, setSessionState] = useState<string>("LOBBY");
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

  const deduplicateLeaderboard = (list: any[]): any[] => {
    if (!Array.isArray(list)) return [];
    const map = new Map<string, any>();
    for (const item of list) {
      if (!item || !item.name) continue;
      const key = item.name.trim().toLowerCase();
      if (!map.has(key) || (item.score || 0) > (map.get(key).score || 0)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => (b.score || 0) - (a.score || 0),
    );
  };

  useEffect(() => {
    const socket = getSocket();
    const storedDataStr = localStorage.getItem(`cognition_gim_player_${pin}`);

    async function initSession() {
      if (storedDataStr) {
        try {
          const storedData = JSON.parse(storedDataStr);
          setPlayer(storedData);

          const res = await emitWithTimeout(
            "player:reconnect",
            {
              pin,
              playerId: storedData.playerId,
              reconnectToken: storedData.reconnectToken,
            },
            10000,
          );

          if (res.success && res.data) {
            const p = res.data.player;
            setPlayer(p);
            setScore(p.score || 0);
            setStreak(p.streak || 0);
            if (res.data.syncState) {
              applySyncState(res.data.syncState);
            }
          } else {
            // Token expired -> Try joining with queryName or redirect
            if (queryName) {
              await attemptJoin(queryName);
            } else {
              localStorage.removeItem(`cognition_gim_player_${pin}`);
              router.push(`/?pin=${pin}`);
            }
          }
        } catch {
          if (queryName) {
            await attemptJoin(queryName);
          } else {
            localStorage.removeItem(`cognition_gim_player_${pin}`);
            router.push(`/?pin=${pin}`);
          }
        }
      } else if (queryName) {
        await attemptJoin(queryName);
      } else {
        router.push(`/?pin=${pin}`);
      }
    }

    async function attemptJoin(nameToUse: string) {
      try {
        const res = await emitWithTimeout(
          "player:join",
          { pin, name: nameToUse },
          10000,
        );
        if (res.success && res.data) {
          const p = res.data.player;
          const saveData = {
            playerId: p.id,
            reconnectToken: p.reconnectToken,
            name: p.name,
          };
          localStorage.setItem(
            `cognition_gim_player_${pin}`,
            JSON.stringify(saveData),
          );
          setPlayer(saveData);
          setScore(p.score || 0);
          setStreak(p.streak || 0);
        } else {
          setReconnectError(res.message || "Failed to join room");
        }
      } catch (err: any) {
        setReconnectError(err.message || "Connection error joining room");
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
        setLeaderboard(deduplicateLeaderboard(sync.leaderboard));
      }
      if (sync.player) {
        setScore(sync.player.score || 0);
        setStreak(sync.player.streak || 0);
      }
    }

    initSession();

    // Socket Event Listeners
    socket.on("session:sync", (sync: any) => {
      applySyncState(sync);
    });

    socket.on("question:start", (data: any) => {
      setSessionState("QUESTION_ACTIVE");
      setCurrentQuestion(data.question);
      setRemainingSeconds(data.remainingSeconds);
      setHasAnswered(false);
      setSelectedOptionId(null);
      setAnswerResult(null);
    });

    socket.on("quiz_started", (data: any) => {
      setSessionState("QUESTION_ACTIVE");
      if (data.question) setCurrentQuestion(data.question);
      if (data.remainingSeconds) setRemainingSeconds(data.remainingSeconds);
      setHasAnswered(false);
      setSelectedOptionId(null);
      setAnswerResult(null);
    });

    socket.on("question:skip", () => {
      setSessionState("QUESTION_LOCKED");
    });

    socket.on("answer:reveal", (data: any) => {
      setSessionState("ANSWER_REVEAL");
      if (data.leaderboard)
        setLeaderboard(deduplicateLeaderboard(data.leaderboard));
    });

    socket.on("quiz:finished", (data: any) => {
      setSessionState("QUIZ_FINISHED");
      if (data.leaderboard)
        setLeaderboard(deduplicateLeaderboard(data.leaderboard));
      // Trigger confetti celebration on quiz completion
      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch {
        // Ignore if confetti disabled
      }
    });

    return () => {
      socket.off("session:sync");
      socket.off("question:start");
      socket.off("quiz_started");
      socket.off("question:skip");
      socket.off("answer:reveal");
      socket.off("quiz:finished");
    };
  }, [pin, queryName, router]);

  // Keyboard navigation for Option Selection (Keys 1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        sessionState !== "QUESTION_ACTIVE" ||
        hasAnswered ||
        !currentQuestion?.options
      )
        return;
      const keyIndex = parseInt(e.key) - 1;
      if (
        !isNaN(keyIndex) &&
        keyIndex >= 0 &&
        keyIndex < currentQuestion.options.length
      ) {
        handleSelectOption(currentQuestion.options[keyIndex].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessionState, hasAnswered, currentQuestion]);

  // Local second countdown
  useEffect(() => {
    if (sessionState !== "QUESTION_ACTIVE" || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState, remainingSeconds]);

  const handleSelectOption = async (optionId: string) => {
    if (
      hasAnswered ||
      selectedOptionId ||
      sessionState !== "QUESTION_ACTIVE" ||
      !player
    )
      return;

    setSelectedOptionId(optionId);
    setHasAnswered(true);

    const res = await emitWithTimeout(
      "player:answer",
      {
        pin,
        playerId: player.playerId || player.id,
        questionId: currentQuestion.id,
        optionId,
      },
      10000,
    );

    if (res.success && res.data) {
      if (res.data.newScore !== undefined) setScore(res.data.newScore);
      if (res.data.newStreak !== undefined) setStreak(res.data.newStreak);
      setAnswerResult(res.data);
    }
  };

  const optionShapes = [
    {
      icon: <Triangle className="w-5 h-5 fill-current" />,
      color:
        "bg-rose-600 hover:bg-rose-500 border-rose-400/40 text-white shadow-rose-600/30",
    },
    {
      icon: <Diamond className="w-5 h-5 fill-current" />,
      color:
        "bg-blue-600 hover:bg-blue-500 border-blue-400/40 text-white shadow-blue-600/30",
    },
    {
      icon: <Circle className="w-5 h-5 fill-current" />,
      color:
        "bg-amber-500 hover:bg-amber-400 border-amber-300/40 text-slate-950 shadow-amber-500/30",
    },
    {
      icon: <Square className="w-5 h-5 fill-current" />,
      color:
        "bg-emerald-600 hover:bg-emerald-500 border-emerald-400/40 text-white shadow-emerald-600/30",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="px-6 py-4 bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-xl flex justify-between items-center sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-black">
              PIN: {pin}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs font-extrabold shrink-0">
          <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-md shrink-0">
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <span>{score} pts</span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-1 rounded-full shadow-md shrink-0">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 fill-orange-500 animate-pulse shrink-0" />
              <span>x{streak}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Real-Time Quiz Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-xl mx-auto">
        <AnimatePresence mode="wait">
          {reconnectError && (
            <motion.div
              key="err"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 bg-rose-500/10 border border-rose-500/30 p-8 rounded-3xl backdrop-blur-xl shadow-2xl"
            >
              <XCircle className="w-12 h-12 text-rose-400 mx-auto" />
              <h3 className="text-xl font-extrabold text-rose-300">
                {reconnectError}
              </h3>
              <Button
                variant="danger"
                onClick={() => {
                  localStorage.removeItem(`cognition_gim_player_${pin}`);
                  router.push(`/?pin=${pin}`);
                }}
              >
                Rejoin Lobby
              </Button>
            </motion.div>
          )}

          {!reconnectError && sessionState === "LOBBY" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6 bg-slate-900/60 border border-slate-800 p-10 rounded-3xl backdrop-blur-xl shadow-2xl"
            >
              <div className="p-5 bg-indigo-500/10 rounded-full w-24 h-24 flex items-center justify-center mx-auto border border-indigo-500/30 shadow-inner">
                <Smile className="w-12 h-12 text-indigo-400 animate-bounce" />
              </div>
              <div>
                <h3 className="text-3xl font-black text-white">
                  You're in the Lobby!
                </h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                  Waiting for host to launch the quiz. Your connection is secure
                  and resilient.
                </p>
              </div>
            </motion.div>
          )}

          {!reconnectError &&
            sessionState === "QUESTION_ACTIVE" &&
            currentQuestion && (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full space-y-6"
              >
                {/* Question Header & Radial Seconds Bar */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <span className="text-xs font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    Question #{currentQuestion.order + 1}
                  </span>
                  <div className="flex items-center gap-2 bg-slate-900 px-4 py-1.5 rounded-full border border-slate-800 text-sm font-black text-slate-100 shadow-inner">
                    <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span>{remainingSeconds}s remaining</span>
                  </div>
                </div>

                {/* Question Prompt */}
                <div className="text-center bg-slate-900/80 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl space-y-2 sm:space-y-3">
                  <h3 className="font-extrabold text-lg sm:text-2xl text-white leading-snug">
                    {currentQuestion.text}
                  </h3>

                  {currentQuestion.imageUrl && (
                    <div className="flex justify-center pt-1">
                      <img
                        src={currentQuestion.imageUrl}
                        alt="Question graphic"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                        className="max-h-32 sm:max-h-48 rounded-xl object-contain border border-slate-800 bg-slate-950 p-1 shadow-lg"
                      />
                    </div>
                  )}
                </div>

                {/* Kahoot-Style 2x2 Vibrant Answer Buttons (Zero Scroll Mobile Ergonomics) */}
                {!hasAnswered ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-1">
                    {currentQuestion.options?.map((o: any, idx: number) => {
                      const style = optionShapes[idx % 4];
                      return (
                        <button
                          key={o.id}
                          onClick={() => handleSelectOption(o.id)}
                          className={`p-3.5 sm:p-5 rounded-2xl border ${style.color} shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] text-left flex items-center gap-2.5 sm:gap-4 group cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-500/50 min-h-[64px] touch-target`}
                        >
                          <div className="p-2 sm:p-2.5 rounded-xl bg-black/20 shrink-0">
                            {style.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest opacity-80 mb-0.5">
                              Option {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="font-extrabold text-xs sm:text-base leading-snug block truncate">
                              {o.text}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-6 sm:p-10 bg-indigo-500/10 border border-indigo-500/30 rounded-3xl space-y-3 shadow-2xl backdrop-blur-xl">
                    <CheckCircle className="w-10 h-10 sm:w-14 sm:h-14 text-indigo-400 mx-auto animate-pulse" />
                    <h4 className="font-black text-xl sm:text-2xl text-white">
                      Answer Locked In!
                    </h4>
                    <p className="text-xs text-slate-400">
                      Waiting for question timer to finish...
                    </p>
                  </div>
                )}
              </motion.div>
            )}

          {!reconnectError && sessionState === "ANSWER_REVEAL" && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 w-full"
            >
              {answerResult?.isCorrect ? (
                <div className="p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl space-y-3 shadow-2xl backdrop-blur-xl">
                  <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
                  <h3 className="text-3xl font-black text-emerald-400">
                    Correct Answer!
                  </h3>
                  <p className="text-xl font-black text-white">
                    +{answerResult.pointsEarned || 1000} Points
                  </p>
                </div>
              ) : (
                <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-3xl space-y-3 shadow-2xl backdrop-blur-xl">
                  <XCircle className="w-16 h-16 text-rose-400 mx-auto" />
                  <h3 className="text-3xl font-black text-rose-400">
                    Incorrect!
                  </h3>
                  <p className="text-xs text-slate-400">
                    Better luck on the next question.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {!reconnectError && sessionState === "QUIZ_FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 bg-slate-900/80 border border-slate-800 p-10 rounded-3xl backdrop-blur-xl shadow-2xl"
            >
              <div className="p-5 bg-amber-500/10 rounded-full w-24 h-24 flex items-center justify-center mx-auto border border-amber-500/30 shadow-xl">
                <Award className="w-12 h-12 text-amber-400 animate-bounce" />
              </div>
              <div>
                <h3 className="text-3xl font-black text-amber-400">
                  Quiz Complete!
                </h3>
                <p className="text-slate-300 text-lg font-bold mt-2">
                  Final Score:{" "}
                  <span className="text-white font-black text-2xl">
                    {score} pts
                  </span>
                </p>
              </div>
              <Button
                variant="glowing"
                size="lg"
                onClick={() => {
                  localStorage.removeItem(`cognition_gim_player_${pin}`);
                  disconnectSocket();
                  router.push("/");
                }}
              >
                Return to Home
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Status */}
      <footer className="px-6 py-4 bg-slate-900/80 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-500 font-mono flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Powered by
          Cognition | GIM Real-Time Engine
        </p>
      </footer>
    </div>
  );
}
