"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { getSocket, emitWithTimeout } from "@/lib/socket";
import {
  Sparkles,
  LogOut,
  PlusCircle,
  Play,
  Layers,
  Trash2,
  Copy,
  FileSpreadsheet,
  Bot,
  UploadCloud,
  Plus,
  Edit,
  Search,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

export default function HostDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<any>({
    quizzesCount: 0,
    activeRoomsCount: 0,
    completedRoomsCount: 0,
    totalPlayersCount: 0,
    accuracyRate: 0,
  });
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // AI Gen & Import states
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiTopicLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // New Quiz state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    if (!storedUser || !storedToken) {
      router.push("/auth");
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [sumData, quizData] = await Promise.all([
        apiRequest("/analytics/summary"),
        apiRequest("/quizzes/my-quizzes"),
      ]);
      setSummary(sumData);
      setQuizzes(quizData);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;
    setAiTopicLoading(true);
    try {
      const generatedQuiz = await apiRequest("/quizzes/ai-generate", {
        method: "POST",
        body: JSON.stringify({ topic: aiTopic, numQuestions: 5 }),
      });

      await apiRequest("/quizzes", {
        method: "POST",
        body: JSON.stringify(generatedQuiz),
      });

      setAiTopic("");
      fetchDashboardData();
    } catch {
      alert("AI Generation error");
    } finally {
      setAiTopicLoading(false);
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreateLoading(true);
    try {
      await apiRequest("/quizzes", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          isPublic,
          questions: [
            {
              text: "Default Question 1: Customize Me!",
              type: "MULTIPLE_CHOICE",
              points: 100,
              timeLimit: 20,
              options: [
                { text: "Correct Answer", isCorrect: true },
                { text: "Option B", isCorrect: false },
                { text: "Option C", isCorrect: false },
                { text: "Option D", isCorrect: false },
              ],
            },
          ],
        }),
      });

      setNewTitle("");
      setNewDesc("");
      fetchDashboardData();
    } catch {
      alert("Failed to create quiz");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleHostLive = async (quizId: string) => {
    const res = await emitWithTimeout(
      "host_create_room",
      { quizId, hostId: user.id },
      10000,
    );
    if (res.success && res.data?.pin) {
      router.push(`/host/room/${res.data.pin}`);
    } else {
      alert(res.message || "Failed to create live room");
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await apiRequest(`/quizzes/${id}`, { method: "DELETE" });
      fetchDashboardData();
    } catch {
      alert("Delete error");
    }
  };

  const handleDuplicateQuiz = async (id: string) => {
    try {
      await apiRequest(`/quizzes/${id}/duplicate`, { method: "POST" });
      fetchDashboardData();
    } catch {
      alert("Duplicate error");
    }
  };

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              AuraQuiz Control
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/operations")}
            >
              <Activity className="w-4 h-4 mr-1 text-emerald-400" /> SRE Ops
            </Button>
            <div className="hidden md:block text-right">
              <p className="text-sm font-extrabold text-slate-100">
                {user?.name}
              </p>
              <p className="text-xs text-indigo-400 capitalize">
                {user?.role || "Host"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Real-Time Platform Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card variant="glass" className="p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              Total Quizzes
            </p>
            <p className="text-3xl font-black mt-1 text-indigo-400">
              {summary.quizzesCount}
            </p>
          </Card>
          <Card variant="glass" className="p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              Active Rooms
            </p>
            <p className="text-3xl font-black mt-1 text-amber-400">
              {summary.activeRoomsCount}
            </p>
          </Card>
          <Card variant="glass" className="p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              Completed
            </p>
            <p className="text-3xl font-black mt-1 text-emerald-400">
              {summary.completedRoomsCount}
            </p>
          </Card>
          <Card variant="glass" className="p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              Total Players
            </p>
            <p className="text-3xl font-black mt-1 text-pink-400">
              {summary.totalPlayersCount}
            </p>
          </Card>
          <Card variant="glass" className="p-5 col-span-2 lg:col-span-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              Accuracy
            </p>
            <p className="text-3xl font-black mt-1 text-cyan-400">
              {summary.accuracyRate}%
            </p>
          </Card>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Creation Side Controls */}
          <div className="space-y-6 lg:col-span-1">
            {/* Quick Create Card */}
            <Card variant="glass" className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg text-white">
                  Create New Quiz
                </h3>
              </div>
              <form onSubmit={handleCreateQuiz} className="space-y-3">
                <Input
                  required
                  placeholder="Quiz Title (e.g., Python Basics)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <Input
                  placeholder="Short Description"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <Button
                  variant="primary"
                  className="w-full"
                  isLoading={createLoading}
                  type="submit"
                >
                  <Plus className="w-4 h-4 mr-1" /> Draft Quiz
                </Button>
              </form>
            </Card>

            {/* AI Generator Card */}
            <Card
              variant="glass"
              className="p-6 space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-lg text-white">
                  AI Quiz Generator
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Input any academic topic to generate multi-choice questions
                automatically.
              </p>
              <form onSubmit={handleAiGenerate} className="space-y-3">
                <Input
                  required
                  placeholder="Topic (e.g. Kubernetes, React 19)"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                />
                <Button
                  variant="glowing"
                  className="w-full"
                  isLoading={aiLoading}
                  type="submit"
                >
                  <Bot className="w-4 h-4 mr-1" /> Generate AI Quiz
                </Button>
              </form>
            </Card>
          </div>

          {/* Quiz Bank List Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-black text-2xl tracking-tight text-white flex items-center gap-2">
                <Layers className="w-6 h-6 text-indigo-400" />
                <span>Created Quiz Bank</span>
              </h3>

              <div className="w-full sm:w-64">
                <Input
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                  placeholder="Search quizzes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonLoader variant="card" />
                <SkeletonLoader variant="card" />
              </div>
            ) : filteredQuizzes.length === 0 ? (
              <EmptyState
                type="quizzes"
                title="No Quizzes Found"
                description={
                  searchQuery
                    ? `No quizzes match your query "${searchQuery}".`
                    : "Create your first quiz using the panel on the left!"
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredQuizzes.map((quiz) => (
                  <motion.div key={quiz.id} layoutId={quiz.id}>
                    <Card
                      variant="interactive"
                      className="p-5 flex flex-col justify-between h-full space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              quiz.isPublic === "true" ? "success" : "neutral"
                            }
                          >
                            {quiz.isPublic === "true" ? "Public" : "Private"}
                          </Badge>
                          <span className="text-xs text-slate-400 font-bold">
                            {quiz.questions?.length || 0} Qs
                          </span>
                        </div>
                        <h4 className="font-black text-lg text-white mt-2 line-clamp-1">
                          {quiz.title}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1 h-8">
                          {quiz.description || "No description provided."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => router.push(`/host/quiz/${quiz.id}`)}
                            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
                            title="Edit Quiz"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateQuiz(quiz.id)}
                            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="p-2 rounded-lg bg-slate-950 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors border border-slate-800"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <Button
                          variant="glowing"
                          size="sm"
                          onClick={() => handleHostLive(quiz.id)}
                        >
                          <Play className="w-3.5 h-3.5 mr-1 fill-white" /> Host
                          Live
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
