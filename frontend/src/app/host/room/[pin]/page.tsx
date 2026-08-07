"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSocket, emitWithTimeout, disconnectSocket } from "@/lib/socket";
import { getBackendUrl } from "@/lib/api";
import {
  Users,
  Play,
  ArrowRight,
  Trophy,
  MessageSquare,
  Flame,
  Send,
  Download,
  Check,
  HelpCircle,
  FastForward,
  Eye,
  ShieldAlert,
  QrCode,
  UserX,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

export default function HostRoom() {
  const router = useRouter();
  const { pin } = useParams() as { pin: string };

  const [players, setPlayers] = useState<any[]>([]);
  const [sessionState, setSessionState] = useState<string>("LOBBY");
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(1);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [stats, setStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

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
    setPlayers([]);
    setLeaderboard([]);
    setStats(null);
    setCurrentQuestion(null);
    setErrorMsg(null);

    const socket = getSocket();

    async function syncHost() {
      const res = await emitWithTimeout("player:sync", { pin }, 10000);
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
      if (sync.leaderboard)
        setLeaderboard(deduplicateLeaderboard(sync.leaderboard));
    }

    syncHost();

    socket.on("lobby_update", (playerList: any[]) => {
      setPlayers(playerList.filter((p) => p.name !== "_HOST_MOCK_"));
    });

    socket.on("session:sync", (sync: any) => {
      applySyncState(sync);
    });

    socket.on("question:start", (data: any) => {
      setSessionState("QUESTION_ACTIVE");
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.questionIndex || 0);
      setTotalQuestions(data.totalQuestions || 1);
      setRemainingSeconds(data.remainingSeconds || 20);
      setStats(null);
    });

    socket.on("question:skip", (data: any) => {
      setSessionState("QUESTION_LOCKED");
      if (data.stats) setStats(data.stats);
    });

    socket.on("answer:reveal", (data: any) => {
      setSessionState("ANSWER_REVEAL");
      if (data.stats) setStats(data.stats);
      if (data.leaderboard)
        setLeaderboard(deduplicateLeaderboard(data.leaderboard));
    });

    socket.on("leaderboard:update", (data: any) => {
      setSessionState("LEADERBOARD");
      if (data.leaderboard)
        setLeaderboard(deduplicateLeaderboard(data.leaderboard));
    });

    socket.on("quiz:finished", (data: any) => {
      setSessionState("QUIZ_FINISHED");
      if (data.leaderboard)
        setLeaderboard(deduplicateLeaderboard(data.leaderboard));

      try {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignore
      }
    });

    socket.on("chat_message", (msg: any) => {
      setChatMessages((prev) => [...prev, msg].slice(-40));
    });

    return () => {
      socket.off("lobby_update");
      socket.off("session:sync");
      socket.off("question:start");
      socket.off("question:skip");
      socket.off("answer:reveal");
      socket.off("leaderboard:update");
      socket.off("quiz:finished");
      socket.off("chat_message");
    };
  }, [pin]);

  // Local second countdown
  useEffect(() => {
    if (sessionState !== "QUESTION_ACTIVE" || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState, remainingSeconds]);

  const getHostId = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        return JSON.parse(userStr).id;
      } catch {}
    }
    return "host_id_default";
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleKickPlayer = async (playerId: string) => {
    const socket = getSocket();
    socket.emit("host:kick_player", { pin, playerId, hostId: getHostId() });
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
  };

  const handleStartGame = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout(
      "host:start",
      { pin, hostId: getHostId() },
      10000,
    );
    if (res.success && res.data) {
      setSessionState("QUESTION_ACTIVE");
      if (res.data.question) setCurrentQuestion(res.data.question);
      if (res.data.remainingSeconds)
        setRemainingSeconds(res.data.remainingSeconds);
    } else {
      setErrorMsg(res.message || "Failed to start quiz");
    }
  };

  const handleSkipQuestion = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout(
      "host:skip",
      { pin, hostId: getHostId() },
      10000,
    );
    if (!res.success) {
      setErrorMsg(res.message || "Failed to skip question");
    }
  };

  const handleShowAnswer = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout(
      "host:showAnswer",
      { pin, hostId: getHostId() },
      10000,
    );
    if (!res.success) {
      setErrorMsg(res.message || "Failed to show answer");
    }
  };

  const handleShowLeaderboard = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout(
      "host:showLeaderboard",
      { pin, hostId: getHostId() },
      10000,
    );
    if (!res.success) {
      setErrorMsg(res.message || "Failed to show leaderboard");
    }
  };

  const handleNextQuestion = async () => {
    setErrorMsg(null);
    const res = await emitWithTimeout(
      "host:next",
      { pin, hostId: getHostId() },
      10000,
    );
    if (!res.success) {
      setErrorMsg(res.message || "Failed to advance question");
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const socket = getSocket();
    socket.emit("send_chat", { pin, name: "Host", message: chatInput });
    setChatInput("");
  };

  const handleExportCsv = () => {
    const hostToken = localStorage.getItem("token");
    const backendUrl = getBackendUrl();
    window.open(
      `${backendUrl}/analytics/session/csv?pin=${pin}&token=${hostToken}`,
      "_blank",
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden">
      {/* Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <Badge variant="live" pulse>
            Host Control Room
          </Badge>
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 font-mono text-sm">
            <span className="text-slate-400">PIN:</span>
            <span className="font-bold text-white tracking-wider">{pin}</span>
            <button
              onClick={handleCopyPin}
              className="text-indigo-400 hover:text-indigo-300 ml-1"
            >
              {copiedPin ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="w-4 h-4 mr-1 text-cyan-400" /> Show QR
          </Button>
          <span className="text-slate-300 text-xs flex items-center gap-1.5 font-bold">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>{players.length} Joined</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              disconnectSocket();
              router.push("/host");
            }}
          >
            Exit Session
          </Button>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-2 text-center text-xs text-rose-400 font-bold flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Host Interface */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
        <div className="lg:col-span-3 flex flex-col justify-between space-y-8 min-h-[70vh]">
          <AnimatePresence mode="wait">
            {/* LOBBY STATE */}
            {sessionState === "LOBBY" && (
              <motion.div
                key="lobby-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-3">
                  <p className="text-indigo-400 text-xs font-black uppercase tracking-widest">
                    Join Game PIN
                  </p>
                  <h1 className="text-6xl sm:text-7xl font-black tracking-widest text-white animate-pulse">
                    {pin}
                  </h1>
                  <p className="text-slate-400 text-xs max-w-md mx-auto">
                    Instruct participants to enter this PIN at{" "}
                    <strong className="text-white">AuraQuiz</strong>
                  </p>
                </div>

                {/* Player Grid with Kick Action */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>Lobby Participants ({players.length})</span>
                    </h3>
                  </div>

                  {players.length === 0 ? (
                    <Card
                      variant="glass"
                      className="p-8 text-center text-xs text-slate-500 font-bold"
                    >
                      Waiting for participants to join...
                    </Card>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {players.map((p) => (
                        <div
                          key={p.id}
                          className="group relative px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-center font-extrabold text-slate-200 text-xs shadow-md transition-all hover:border-rose-500/50"
                        >
                          <span className="block truncate">{p.name}</span>
                          <button
                            onClick={() => handleKickPlayer(p.id)}
                            className="absolute inset-0 bg-rose-950/90 text-rose-300 font-bold text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                          >
                            <UserX className="w-3.5 h-3.5" /> Kick
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 text-center">
                  <Button
                    variant="glowing"
                    size="xl"
                    onClick={handleStartGame}
                    disabled={players.length === 0}
                  >
                    Launch Quiz Session{" "}
                    <Play className="w-5 h-5 ml-1 fill-white" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* QUESTION ACTIVE STATE */}
            {sessionState === "QUESTION_ACTIVE" && currentQuestion && (
              <motion.div
                key="playing-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                <div className="text-center space-y-2">
                  <Badge variant="info">
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                  </Badge>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 max-w-3xl mx-auto leading-snug">
                    {currentQuestion.text}
                  </h2>
                </div>

                <div className="flex justify-center my-4">
                  <div className="relative w-36 h-36 flex items-center justify-center rounded-full bg-slate-900 border-4 border-indigo-500/40 shadow-2xl">
                    <span className="text-5xl font-black text-indigo-400">
                      {remainingSeconds}
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex justify-center gap-3">
                  <Button variant="secondary" onClick={handleSkipQuestion}>
                    <FastForward className="w-4 h-4 mr-1.5 text-amber-400" />{" "}
                    Skip Question
                  </Button>

                  <Button variant="primary" onClick={handleShowAnswer}>
                    <Eye className="w-4 h-4 mr-1.5" /> Show Answer Statistics
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ANSWER REVEAL / QUESTION LOCKED STATE */}
            {(sessionState === "ANSWER_REVEAL" ||
              sessionState === "QUESTION_LOCKED") &&
              stats && (
                <motion.div
                  key="reveal-step"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 flex-1 flex flex-col justify-between"
                >
                  <div className="text-center space-y-1">
                    <Badge variant="success">Question Answer Revealed</Badge>
                    <h2 className="text-2xl font-extrabold text-white max-w-2xl mx-auto">
                      {stats.questionText}
                    </h2>
                  </div>

                  {/* Response Distribution Bar Chart */}
                  <div className="space-y-3 max-w-2xl mx-auto w-full my-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Response Distribution ({stats.totalResponses} submissions)
                    </h3>

                    <div className="space-y-3">
                      {stats.options?.map((o: any, idx: number) => {
                        const percentage =
                          stats.totalResponses > 0
                            ? (o.count / stats.totalResponses) * 100
                            : 0;
                        return (
                          <div key={o.id} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold">
                              <span className="flex items-center gap-2 text-slate-200">
                                <span>{o.text}</span>
                                {o.isCorrect && (
                                  <Check className="w-4 h-4 text-emerald-400 stroke-[3px]" />
                                )}
                              </span>
                              <span className="text-slate-400">
                                {o.count} ({Math.round(percentage)}%)
                              </span>
                            </div>

                            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                              <div
                                style={{ width: `${percentage}%` }}
                                className={`h-full rounded-full transition-all duration-700 ${
                                  o.isCorrect
                                    ? "bg-emerald-500"
                                    : "bg-slate-700"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 text-center flex justify-center gap-3">
                    <Button variant="glowing" onClick={handleShowLeaderboard}>
                      <Trophy className="w-4 h-4 mr-1 text-amber-400" /> Show
                      Leaderboard
                    </Button>
                  </div>
                </motion.div>
              )}

            {/* LEADERBOARD STATE */}
            {sessionState === "LEADERBOARD" && (
              <motion.div
                key="leaderboard-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 flex-1 flex flex-col justify-center"
              >
                <div className="text-center space-y-1">
                  <Badge variant="warning">Current Leaderboard</Badge>
                  <h2 className="text-2xl font-black text-white">
                    Top Standings
                  </h2>
                </div>

                <Card
                  variant="glass"
                  className="max-w-2xl mx-auto w-full p-4 divide-y divide-slate-800"
                >
                  {leaderboard.slice(0, 5).map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center py-3 font-extrabold text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                            idx === 0
                              ? "bg-amber-400 text-slate-950"
                              : idx === 1
                                ? "bg-slate-300 text-slate-950"
                                : idx === 2
                                  ? "bg-amber-600 text-white"
                                  : "bg-slate-800 text-slate-400"
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
                </Card>

                <div className="pt-4 text-center">
                  <Button variant="primary" onClick={handleNextQuestion}>
                    Proceed to Next Question{" "}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* QUIZ FINISHED STATE */}
            {sessionState === "QUIZ_FINISHED" && (
              <motion.div
                key="finished-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 flex-1 flex flex-col justify-center text-center"
              >
                <Trophy className="w-16 h-16 text-amber-400 mx-auto animate-bounce" />
                <h2 className="text-4xl font-black text-amber-400">
                  Quiz Completed!
                </h2>

                <Card variant="glass" className="max-w-md mx-auto w-full p-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                    Top Champions
                  </h4>
                  {leaderboard.slice(0, 3).map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center py-2 text-xs font-extrabold border-b border-slate-800/60 last:border-0"
                    >
                      <span className="text-slate-200">
                        #{idx + 1} {p.name}
                      </span>
                      <span className="text-amber-400">{p.score} pts</span>
                    </div>
                  ))}
                </Card>

                <div className="flex justify-center gap-3 pt-2">
                  <Button variant="primary" onClick={handleExportCsv}>
                    <Download className="w-4 h-4 mr-1.5" /> Download Report
                    (CSV)
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => {
                      disconnectSocket();
                      router.push("/host");
                    }}
                  >
                    Back to Quizzes
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Room Chat */}
        <Card
          variant="glass"
          className="lg:col-span-1 p-5 flex flex-col justify-between h-[70vh] border border-slate-800/80"
        >
          <div className="space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-3">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Live Room Chat</span>
            </h3>

            <div className="space-y-3 h-[42vh] overflow-y-auto pr-1 text-xs">
              {chatMessages.length === 0 ? (
                <div className="text-center py-20 text-slate-600 font-bold text-[11px]">
                  No chat messages yet.
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 space-y-1"
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-indigo-400">
                        {msg.name}
                      </span>
                      <span className="text-slate-600">{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed text-[11px]">
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <form
            onSubmit={handleSendChat}
            className="flex gap-2 border-t border-slate-800 pt-4"
          >
            <input
              type="text"
              placeholder="Send message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs focus:outline-none placeholder:text-slate-600 text-slate-100"
            />
            <Button variant="primary" size="sm" type="submit">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </Card>
      </main>

      {/* QR Code Join Modal */}
      <Modal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        title="Scan QR Code to Join"
      >
        <div className="text-center space-y-4">
          <p className="text-xs text-slate-400">
            Scan with your mobile camera to join PIN {pin} instantly
          </p>
          <div className="inline-block p-4 bg-white rounded-2xl border border-slate-200 shadow-xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                typeof window !== "undefined"
                  ? `${window.location.protocol}//${window.location.host}/?pin=${pin}`
                  : `https://auraquiz.com/?pin=${pin}`,
              )}`}
              alt="Join QR Code"
              className="w-48 h-48 mx-auto"
            />
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowQrModal(false)}
          >
            Close Modal
          </Button>
        </div>
      </Modal>
    </div>
  );
}
