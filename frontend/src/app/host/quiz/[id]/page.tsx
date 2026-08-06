'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, Plus, Trash2, Save, Sparkles, Clock, 
  Award, CheckCircle2, X, HelpCircle, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
  id?: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  points: number;
  timeLimit: number;
  explanation?: string;
  options: Option[];
}

export default function QuizEditor() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active question editing ID (null if not editing or adding)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Question Form State
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<'MULTIPLE_CHOICE' | 'TRUE_FALSE'>('MULTIPLE_CHOICE');
  const [qPoints, setQPoints] = useState(100);
  const [qTimeLimit, setQTimeLimit] = useState(20);
  const [qExplanation, setQExplanation] = useState('');
  const [qOptions, setQOptions] = useState<Option[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false }
  ]);

  useEffect(() => {
    fetchQuizDetails();
  }, [id]);

  const fetchQuizDetails = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/quizzes/${id}`);
      setQuiz(data);
      // Ensure options have boolean values
      const parsedQuestions = data.questions.map((q: any) => ({
        ...q,
        options: q.options.map((o: any) => ({
          ...o,
          isCorrect: o.isCorrect === true || o.isCorrect === 'true'
        }))
      }));
      setQuestions(parsedQuestions);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quiz details.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingQuestionId(null);
    setQText('');
    setQType('MULTIPLE_CHOICE');
    setQPoints(100);
    setQTimeLimit(20);
    setQExplanation('');
    setQOptions([
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ]);
  };

  const handleStartEdit = (q: Question) => {
    setEditingQuestionId(q.id);
    setIsAdding(false);
    setQText(q.text);
    setQType(q.type);
    setQPoints(q.points);
    setQTimeLimit(q.timeLimit);
    setQExplanation(q.explanation || '');
    setQOptions(q.options.map(o => ({ ...o })));
  };

  const handleTypeChange = (type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE') => {
    setQType(type);
    if (type === 'TRUE_FALSE') {
      setQOptions([
        { text: 'True', isCorrect: false },
        { text: 'False', isCorrect: false }
      ]);
    } else {
      setQOptions([
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ]);
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...qOptions];
    updated[idx].text = val;
    setQOptions(updated);
  };

  const handleCorrectOptionSelect = (idx: number) => {
    const updated = qOptions.map((o, i) => ({
      ...o,
      isCorrect: i === idx
    }));
    setQOptions(updated);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!qText.trim()) {
      setError('Question text is required');
      return;
    }

    const hasCorrect = qOptions.some(o => o.isCorrect);
    if (!hasCorrect) {
      setError('Please select at least one correct option.');
      return;
    }

    const hasEmptyOption = qOptions.some(o => !o.text.trim());
    if (hasEmptyOption) {
      setError('Please fill in all options.');
      return;
    }

    try {
      const body = {
        text: qText,
        type: qType,
        points: Number(qPoints),
        timeLimit: Number(qTimeLimit),
        explanation: qExplanation,
        options: qOptions
      };

      if (isAdding) {
        await apiRequest(`/quizzes/${id}/questions`, {
          method: 'POST',
          body: JSON.stringify(body)
        });
        setSuccessMsg('Question added successfully!');
      } else if (editingQuestionId) {
        await apiRequest(`/quizzes/questions/${editingQuestionId}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
        setSuccessMsg('Question updated successfully!');
      }

      setIsAdding(false);
      setEditingQuestionId(null);
      fetchQuizDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to save question.');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    setError('');
    setSuccessMsg('');

    try {
      await apiRequest(`/quizzes/questions/${qId}`, {
        method: 'DELETE'
      });
      setSuccessMsg('Question deleted successfully!');
      fetchQuizDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to delete question.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-dark flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-semibold text-lg">Loading quiz details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-indigo-950/20 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-950/20 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Banner */}
      <header className="border-b border-slate-800/40 bg-slate-950/40 backdrop-blur-md sticky top-0 z-15">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <button 
            onClick={() => router.push('/host')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-350 hover:text-white border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="text-right">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Quiz Editor</span>
            <h1 className="text-lg font-extrabold text-slate-150 line-clamp-1">{quiz?.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Left Side: Question List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Quiz Questions</h2>
              <p className="text-xs text-slate-400 mt-1">{questions.length} questions in bank</p>
            </div>
            {!isAdding && !editingQuestionId && (
              <button
                onClick={handleStartAdd}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 text-white transition-all transform hover:scale-103 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </button>
            )}
          </div>

          {/* Feedback messages */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 text-rose-400 text-xs font-semibold bg-rose-500/10 p-4 rounded-xl border border-rose-500/20"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 text-emerald-400 text-xs font-semibold bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20"
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question List */}
          <div className="space-y-4">
            {questions.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900/20 border border-slate-800/30">
                <HelpCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-base mb-1">No questions added yet.</p>
                <p className="text-slate-650 text-xs">Click "Add Question" to start populating this quiz.</p>
              </div>
            ) : (
              questions.map((q, idx) => (
                <div 
                  key={q.id}
                  className={`p-6 rounded-2xl bg-slate-900/60 border smooth-transition ${editingQuestionId === q.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/5' : 'border-slate-800/30 hover:border-slate-700/40'}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-indigo-400 font-bold uppercase tracking-wider">Q{idx + 1}</span>
                        <span className="text-xs text-slate-500 font-semibold">{q.type === 'MULTIPLE_CHOICE' ? 'Multiple Choice' : 'True / False'}</span>
                      </div>
                      <h4 className="font-extrabold text-base text-slate-200 mt-1">{q.text}</h4>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {q.timeLimit}s
                      </span>
                      <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-slate-500" />
                        {q.points} pts
                      </span>
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                    {q.options.map((option, oIdx) => (
                      <div 
                        key={option.id || oIdx}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold ${option.isCorrect ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-350' : 'bg-slate-950/30 border-slate-900 text-slate-450'}`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${option.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="line-clamp-1">{option.text}</span>
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <div className="mt-4 p-3 bg-slate-950/40 rounded-xl text-xs text-slate-450 border border-slate-900/60">
                      <span className="font-bold text-slate-350">Explanation:</span> {q.explanation}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 border-t border-slate-800/40 mt-5 pt-4">
                    <button
                      onClick={() => handleStartEdit(q)}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-indigo-400 font-semibold text-xs border border-slate-900 hover:border-slate-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/20 text-rose-450 font-semibold text-xs border border-slate-900 hover:border-rose-900/40 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {(isAdding || editingQuestionId) ? (
              <motion.div
                key="editor-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/30 space-y-5 shadow-xl sticky top-24"
              >
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>{isAdding ? 'Add Question' : 'Edit Question'}</span>
                  </h3>
                  <button 
                    onClick={() => { setIsAdding(false); setEditingQuestionId(null); }}
                    className="p-1 rounded bg-slate-950 hover:bg-slate-850 text-slate-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveQuestion} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Question Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleTypeChange('MULTIPLE_CHOICE')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${qType === 'MULTIPLE_CHOICE' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-950 border-slate-850 text-slate-400'}`}
                      >
                        Multiple Choice
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange('TRUE_FALSE')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${qType === 'TRUE_FALSE' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-950 border-slate-850 text-slate-400'}`}
                      >
                        True / False
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Question Text</label>
                    <textarea
                      required
                      rows={3}
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      placeholder="e.g. Which logic gate outputs true if both inputs are false?"
                      className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none text-slate-200"
                    />
                  </div>

                  {/* Options Settings */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Answer Options (Check the correct one)
                    </label>
                    {qOptions.map((o, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={o.isCorrect}
                          onChange={() => handleCorrectOptionSelect(idx)}
                          className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          required
                          disabled={qType === 'TRUE_FALSE'}
                          value={o.text}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none text-slate-200 disabled:opacity-75 disabled:text-slate-400"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Time Limit (secs)</label>
                      <input
                        type="number"
                        min={5}
                        max={300}
                        required
                        value={qTimeLimit}
                        onChange={(e) => setQTimeLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Points</label>
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        required
                        value={qPoints}
                        onChange={(e) => setQPoints(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Explanation (Optional)</label>
                    <textarea
                      rows={2}
                      value={qExplanation}
                      onChange={(e) => setQExplanation(e.target.value)}
                      placeholder="Explain the correct answer choice details..."
                      className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none text-slate-250"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs transition-colors mt-4 shadow-lg shadow-indigo-600/20"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Question</span>
                  </button>
                </form>
              </motion.div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800/20 text-center text-slate-550 py-12 sticky top-24">
                <HelpCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">No Active Question Selected</p>
                <p className="text-[10px] text-slate-600 mt-1">Select "Edit" on any question list entry, or click "Add Question" to configure details.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </main>
    </div>
  );
}
