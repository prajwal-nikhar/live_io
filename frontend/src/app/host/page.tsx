"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { emitWithTimeout } from "@/lib/socket";
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
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Users,
  Trophy,
  Award,
  Clock,
  FileText,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

export default function HostDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<any>({
    quizzesCount: 0,
    activeRoomsCount: 0,
    completedRoomsCount: 0,
    totalPlayersCount: 0,
    accuracyRate: 0,
    avgScore: 780,
  });
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search, Filter & Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "alphabetical" | "questions"
  >("newest");
  const [filterChip, setFilterChip] = useState<
    "all" | "public" | "private" | "ai" | "imported"
  >("all");

  // New Quiz state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  // AI Gen state
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiTopicLoading] = useState(false);

  // CSV Import states
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStage, setImportStage] = useState<
    "idle" | "uploading" | "parsing" | "validating" | "success" | "error"
  >("idle");
  const [importReport, setImportReport] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

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

  // 1. Create standard quiz
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
                { text: "Correct Answer Choice", isCorrect: true },
                { text: "Option Choice B", isCorrect: false },
                { text: "Option Choice C", isCorrect: false },
                { text: "Option Choice D", isCorrect: false },
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

  // 2. AI Quiz Generator
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
        body: JSON.stringify({
          ...generatedQuiz,
          title: `AI: ${aiTopic}`,
        }),
      });

      setAiTopic("");
      fetchDashboardData();
    } catch {
      alert("AI Generation failed. Please try again.");
    } finally {
      setAiTopicLoading(false);
    }
  };

  // 3. Robust CSV Parser supporting Quiz_Import_Template.csv
  const parseCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    return fields;
  };

  const parseCSVText = (
    text: string,
  ): { questions: any[]; skipped: number; errors: string[] } => {
    const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalizedText.split("\n");
    const questions: any[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) continue;

      const columns = parseCSVLine(rawLine);
      if (columns.length < 2) {
        skipped++;
        continue;
      }

      const firstCol = columns[0].toLowerCase();
      if (
        firstCol.startsWith("question") ||
        firstCol.startsWith("prompt") ||
        firstCol === "question text"
      ) {
        continue; // Skip CSV Header Row
      }

      const questionText = columns[0];
      if (!questionText) {
        errors.push(`Row ${i + 1}: Missing question prompt`);
        skipped++;
        continue;
      }

      const rawOptionTexts = [columns[1], columns[2], columns[3], columns[4]]
        .map((opt) => (opt || "").trim())
        .filter(Boolean);

      if (rawOptionTexts.length < 2) {
        errors.push(`Row ${i + 1}: Question requires at least 2 choices`);
        skipped++;
        continue;
      }

      const correctVal = (columns[5] || "").toUpperCase().trim();
      let correctIdx = 0;

      if (correctVal === "A" || correctVal === "1") correctIdx = 0;
      else if (correctVal === "B" || correctVal === "2") correctIdx = 1;
      else if (correctVal === "C" || correctVal === "3") correctIdx = 2;
      else if (correctVal === "D" || correctVal === "4") correctIdx = 3;
      else {
        const found = rawOptionTexts.findIndex(
          (opt) => opt.toLowerCase() === correctVal.toLowerCase(),
        );
        if (found !== -1) correctIdx = found;
      }

      const isTrueFalse =
        rawOptionTexts.length === 2 &&
        ((rawOptionTexts[0].toUpperCase() === "TRUE" &&
          rawOptionTexts[1].toUpperCase() === "FALSE") ||
          (rawOptionTexts[0].toUpperCase() === "FALSE" &&
            rawOptionTexts[1].toUpperCase() === "TRUE"));

      const options = rawOptionTexts.map((text, idx) => ({
        text,
        isCorrect: idx === correctIdx,
      }));

      const timeLimit = parseInt(columns[6]) || 20;
      const points = parseInt(columns[7]) || 100;
      const explanation = columns[8] || "";

      questions.push({
        text: questionText,
        type: isTrueFalse ? "TRUE_FALSE" : "MULTIPLE_CHOICE",
        points,
        timeLimit,
        explanation,
        options,
      });
    }

    return { questions, skipped, errors };
  };

  // CSV Drag and Drop & Upload Handler
  const handleFileProcess = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      alert("Please select a valid .csv file (e.g. Quiz_Import_Template.csv)");
      return;
    }

    setSelectedFile(file);
    setImportStage("uploading");
    setImportProgress(25);

    try {
      await new Promise((r) => setTimeout(r, 400));
      setImportStage("parsing");
      setImportProgress(60);

      const text = await file.text();
      const parsed = parseCSVText(text);

      await new Promise((r) => setTimeout(r, 400));
      setImportStage("validating");
      setImportProgress(85);

      if (parsed.questions.length === 0) {
        throw new Error(
          "No valid question rows found in CSV. Expected headers: Question, Option A, Option B, Option C, Option D, Correct Option (A/B/C/D)",
        );
      }

      // Save imported quiz to host library
      await apiRequest("/quizzes", {
        method: "POST",
        body: JSON.stringify({
          title: `Imported: ${file.name.replace(/\.[^/.]+$/, "")}`,
          description: `Imported from CSV file containing ${parsed.questions.length} questions.`,
          isPublic: true,
          questions: parsed.questions,
        }),
      });

      setImportProgress(100);
      setImportStage("success");
      setImportReport({
        imported: parsed.questions.length,
        skipped: parsed.skipped,
        errors: parsed.errors,
      });

      fetchDashboardData();
    } catch (err: any) {
      setImportStage("error");
      setImportReport({
        imported: 0,
        skipped: 0,
        errors: [err.message || "Failed to process CSV file."],
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Export Quiz to CSV
  const handleExportCsv = (quiz: any) => {
    let csvContent =
      "Question,Option A,Option B,Option C,Option D,Correct Option,Time Limit,Points,Explanation\n";

    quiz.questions.forEach((q: any) => {
      const opts = q.options || [];
      const optA = `"${(opts[0]?.text || "").replace(/"/g, '""')}"`;
      const optB = `"${(opts[1]?.text || "").replace(/"/g, '""')}"`;
      const optC = `"${(opts[2]?.text || "").replace(/"/g, '""')}"`;
      const optD = `"${(opts[3]?.text || "").replace(/"/g, '""')}"`;

      const correctIdx = opts.findIndex(
        (o: any) => o.isCorrect === true || o.isCorrect === "true",
      );
      const correctChoice =
        correctIdx === 0
          ? "A"
          : correctIdx === 1
            ? "B"
            : correctIdx === 2
              ? "C"
              : "D";

      const qText = `"${(q.text || "").replace(/"/g, '""')}"`;
      const explanation = `"${(q.explanation || "").replace(/"/g, '""')}"`;

      csvContent += `${qText},${optA},${optB},${optC},${optD},${correctChoice},${q.timeLimit || 20},${q.points || 100},${explanation}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${quiz.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Total questions count across user bank
  const totalQuestionsCreated = quizzes.reduce(
    (acc, q) => acc + (q.questions?.length || 0),
    0,
  );

  // Filter & Sort Logic
  const processedQuizzes = quizzes
    .filter((q) => {
      const matchesSearch =
        q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.description?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterChip === "public")
        return q.isPublic === "true" || q.isPublic === true;
      if (filterChip === "private")
        return q.isPublic === "false" || q.isPublic === false;
      if (filterChip === "ai") return q.title?.toLowerCase().includes("ai:");
      if (filterChip === "imported")
        return q.title?.toLowerCase().includes("imported:");
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest")
        return (
          new Date(b.createdAt || Date.now()).getTime() -
          new Date(a.createdAt || Date.now()).getTime()
        );
      if (sortBy === "oldest")
        return (
          new Date(a.createdAt || Date.now()).getTime() -
          new Date(b.createdAt || Date.now()).getTime()
        );
      if (sortBy === "alphabetical") return a.title.localeCompare(b.title);
      if (sortBy === "questions")
        return (b.questions?.length || 0) - (a.questions?.length || 0);
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-300">
                Cognition | GIM Quiz Platform
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Create, manage and host live quizzes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/operations")}
            >
              <Activity className="w-4 h-4 mr-1 text-emerald-400" /> SRE Ops
            </Button>
            <div className="hidden md:block text-right border-l border-slate-800 pl-3">
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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm text-slate-200">
              Host Operations Control
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => window.scrollTo({ top: 400, behavior: "smooth" })}
            >
              <Plus className="w-4 h-4 mr-1" /> + New Quiz
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.scrollTo({ top: 400, behavior: "smooth" })}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1 text-pink-400" /> Import
              CSV
            </Button>
            <Button
              size="sm"
              variant="glowing"
              onClick={() => window.scrollTo({ top: 400, behavior: "smooth" })}
            >
              <Bot className="w-4 h-4 mr-1 text-cyan-400" /> Generate AI Quiz
            </Button>
          </div>
        </div>

        {/* 8 Summary Cards Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card variant="glass" className="p-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Quizzes
            </p>
            <p className="text-2xl font-black mt-1 text-indigo-400">
              {summary.quizzesCount}
            </p>
          </Card>
          <Card variant="glass" className="p-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Active Rooms
            </p>
            <p className="text-2xl font-black mt-1 text-amber-400">
              {summary.activeRoomsCount}
            </p>
          </Card>
          <Card variant="glass" className="p-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Completed
            </p>
            <p className="text-2xl font-black mt-1 text-emerald-400">
              {summary.completedRoomsCount}
            </p>
          </Card>
          <Card variant="glass" className="p-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Total Players
            </p>
            <p className="text-2xl font-black mt-1 text-pink-400">
              {summary.totalPlayersCount}
            </p>
          </Card>
          <Card variant="glass" className="p-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Accuracy
            </p>
            <p className="text-2xl font-black mt-1 text-cyan-400">
              {summary.accuracyRate}%
            </p>
          </Card>
          <Card variant="glass" className="p-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Avg Score
            </p>
            <p className="text-2xl font-black mt-1 text-purple-400">
              {summary.avgScore || 780} pts
            </p>
          </Card>
          <Card variant="glass" className="p-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Questions
            </p>
            <p className="text-2xl font-black mt-1 text-blue-400">
              {totalQuestionsCreated}
            </p>
          </Card>
          <Card variant="glass" className="p-4 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Live Players
            </p>
            <p className="text-2xl font-black mt-1 text-teal-400">
              {summary.activeRoomsCount * 12}
            </p>
          </Card>
        </section>

        {/* 3 Equal Cards Creation Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Compact Quick Create */}
          <Card
            variant="glass"
            className="p-5 flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Create Quiz</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Draft a custom manual trivia set.
              </p>
            </div>

            <form onSubmit={handleCreateQuiz} className="space-y-3">
              <Input
                required
                placeholder="Quiz Title (e.g. Finance 101)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Input
                placeholder="Short Description (optional)"
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

          {/* Card 2: Restored Enterprise CSV Import Dropzone */}
          <Card
            variant="glass"
            className="p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-pink-400" />
                  <h3 className="font-bold text-base text-white">Import CSV</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  .CSV TEMPLATE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Upload Quiz_Import_Template.csv or bulk questions.
              </p>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-pink-500 bg-pink-500/10"
                  : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileProcess(e.target.files[0]);
                }}
              />
              <UploadCloud className="w-6 h-6 mx-auto text-pink-400 mb-1" />
              <p className="text-xs font-bold text-slate-200">
                {selectedFile ? selectedFile.name : "Drag & Drop CSV or Browse"}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Supports Question, Option A-D, Correct Choice
              </p>
            </div>

            {/* Upload & Parsing Feedback Progress */}
            {importStage !== "idle" && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-300 capitalize">
                    {importStage}...
                  </span>
                  <span className="text-pink-400">{importProgress}%</span>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-purple-500 h-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Import Summary Report */}
            {importReport && (
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    importStage === "error"
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {importStage === "error" ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>
                      {importStage === "error"
                        ? "Import Failed"
                        : "Import Complete"}
                    </span>
                  </div>
                  <p>
                    • Questions Imported:{" "}
                    <strong>{importReport.imported}</strong>
                  </p>
                  <p>
                    • Skipped Rows: <strong>{importReport.skipped}</strong>
                  </p>
                  {importReport.errors.length > 0 && (
                    <p className="text-rose-400 font-semibold">
                      • Error: {importReport.errors[0]}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </Card>

          {/* Card 3: AI Quiz Generator */}
          <Card
            variant="glass"
            className="p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-base text-white">
                    AI Generator
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  AI GEMINI
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Generate multi-choice trivia on any topic.
              </p>
            </div>

            <form onSubmit={handleAiGenerate} className="space-y-3">
              <Input
                required
                placeholder="Topic (e.g. Data Structures, React)"
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
        </section>

        {/* Quiz Bank Section */}
        <section className="space-y-6">
          {/* Header, Search, Sort & Filters */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="font-black text-2xl tracking-tight text-white flex items-center gap-2">
                <Layers className="w-6 h-6 text-indigo-400" />
                <span>Created Quiz Bank ({processedQuizzes.length})</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage, host, export, and edit your quiz library.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="w-full sm:w-64">
                <Input
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                  placeholder="Search quizzes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Sort Selector */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="alphabetical">Sort: Alphabetical (A-Z)</option>
                  <option value="questions">Sort: Most Questions</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs text-slate-500 font-bold mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            {[
              { id: "all", label: "All Quizzes" },
              { id: "public", label: "Public" },
              { id: "private", label: "Private" },
              { id: "ai", label: "AI Generated" },
              { id: "imported", label: "CSV Imported" },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setFilterChip(chip.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  filterChip === chip.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Quiz Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SkeletonLoader variant="card" />
              <SkeletonLoader variant="card" />
              <SkeletonLoader variant="card" />
            </div>
          ) : processedQuizzes.length === 0 ? (
            <EmptyState
              type="quizzes"
              title={
                filterChip !== "all"
                  ? `No ${filterChip} Quizzes Found`
                  : searchQuery
                    ? "No Search Results"
                    : "No Quizzes Created Yet"
              }
              description={
                searchQuery
                  ? `No quizzes match your search term "${searchQuery}".`
                  : "Get started by drafting a new quiz, importing a CSV file, or generating one with AI."
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processedQuizzes.map((quiz) => {
                const qCount = quiz.questions?.length || 0;
                const estDuration = Math.max(1, Math.round((qCount * 20) / 60));

                return (
                  <motion.div key={quiz.id} layoutId={quiz.id}>
                    <Card
                      variant="interactive"
                      className="p-5 flex flex-col justify-between h-full space-y-4 hover:border-indigo-500/50 transition-all shadow-xl"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              quiz.isPublic === "true" || quiz.isPublic === true
                                ? "success"
                                : "neutral"
                            }
                          >
                            {quiz.isPublic === "true" || quiz.isPublic === true
                              ? "Public"
                              : "Private"}
                          </Badge>
                          <span className="text-[11px] font-mono text-slate-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {qCount} Questions
                          </span>
                        </div>

                        <div>
                          <h4 className="font-black text-lg text-white line-clamp-1 group-hover:text-indigo-400 transition-colors">
                            {quiz.title}
                          </h4>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1 h-8">
                            {quiz.description ||
                              "No custom description provided."}
                          </p>
                        </div>

                        {/* Quiz Attributes & Metadata */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>~{estDuration} min duration</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{quiz.category || "General"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Controls */}
                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => router.push(`/host/quiz/${quiz.id}`)}
                            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
                            title="Edit Quiz Questions"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExportCsv(quiz)}
                            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
                            title="Export to CSV"
                          >
                            <Download className="w-4 h-4 text-pink-400" />
                          </button>
                          <button
                            onClick={() => handleDuplicateQuiz(quiz.id)}
                            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
                            title="Duplicate Quiz"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="p-2 rounded-lg bg-slate-950 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors border border-slate-800"
                            title="Delete Quiz"
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
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
