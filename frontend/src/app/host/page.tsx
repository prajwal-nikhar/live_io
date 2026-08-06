'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, getBackendUrl } from '@/lib/api';
import { getSocket, emitWithTimeout } from '@/lib/socket';
import { 
  Award, Sparkles, LogOut, PlusCircle, Play, Layers, 
  Trash2, Copy, FileSpreadsheet, Bot, UploadCloud, MonitorCheck,
  CheckCircle, Plus, Edit
} from 'lucide-react';
import { motion } from 'framer-motion';

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
  const [loading, setLoading] = useState(true);
  
  // AI Gen & Import states
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiTopicLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // New Quiz state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (!storedUser || !storedToken) {
      router.push('/auth');
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [sumData, quizData] = await Promise.all([
        apiRequest('/analytics/summary'),
        apiRequest('/quizzes/my-quizzes'),
      ]);
      setSummary(sumData);
      setQuizzes(quizData);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  // AI Generated quiz
  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;
    setAiTopicLoading(true);
    try {
      const generatedQuiz = await apiRequest('/quizzes/ai-generate', {
        method: 'POST',
        body: JSON.stringify({ topic: aiTopic, numQuestions: 5 }),
      });

      // Save generated quiz to host database
      await apiRequest('/quizzes', {
        method: 'POST',
        body: JSON.stringify(generatedQuiz),
      });

      setAiTopic('');
      fetchDashboardData();
    } catch (err) {
      alert('AI Generation error');
    } finally {
      setAiTopicLoading(false);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let currentField = '';
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
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    return fields;
  };

  const parseCSV = (text: string): any[] => {
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    if (lines.length === 0) return [];

    const questions: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) continue;

      const columns = parseCSVLine(rawLine);
      if (columns.length < 2) continue;

      // Skip header row if present
      const firstCol = columns[0].toLowerCase();
      if (
        firstCol.startsWith('question') ||
        firstCol.startsWith('prompt') ||
        firstCol === 'question text'
      ) {
        continue;
      }

      const questionText = columns[0];
      if (!questionText) continue;

      const rawOptionTexts = [columns[1], columns[2], columns[3], columns[4]]
        .map(opt => (opt || '').trim())
        .filter(Boolean);

      if (rawOptionTexts.length < 2) continue;

      const correctVal = (columns[5] || '').toUpperCase().trim();
      let correctIdx = 0;

      if (correctVal === 'A' || correctVal === '1') correctIdx = 0;
      else if (correctVal === 'B' || correctVal === '2') correctIdx = 1;
      else if (correctVal === 'C' || correctVal === '3') correctIdx = 2;
      else if (correctVal === 'D' || correctVal === '4') correctIdx = 3;
      else {
        const found = rawOptionTexts.findIndex(opt => opt.toLowerCase() === correctVal.toLowerCase());
        if (found !== -1) correctIdx = found;
      }

      const isTrueFalse =
        rawOptionTexts.length === 2 &&
        ((rawOptionTexts[0].toUpperCase() === 'TRUE' && rawOptionTexts[1].toUpperCase() === 'FALSE') ||
         (rawOptionTexts[0].toUpperCase() === 'FALSE' && rawOptionTexts[1].toUpperCase() === 'TRUE'));

      const options = rawOptionTexts.map((text, idx) => ({
        text,
        isCorrect: idx === correctIdx,
      }));

      const timeLimit = parseInt(columns[6]) || 20;
      const points = parseInt(columns[7]) || 100;
      const explanation = columns[8] || '';

      questions.push({
        text: questionText,
        type: isTrueFalse ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE',
        points,
        timeLimit,
        explanation,
        options,
      });
    }

    return questions;
  };

  // Import mock questions or parse CSV directly
  const handleMockImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to import first.');
      return;
    }
    setImportLoading(true);

    try {
      let questionsList: any[] = [];

      if (selectedFile.name.endsWith('.csv')) {
        const text = await selectedFile.text();
        questionsList = parseCSV(text);
        if (questionsList.length === 0) {
          throw new Error('No valid questions found in CSV file. Format: Question, Option A, Option B, Option C, Option D, Correct Option (A/B/C/D)');
        }
      } else {
        // Fallback to backend mock import for PDF/PPTX/etc
        const importedQuestions = await apiRequest('/quizzes/import', {
          method: 'POST',
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileType: selectedFile.name.endsWith('.pdf') ? 'PDF' : 'PPTX',
          }),
        });
        questionsList = importedQuestions;
      }

      // Create new imported Quiz with these questions
      await apiRequest('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: `Imported Quiz: ${selectedFile.name.split('.')[0]}`,
          description: `Questions parsed from ${selectedFile.name}.`,
          isPublic: true,
          questions: questionsList,
        }),
      });

      setSelectedFile(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'File Import error');
    } finally {
      setImportLoading(false);
    }
  };

  // Create standard manual quiz
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreateLoading(true);
    try {
      await apiRequest('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          isPublic,
          questions: [
            {
              text: 'Default Quiz Question 1: Customize Me!',
              type: 'MULTIPLE_CHOICE',
              points: 100,
              timeLimit: 20,
              options: [
                { text: 'Correct Answer Choice', isCorrect: true },
                { text: 'Incorrect Answer A', isCorrect: false },
                { text: 'Incorrect Answer B', isCorrect: false },
                { text: 'Incorrect Answer C', isCorrect: false },
              ],
            },
          ],
        }),
      });

      setNewTitle('');
      setNewDesc('');
      fetchDashboardData();
    } catch (err) {
      alert('Failed to create quiz');
    } finally {
      setCreateLoading(false);
    }
  };

  // Host/Launch live room PIN
  const handleHostLive = async (quizId: string) => {
    const res = await emitWithTimeout('host_create_room', { quizId, hostId: user.id }, 10000);
    if (res.success && res.data?.pin) {
      router.push(`/host/room/${res.data.pin}`);
    } else {
      alert(res.message || 'Failed to create live room');
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await apiRequest(`/quizzes/${id}`, { method: 'DELETE' });
      fetchDashboardData();
    } catch (e) {
      alert('Delete error');
    }
  };

  const handleDuplicateQuiz = async (id: string) => {
    try {
      await apiRequest(`/quizzes/${id}/duplicate`, { method: 'POST' });
      fetchDashboardData();
    } catch (e) {
      alert('Duplicate error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-dark flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-semibold text-lg">Fetching cloud-sync dashboard assets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      {/* Top Banner */}
      <header className="border-b border-slate-800/40 bg-slate-950/40 backdrop-blur-md sticky top-0 z-15">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2" onClick={() => router.push('/')}>
            <div className="p-2 gradient-brand rounded-xl shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">AuraQuiz Control</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-bold text-slate-200">{user?.name}</p>
              <p className="text-xs text-indigo-400 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-800"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        
        {/* Real-time summaries grid */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/30 shadow-premium">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Total Quizzes</p>
            <p className="text-3xl font-extrabold mt-1 text-indigo-400">{summary.quizzesCount}</p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/30 shadow-premium">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Live Active Rooms</p>
            <p className="text-3xl font-extrabold mt-1 text-amber-400">{summary.activeRoomsCount}</p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/30 shadow-premium">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Completed Sessions</p>
            <p className="text-3xl font-extrabold mt-1 text-emerald-400">{summary.completedRoomsCount}</p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/30 shadow-premium">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Total Participants</p>
            <p className="text-3xl font-extrabold mt-1 text-pink-400">{summary.totalPlayersCount}</p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/30 shadow-premium col-span-2 lg:col-span-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Correctness Rate</p>
            <p className="text-3xl font-extrabold mt-1 text-purple-400">{summary.accuracyRate}%</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create, AI Gen, and Import Column */}
          <div className="space-y-8 lg:col-span-1">
            
            {/* Quick Create Card */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/30 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg text-slate-200">Create New Quiz</h3>
              </div>
              <form onSubmit={handleCreateQuiz} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Quiz Title (e.g., Python Basics)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Short Description"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">Publicly visible</span>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-950"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold text-sm transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>{createLoading ? 'Creating...' : 'Draft Quiz'}</span>
                </button>
              </form>
            </div>

            {/* AI Generator Card */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/30 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-1 bg-indigo-500/20 rounded-bl-xl text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
                Powered by AI
              </div>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg text-slate-200">AI Quiz Generator</h3>
              </div>
              <p className="text-xs text-slate-400">
                Input any academic or professional topic and generate high-fidelity multi-choice trivia questions automatically.
              </p>
              <form onSubmit={handleAiGenerate} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Topic (e.g. Kubernetes, React 19)"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold text-sm transition-colors"
                >
                  <Bot className="w-4 h-4" />
                  <span>{aiLoading ? 'Generating AI Questions...' : 'Generate AI Quiz'}</span>
                </button>
              </form>
            </div>

            {/* Document Import Card */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/30 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-pink-400" />
                <h3 className="font-bold text-lg text-slate-200">Bulk Document Import</h3>
              </div>
              <p className="text-xs text-slate-400">
                Bulk upload questions from a Spreadsheet or PDF. We support CSV, PDF, and PPTX formats.
              </p>
              <form onSubmit={handleMockImport} className="space-y-3">
                <input
                  type="file"
                  accept=".csv,.pdf,.pptx,.docx"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                    }
                  }}
                  className="w-full text-xs text-slate-450 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-indigo-400 hover:file:bg-slate-700 bg-slate-950 p-2.5 rounded-xl border border-slate-800 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={importLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-pink-600 hover:bg-pink-500 rounded-xl text-white font-semibold text-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{importLoading ? 'Analyzing & Parsing...' : 'Import Quiz File'}</span>
                </button>
              </form>
            </div>

          </div>

          {/* Quizzes List Column */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-extrabold text-2xl tracking-tight text-slate-100 flex items-center gap-2">
              <Layers className="w-6 h-6 text-indigo-400" />
              <span>Created Quiz Bank</span>
            </h3>

            {quizzes.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900/20 border border-slate-800/30">
                <p className="text-slate-500 text-lg mb-2">No active quizzes found in database.</p>
                <p className="text-slate-600 text-sm">Create a quiz manually, generate with AI, or import one on the left to start!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((quiz) => (
                  <motion.div
                    key={quiz.id}
                    layoutId={quiz.id}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/30 flex flex-col justify-between space-y-4 hover:border-slate-700/60 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${quiz.isPublic === 'true' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                          {quiz.isPublic === 'true' ? 'Public' : 'Private'}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">{quiz.questions.length} questions</span>
                      </div>
                      <h4 className="font-extrabold text-lg text-slate-100 mt-2 line-clamp-1">{quiz.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 h-8">{quiz.description || 'No custom description provided.'}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => router.push(`/host/quiz/${quiz.id}`)}
                          className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="Edit Quiz Questions"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicateQuiz(quiz.id)}
                          className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="Duplicate Quiz"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuiz(quiz.id)}
                          className="p-2 rounded-lg bg-slate-950 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete Quiz"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleHostLive(quiz.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 text-white transition-all transform hover:scale-103 active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Host Live</span>
                      </button>
                    </div>
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
