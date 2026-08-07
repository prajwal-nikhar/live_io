"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSocket, emitWithTimeout, disconnectSocket } from "@/lib/socket";
import { getBackendUrl, formatImageUrl } from "@/lib/api";
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
  Triangle,
  Diamond,
  Circle,
  Square,
  Clock,
  Search,
  Sparkles,
  Zap,
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
  const [quizTitle, setQuizTitle] = useState<string>("Cognition Fun Quiz");
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(1);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [liveProgress, setLiveProgress] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Large Event Mode State
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantSort, setParticipantSort] = useState<
    "recent" | "alphabetical"
  >("recent");

  const isLargeEvent = players.length >= 30;

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
    setLiveProgress(null);
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
      if (sync.quizTitle) setQuizTitle(sync.quizTitle);
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
      if (data.quizTitle) setQuizTitle(data.quizTitle);
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.questionIndex || 0);
      setTotalQuestions(data.totalQuestions || 1);
      setRemainingSeconds(data.remainingSeconds || 20);
      setLiveProgress(null);
      setStats(null);
    });

    socket.on("answer:progress", (data: any) => {
      if (data) {
        setLiveProgress(data);
      }
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
      socket.off("answer:progress");
      socket.off("question:skip");
      socket.off("answer:reveal");
      socket.off("leaderboard:update");
      socket.off("quiz:finished");
      socket.off("chat_message");
    };
  }, [pin]);

  // Local second countdown with automatic showAnswer fallback when timer hits 0
  useEffect(() => {
    if (sessionState !== "QUESTION_ACTIVE" || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setTimeout(() => {
            handleShowAnswer();
          }, 300);
          return 0;
        }
        return prev - 1;
      });
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

  // Filter & Sort Players for Participant Drawer
  const filteredPlayers = useMemo(() => {
    let result = [...players];
    if (participantSearch.trim()) {
      const q = participantSearch.toLowerCase();
      result = result.filter((p) => p.name && p.name.toLowerCase().includes(q));
    }
    if (participantSort === "alphabetical") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else {
      // Recent (reverse order)
      result.reverse();
    }
    return result;
  }, [players, participantSearch, participantSort]);

  // Last 10 joined players for Large Event Ticker
  const recentTenPlayers = useMemo(() => {
    return [...players].reverse().slice(0, 10);
  }, [players]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden">
      {/* Permanent Sticky Host Control Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-2xl px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <Badge variant="live" pulse>
            Host Control Room
          </Badge>

          {/* Interactive Pinned PIN Copy Badge */}
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 font-mono text-sm shadow-inner">
            <span className="text-slate-400 text-xs font-bold">PIN:</span>
            <span className="font-extrabold text-white tracking-widest">
              {pin}
            </span>
            <button
              onClick={handleCopyPin}
              title="Copy PIN"
              className="text-indigo-400 hover:text-indigo-300 ml-1 transition-colors"
            >
              {copiedPin ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Connected Player Count Badge */}
          <button
            onClick={() => setShowParticipantsDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all"
          >
            <Users className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{players.length} Connected</span>
          </button>
        </div>

        {/* Dynamic Contextual Action Buttons Pinned in Control Bar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {sessionState === "LOBBY" && (
            <Button
              variant="glowing"
              size="sm"
              onClick={handleStartGame}
              disabled={players.length === 0}
            >
              <Play className="w-4 h-4 mr-1 fill-white shrink-0" /> Start Quiz
            </Button>
          )}

          {sessionState === "QUESTION_ACTIVE" && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSkipQuestion}
              >
                <FastForward className="w-4 h-4 mr-1 text-amber-400 shrink-0" />{" "}
                Skip
              </Button>
              <Button variant="primary" size="sm" onClick={handleShowAnswer}>
                <Eye className="w-4 h-4 mr-1 shrink-0" /> Show Stats
              </Button>
            </>
          )}

          {(sessionState === "ANSWER_REVEAL" ||
            sessionState === "QUESTION_LOCKED") && (
            <Button variant="glowing" size="sm" onClick={handleShowLeaderboard}>
              <Trophy className="w-4 h-4 mr-1 text-amber-400 shrink-0" />{" "}
              Leaderboard
            </Button>
          )}

          {sessionState === "LEADERBOARD" && (
            <Button variant="primary" size="sm" onClick={handleNextQuestion}>
              Next Question <ArrowRight className="w-4 h-4 ml-1 shrink-0" />
            </Button>
          )}

          {sessionState === "QUIZ_FINISHED" && (
            <Button variant="primary" size="sm" onClick={handleExportCsv}>
              <Download className="w-4 h-4 mr-1 shrink-0" /> CSV Report
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="hidden sm:inline ml-1">QR Code</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              disconnectSocket();
              router.push("/host");
            }}
          >
            Exit
          </Button>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 text-center text-xs text-rose-400 font-bold flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Host Interface */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 relative z-10">
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
                {/* 1. ADAPTIVE LOBBY LAYOUT (<30 vs >=30 Players) */}
                {!isLargeEvent ? (
                  /* Standard Mode (<30 Players): Large PIN & Large QR Side-by-Side */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-900/60 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
                    <div className="text-center space-y-4">
                      <p className="text-indigo-400 text-xs font-black uppercase tracking-widest">
                        ROOM PIN
                      </p>
                      <h1 className="text-5xl sm:text-6xl font-black tracking-widest text-white animate-pulse">
                        {pin}
                      </h1>
                      <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
                        or visit{" "}
                        <strong className="text-indigo-300 font-extrabold">
                          cognition.up.railway.app
                        </strong>
                      </p>
                    </div>

                    <div className="text-center space-y-2 border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-8">
                      <p className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                        <QrCode className="w-4 h-4" /> Scan to Join Instantly
                      </p>
                      <div className="inline-block p-3 rounded-2xl bg-white border border-slate-100 shadow-xl my-2">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                            typeof window !== "undefined"
                              ? `${window.location.protocol}//${window.location.host}/?pin=${pin}`
                              : `https://cognition.up.railway.app/?pin=${pin}`,
                          )}`}
                          alt="Join QR Code"
                          className="w-36 h-36 sm:w-44 sm:h-44 mx-auto"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 2. LARGE EVENT MODE (>=30 Players): Summary Hero Card & Last 10 Joined Ticker */
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-8 rounded-3xl backdrop-blur-2xl shadow-2xl space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800/80 pb-6">
                      <div className="space-y-2 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-extrabold">
                          <Zap className="w-3.5 h-3.5 fill-indigo-400 animate-bounce" />
                          <span>Large Event Mode Active</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
                          <span>{players.length}</span>
                          <span className="text-slate-400 text-2xl font-bold">
                            Participants Connected
                          </span>
                        </h1>
                        <p className="text-slate-400 text-xs">
                          Instruct audience to enter PIN{" "}
                          <strong className="text-indigo-300 font-mono">
                            {pin}
                          </strong>{" "}
                          at{" "}
                          <strong className="text-white">
                            cognition.up.railway.app
                          </strong>
                        </p>
                      </div>

                      {/* Compact QR Badge */}
                      <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => setShowQrModal(true)}
                          className="p-2.5 rounded-2xl bg-white hover:scale-105 transition-transform shadow-xl border border-slate-100"
                          title="Expand QR Code"
                        >
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                              typeof window !== "undefined"
                                ? `${window.location.protocol}//${window.location.host}/?pin=${pin}`
                                : `https://cognition.up.railway.app/?pin=${pin}`,
                            )}`}
                            alt="Join QR Code"
                            className="w-20 h-20"
                          />
                        </button>
                        <span className="text-[10px] font-extrabold text-cyan-400 flex items-center gap-1">
                          <QrCode className="w-3 h-3" /> Click to Expand
                        </span>
                      </div>
                    </div>

                    {/* Last 10 Joined Ticker */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Recent Joins</span>
                        </h4>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowParticipantsDrawer(true)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-indigo-400" />{" "}
                          View All Participants ({players.length})
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {recentTenPlayers.map((p, idx) => (
                          <motion.div
                            key={p.id || idx}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-xs font-extrabold text-slate-200 flex items-center gap-2 shadow-sm"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="truncate max-w-[120px]">
                              {p.name}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Standard Mode Player Grid (< 30 Players) */}
                {!isLargeEvent && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span>Lobby Participants ({players.length})</span>
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowParticipantsDrawer(true)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-indigo-400" />{" "}
                        Full Roster
                      </Button>
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
                )}

                {/* Primary Launch Action */}
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
                {/* Header Info */}
                <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/80 border border-slate-800 px-6 py-3 rounded-2xl gap-2">
                  <div className="text-xs font-black text-indigo-400 uppercase tracking-wider">
                    Quiz: <span className="text-white">{quizTitle}</span>
                  </div>
                  <Badge variant="info">
                    Question {currentQuestionIndex + 1} / {totalQuestions}
                  </Badge>
                </div>

                {/* Question Prompt */}
                <div className="text-center space-y-4">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-100 max-w-4xl mx-auto leading-snug">
                    {currentQuestion.text}
                  </h2>

                  {currentQuestion.imageUrl && (
                    <div className="my-3 flex justify-center">
                      <img
                        src={
                          formatImageUrl(currentQuestion.imageUrl) ||
                          currentQuestion.imageUrl
                        }
                        alt="Question graphic"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display =
                            "none";
                        }}
                        className="max-h-52 rounded-2xl object-contain border border-slate-800 bg-slate-950 p-2 shadow-2xl"
                      />
                    </div>
                  )}
                </div>

                {/* Option Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentQuestion.options?.map((o: any, idx: number) => {
                    const shapes = [
                      {
                        label: "🔴 ▲",
                        color:
                          "bg-rose-600/90 border-rose-500/80 text-white shadow-rose-600/20",
                        icon: (
                          <Triangle className="w-5 h-5 fill-current shrink-0" />
                        ),
                        barBg: "bg-rose-400",
                      },
                      {
                        label: "🔵 ◆",
                        color:
                          "bg-blue-600/90 border-blue-500/80 text-white shadow-blue-600/20",
                        icon: (
                          <Diamond className="w-5 h-5 fill-current shrink-0" />
                        ),
                        barBg: "bg-blue-400",
                      },
                      {
                        label: "🟡 ●",
                        color:
                          "bg-amber-500/90 border-amber-400/80 text-slate-950 shadow-amber-500/20",
                        icon: (
                          <Circle className="w-5 h-5 fill-current shrink-0" />
                        ),
                        barBg: "bg-amber-300",
                      },
                      {
                        label: "🟢 ■",
                        color:
                          "bg-emerald-600/90 border-emerald-500/80 text-white shadow-emerald-600/20",
                        icon: (
                          <Square className="w-5 h-5 fill-current shrink-0" />
                        ),
                        barBg: "bg-emerald-400",
                      },
                    ];
                    const style = shapes[idx % 4];

                    const totalResponses = liveProgress?.totalResponses || 0;
                    const optCount =
                      liveProgress?.options?.find((opt: any) => opt.id === o.id)
                        ?.count || 0;
                    const percentage =
                      totalResponses > 0
                        ? Math.round((optCount / totalResponses) * 100)
                        : 0;

                    return (
                      <div
                        key={o.id}
                        className={`p-5 rounded-2xl border ${style.color} shadow-xl flex flex-col justify-between space-y-3 transition-all`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-black/20">
                              {style.icon}
                            </div>
                            <span className="font-extrabold text-base leading-snug">
                              {o.text}
                            </span>
                          </div>
                          <span className="text-xs font-black px-2.5 py-1 rounded-full bg-black/30 shrink-0">
                            {optCount} ({percentage}%)
                          </span>
                        </div>

                        <div className="w-full h-2.5 bg-black/30 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${percentage}%` }}
                            className={`h-full ${style.barBg} transition-all duration-500 rounded-full`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Metrics & Timer */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 px-6 py-4 rounded-2xl">
                  <div className="flex items-center gap-6 text-sm font-extrabold">
                    <div className="flex items-center gap-2 text-indigo-300">
                      <Users className="w-4 h-4 text-indigo-400" />
                      <span>
                        Answered:{" "}
                        <strong className="text-white">
                          {liveProgress?.totalResponses || 0} /{" "}
                          {liveProgress?.totalPlayers || players.length || 1}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-cyan-300">
                      <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span>
                        Time Left:{" "}
                        <strong className="text-white">
                          {remainingSeconds} seconds
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSkipQuestion}
                    >
                      <FastForward className="w-4 h-4 mr-1.5 text-amber-400" />{" "}
                      Skip Question
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleShowAnswer}
                    >
                      <Eye className="w-4 h-4 mr-1.5" /> Show Statistics
                    </Button>
                  </div>
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

                  <div className="space-y-3 max-w-2xl mx-auto w-full my-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Response Distribution ({stats.totalResponses} submissions)
                    </h3>

                    <div className="space-y-3">
                      {stats.options?.map((o: any) => {
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

      {/* 3. PARTICIPANT DRAWER / MODAL FOR LARGE EVENTS */}
      <Modal
        isOpen={showParticipantsDrawer}
        onClose={() => setShowParticipantsDrawer(false)}
        title={`Lobby Participants (${players.length})`}
      >
        <div className="space-y-4">
          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search participant by name..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setParticipantSort("recent")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  participantSort === "recent"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setParticipantSort("alphabetical")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  participantSort === "alphabetical"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                A–Z
              </button>
            </div>
          </div>

          {/* Optimized Windowed List Container */}
          <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-bold">
                No participants match "{participantSearch}"
              </div>
            ) : (
              filteredPlayers.slice(0, 300).map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="font-extrabold text-xs text-slate-200">
                      {p.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleKickPlayer(p.id)}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50 text-[11px] font-bold flex items-center gap-1 transition-all"
                  >
                    <UserX className="w-3.5 h-3.5" /> Kick
                  </button>
                </div>
              ))
            )}
            {filteredPlayers.length > 300 && (
              <div className="text-center py-2 text-slate-500 text-[11px] font-bold">
                Showing top 300 results of {filteredPlayers.length}. Refine
                search to find specific participants.
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            className="w-full mt-2"
            onClick={() => setShowParticipantsDrawer(false)}
          >
            Close Roster
          </Button>
        </div>
      </Modal>

      {/* 5. QR CODE MODAL FOR COMPACT MODES */}
      <Modal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        title="Scan QR Code to Join"
      >
        <div className="text-center space-y-4">
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            Instruct participants to enter PIN{" "}
            <strong className="text-indigo-300 font-mono">{pin}</strong> at{" "}
            <strong className="text-white">Cognition | GIM</strong>
          </p>

          <div className="inline-block p-3 rounded-2xl bg-white border border-slate-100 shadow-xl mt-2">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                typeof window !== "undefined"
                  ? `${window.location.protocol}//${window.location.host}/?pin=${pin}`
                  : `https://cognition.up.railway.app/?pin=${pin}`,
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
