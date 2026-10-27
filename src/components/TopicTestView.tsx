import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Timer, 
  Flag, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Award, 
  RotateCcw, 
  Sparkles, 
  AlertCircle, 
  PlusCircle, 
  ArrowLeft, 
  Check, 
  HelpCircle,
  Clock,
  Layers,
  BarChart3,
  BookOpen,
  Sliders,
  EyeOff,
  Flame
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User } from 'firebase/auth';
import { Deck, TopicTest, TopicTestQuestion, TopicTestResult, Flashcard } from '../types';
import { saveTestResult } from '../utils/storage';
import { saveAccountTestResult } from '../utils/accountSync';

interface TopicTestViewProps {
  decks: Deck[];
  selectedDeck?: Deck | null;
  onBackToDashboard: () => void;
  onAddCardsToDeck: (deckId: string, newCards: Flashcard[]) => void;
  currentUser?: User | null;
  onTestCompleted?: (result: TopicTestResult) => void;
}

export const TopicTestView: React.FC<TopicTestViewProps> = ({
  decks,
  selectedDeck: initialDeck,
  onBackToDashboard,
  onAddCardsToDeck,
  currentUser,
  onTestCompleted,
}) => {
  // Test Setup States
  const [activeDeck, setActiveDeck] = useState<Deck | null>(initialDeck || (decks.length > 0 ? decks[0] : null));
  const [customTopic, setCustomTopic] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<'standard' | 'challenging' | 'comprehensive'>('standard');
  const [testMode, setTestMode] = useState<'timed' | 'practice'>('timed');

  // Loading state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active Test States
  const [activeTest, setActiveTest] = useState<TopicTest | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [qId: string]: number }>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [eliminatedOptions, setEliminatedOptions] = useState<{ [qId: string]: Set<number> }>({});
  
  // Timer states (in seconds)
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [totalTimeSpent, setTotalTimeSpent] = useState<number>(0);

  // Results State
  const [testResult, setTestResult] = useState<TopicTestResult | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'missed' | 'flagged'>('all');

  // Corrective flashcards generator state
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [generatedFlashcardsSuccess, setGeneratedFlashcardsSuccess] = useState(false);

  // Confirm submit dialog
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    let interval: any;
    if (activeTest && testMode === 'timed' && !testResult && !isTimerPaused) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
        setTotalTimeSpent((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTest, testMode, testResult, isTimerPaused]);

  // Generate Topic Test
  const handleStartTest = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    const topicTitle = activeDeck ? activeDeck.title : customTopic.trim();
    if (!topicTitle) {
      setGenerationError('Please select a deck or enter a topic.');
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch('/api/tests/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicTitle,
          count: questionCount,
          difficulty,
          cardsContext: activeDeck ? activeDeck.cards : [],
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.test) {
        throw new Error(data.error || 'Failed to generate topic test.');
      }

      const test: TopicTest = {
        ...data.test,
        deckId: activeDeck?.id,
        deckTitle: activeDeck?.title,
      };

      setActiveTest(test);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setFlaggedQuestions(new Set());
      setEliminatedOptions({});
      setTimeRemaining(test.timeLimitMinutes * 60);
      setTotalTimeSpent(0);
      setTestResult(null);
      setGeneratedFlashcardsSuccess(false);
    } catch (err: any) {
      console.error(err);
      setGenerationError(err?.message || 'Error creating test. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Select answer option
  const handleSelectAnswer = (optionIdx: number) => {
    if (!activeTest) return;
    const currentQ = activeTest.questions[currentQuestionIndex];
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionIdx,
    }));
  };

  // Toggle strikethrough / eliminate option
  const handleToggleEliminate = (e: React.MouseEvent, optionIdx: number) => {
    e.stopPropagation();
    if (!activeTest) return;
    const currentQ = activeTest.questions[currentQuestionIndex];
    setEliminatedOptions((prev) => {
      const currentSet = new Set(prev[currentQ.id] || []);
      if (currentSet.has(optionIdx)) {
        currentSet.delete(optionIdx);
      } else {
        currentSet.add(optionIdx);
      }
      return { ...prev, [currentQ.id]: currentSet };
    });
  };

  // Toggle Flag
  const handleToggleFlag = () => {
    if (!activeTest) return;
    const currentQ = activeTest.questions[currentQuestionIndex];
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(currentQ.id)) next.delete(currentQ.id);
      else next.add(currentQ.id);
      return next;
    });
  };

  // Calculate & Submit Test Results
  const handleSubmitTest = () => {
    if (!activeTest) return;

    let score = 0;
    const subtopicStats: { [subtopic: string]: { correct: number; total: number } } = {};
    const missedList: any[] = [];

    activeTest.questions.forEach((q) => {
      const userChoice = userAnswers[q.id];
      const isCorrect = userChoice === q.correctIndex;

      if (isCorrect) {
        score++;
      } else {
        missedList.push({
          questionId: q.id,
          question: q.question,
          userAnswer: typeof userChoice === 'number' ? q.options[userChoice] : 'Unanswered',
          correctAnswer: q.options[q.correctIndex],
          explanation: q.explanation,
          subtopic: q.subtopic,
        });
      }

      // Track subtopics
      const sub = q.subtopic || 'General';
      if (!subtopicStats[sub]) {
        subtopicStats[sub] = { correct: 0, total: 0 };
      }
      subtopicStats[sub].total++;
      if (isCorrect) subtopicStats[sub].correct++;
    });

    const totalQuestions = activeTest.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    const subtopicBreakdown = Object.entries(subtopicStats).map(([subtopic, stats]) => ({
      subtopic,
      correct: stats.correct,
      total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100),
    }));

    const result: TopicTestResult = {
      id: `result-${Date.now()}`,
      testId: activeTest.id,
      testTitle: activeTest.testTitle,
      topic: activeTest.topic,
      completedAt: new Date().toISOString(),
      timeSpentSeconds: totalTimeSpent,
      score,
      totalQuestions,
      percentage,
      userAnswers,
      flaggedQuestions: Array.from(flaggedQuestions),
      subtopicBreakdown,
      missedQuestions: missedList,
    };

    saveTestResult(result, currentUser?.uid);
    if (currentUser?.uid) {
      saveAccountTestResult(currentUser.uid, result);
    }
    onTestCompleted?.(result);
    setTestResult(result);
    setShowSubmitConfirm(false);

    // Confetti celebration if passed
    if (percentage >= 70) {
      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#3b82f6', '#f59e0b'],
      });
    }
  };

  const handleAutoSubmit = () => {
    handleSubmitTest();
  };

  // Generate Targeted Flashcards from Missed Questions
  const handleGenerateMissedFlashcards = async () => {
    if (!testResult || testResult.missedQuestions.length === 0 || !activeTest?.deckId) return;

    setIsGeneratingFlashcards(true);
    try {
      const res = await fetch('/api/tests/generate-missed-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missedQuestions: testResult.missedQuestions,
          topic: testResult.topic,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.flashcards) && data.flashcards.length > 0) {
        const newCards: Flashcard[] = data.flashcards.map((c: any, idx: number) => ({
          id: `card-missed-${Date.now()}-${idx}`,
          question: c.question,
          answer: c.answer,
          difficulty: c.difficulty || 'medium',
          explanation: c.explanation || '',
          tags: Array.isArray(c.tags) ? c.tags : ['Test Correction'],
          starred: true, // Starred so user sees it right away!
          repetitions: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
          reviewCount: 0,
        }));

        onAddCardsToDeck(activeTest.deckId, newCards);
        setGeneratedFlashcardsSuccess(true);
      }
    } catch (err) {
      console.error('Failed to generate corrective flashcards:', err);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  // Formatted Timer (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // VIEW 1: TEST REPORT / DIAGNOSTIC RESULTS
  // ==========================================
  if (testResult && activeTest) {
    const passed = testResult.percentage >= 70;
    const answeredCount = Object.keys(testResult.userAnswers).length;

    // Filter questions for review
    const filteredReviewQuestions = activeTest.questions.filter((q) => {
      const isCorrect = testResult.userAnswers[q.id] === q.correctIndex;
      const isFlagged = testResult.flaggedQuestions.includes(q.id);

      if (reviewFilter === 'missed') return !isCorrect;
      if (reviewFilter === 'flagged') return isFlagged;
      return true;
    });

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Top return */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              setActiveTest(null);
              setTestResult(null);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Test Center</span>
          </button>

          <span className="text-xs text-neutral-400">
            Completed on {new Date(testResult.completedAt).toLocaleDateString()}
          </span>
        </div>

        {/* Diagnostic Score Card Banner */}
        <div className="p-6 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 mb-2">
                <Award className="w-3 h-3" />
                <span>Diagnostic Assessment Report</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                {testResult.testTitle}
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Topic: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{testResult.topic}</span> • Duration: {formatTime(testResult.timeSpentSeconds)}
              </p>
            </div>

            {/* Score Ring / Pill */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div
                  className={`text-3xl font-extrabold font-mono tracking-tight ${
                    passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {testResult.percentage}%
                </div>
                <div className="text-xs font-semibold font-mono text-neutral-500 dark:text-neutral-400">
                  {testResult.score} / {testResult.totalQuestions} Correct
                </div>
              </div>

              <div
                className={`px-2.5 py-1 rounded-md font-mono font-bold text-[10px] uppercase tracking-wider ${
                  passed
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60'
                }`}
              >
                {passed ? 'Passed' : 'Needs Review'}
              </div>
            </div>
          </div>

          {/* Subtopic Mastery Breakdown Bars */}
          <div className="pt-6">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Subtopic Knowledge Diagnostic</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {testResult.subtopicBreakdown.map((sub, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-850 border border-neutral-100 dark:border-neutral-800"
                >
                  <div className="flex justify-between items-center text-xs font-medium mb-1.5">
                    <span className="text-neutral-800 dark:text-neutral-200 truncate pr-2">
                      {sub.subtopic}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        sub.percentage >= 70
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : sub.percentage >= 40
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {sub.correct}/{sub.total} ({sub.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        sub.percentage >= 70
                          ? 'bg-emerald-500'
                          : sub.percentage >= 40
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${sub.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Card: Generate Targeted Flashcards from Missed Questions */}
        {testResult.missedQuestions.length > 0 && activeTest.deckId && (
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 shadow-xs mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px] uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Reinforce Weak Areas</span>
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Turn your {testResult.missedQuestions.length} missed {testResult.missedQuestions.length === 1 ? 'question' : 'questions'} into active-recall flashcards
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Generate targeted correction flashcards to reinforce these exact concepts.
              </p>
            </div>

            {generatedFlashcardsSuccess ? (
              <span className="px-3.5 py-1.5 rounded-md bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 shadow-xs">
                <Check className="w-3.5 h-3.5" />
                <span>Cards Added to Deck</span>
              </span>
            ) : (
              <button
                onClick={handleGenerateMissedFlashcards}
                disabled={isGeneratingFlashcards}
                className="px-3.5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <PlusCircle className={`w-3.5 h-3.5 ${isGeneratingFlashcards ? 'animate-spin' : ''}`} />
                <span>{isGeneratingFlashcards ? 'Generating Cards...' : 'Create Corrective Cards'}</span>
              </button>
            )}
          </div>
        )}

        {/* Review Questions Filter */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-6">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
            Question-by-Question Review
          </h2>

          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-md">
            <button
              onClick={() => setReviewFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                reviewFilter === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              All ({activeTest.questions.length})
            </button>
            <button
              onClick={() => setReviewFilter('missed')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                reviewFilter === 'missed'
                  ? 'bg-white dark:bg-neutral-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Missed ({testResult.missedQuestions.length})
            </button>
            <button
              onClick={() => setReviewFilter('flagged')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                reviewFilter === 'flagged'
                  ? 'bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-2xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Flagged ({testResult.flaggedQuestions.length})
            </button>
          </div>
        </div>

        {/* Questions Detailed List */}
        <div className="space-y-3.5">
          {filteredReviewQuestions.map((q, idx) => {
            const userChoice = testResult.userAnswers[q.id];
            const isCorrect = userChoice === q.correctIndex;
            const originalIndex = activeTest.questions.findIndex((item) => item.id === q.id);

            return (
              <div
                key={q.id}
                className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-neutral-400">
                      Q{originalIndex + 1}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                      }`}
                    >
                      {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                    </span>

                    <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-md">
                      {q.subtopic}
                    </span>
                  </div>

                  {testResult.flaggedQuestions.includes(q.id) && (
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                      <Flag className="w-3 h-3 fill-amber-500" />
                      <span>Flagged</span>
                    </span>
                  )}
                </div>

                <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-snug mb-3.5">
                  {q.question}
                </h3>

                {/* Choices review */}
                <div className="space-y-2 mb-3.5">
                  {q.options.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isUserChoice = userChoice === optIdx;
                    const isRightAnswer = q.correctIndex === optIdx;

                    let rowStyle = 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300';
                    if (isRightAnswer) {
                      rowStyle = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500/20';
                    } else if (isUserChoice) {
                      rowStyle = 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 font-semibold ring-1 ring-rose-500/20';
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`p-3 rounded-lg border text-xs sm:text-sm flex items-center gap-3 ${rowStyle}`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md font-mono flex items-center justify-center font-bold text-xs shrink-0 ${
                            isRightAnswer
                              ? 'bg-emerald-600 text-white'
                              : isUserChoice
                              ? 'bg-rose-600 text-white'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 leading-snug">{opt}</span>
                        {isRightAnswer && (
                          <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            Correct Answer
                          </span>
                        )}
                        {isUserChoice && !isRightAnswer && (
                          <span className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                            Your Choice
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-850 border border-neutral-100 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">Rationale: </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-center gap-2.5 mt-8">
          <button
            onClick={() => {
              setActiveTest(null);
              setTestResult(null);
            }}
            className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Done Reviewing
          </button>
          <button
            onClick={handleStartTest}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake This Test</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ACTIVE TEST TAKING EXAM ROOM
  // ==========================================
  if (activeTest) {
    const currentQ = activeTest.questions[currentQuestionIndex];
    const totalQ = activeTest.questions.length;
    const answeredCount = Object.keys(userAnswers).length;
    const isCurrentFlagged = flaggedQuestions.has(currentQ.id);
    const selectedOption = userAnswers[currentQ.id];
    const eliminatedForCurrent = eliminatedOptions[currentQ.id] || new Set();

    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Top Exam Header with Timer & Nav */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center font-bold text-xs shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {activeTest.testTitle}
              </h2>
              <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                {answeredCount} / {totalQ} Answered • {flaggedQuestions.size} Flagged
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-2.5">
            {/* Countdown timer */}
            {testMode === 'timed' && (
              <div
                className={`px-2.5 py-1.5 rounded-md font-mono text-xs font-bold flex items-center gap-1.5 border ${
                  timeRemaining <= 120
                    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/80 dark:border-rose-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                <span>{formatTime(timeRemaining)}</span>
              </div>
            )}

            {/* Flag button */}
            <button
              onClick={handleToggleFlag}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                isCurrentFlagged
                  ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <Flag className={`w-3.5 h-3.5 ${isCurrentFlagged ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>{isCurrentFlagged ? 'Flagged' : 'Flag'}</span>
            </button>

            {/* Submit button */}
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-3.5 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-xs transition-colors"
            >
              Submit Exam
            </button>
          </div>
        </div>

        {/* Question Palette Strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-6 scrollbar-none">
          {activeTest.questions.map((q, idx) => {
            const isAnswered = typeof userAnswers[q.id] === 'number';
            const isFlagged = flaggedQuestions.has(q.id);
            const isCurrent = currentQuestionIndex === idx;

            return (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`relative w-7 h-7 rounded-md font-mono text-xs font-bold transition-all shrink-0 flex items-center justify-center ${
                  isCurrent
                    ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-neutral-950 font-black'
                    : ''
                } ${
                  isAnswered
                    ? 'bg-indigo-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {idx + 1}
                {isFlagged && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white dark:border-neutral-900" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Question Box */}
        <div className="p-6 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs mb-6">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Question {currentQuestionIndex + 1} of {totalQ}
            </span>
            <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded font-mono text-[10px] text-neutral-500">
              {currentQ.subtopic}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white leading-relaxed mb-6">
            {currentQ.question}
          </h2>

          {/* Options */}
          <div className="space-y-2.5">
            {currentQ.options.map((option, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const isSelected = selectedOption === optIdx;
              const isEliminated = eliminatedForCurrent.has(optIdx);

              return (
                <div
                  key={optIdx}
                  onClick={() => !isEliminated && handleSelectAnswer(optIdx)}
                  className={`group p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-500/20'
                      : isEliminated
                      ? 'opacity-40 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span
                      className={`w-6 h-6 rounded-md font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {letter}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-medium leading-snug ${
                        isEliminated ? 'line-through text-neutral-400' : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {option}
                    </span>
                  </div>

                  {/* Strikethrough / Eliminate tool button */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleEliminate(e, optIdx)}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title={isEliminated ? 'Un-strike option' : 'Strike out option'}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Navigation Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-3.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs font-mono text-neutral-400">
            {answeredCount} / {totalQ} Answered
          </span>

          {currentQuestionIndex + 1 < totalQ ? (
            <button
              onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
              className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-4 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold shadow-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              Finish & Review
            </button>
          )}
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">
                Submit Your Exam?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                You have answered <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{answeredCount} of {totalQ}</span> questions.
                {answeredCount < totalQ && (
                  <span className="block text-amber-600 dark:text-amber-400 font-medium mt-1">
                    Warning: {totalQ - answeredCount} questions are unanswered.
                  </span>
                )}
              </p>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
                >
                  Keep Working
                </button>
                <button
                  onClick={handleSubmitTest}
                  className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow-xs"
                >
                  Submit for Score
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 3: TOPIC TEST SETUP / SELECTION
  // ==========================================
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 mb-3">
          <Award className="w-3.5 h-3.5 text-indigo-500" />
          <span>Diagnostic Assessments</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          Standardized Topic Assessment
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-lg mx-auto">
          Test recall under simulated examination conditions. Review an in-depth subtopic diagnostic and convert missed questions into spaced flashcards.
        </p>
      </div>

      {/* Test Setup Form */}
      <div className="p-6 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-6">
        {/* Choose Deck / Topic */}
        <div>
          <label className="block text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Select Topic or Study Deck
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {decks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                onClick={() => {
                  setActiveDeck(deck);
                  setCustomTopic('');
                }}
                className={`p-3 text-left rounded-lg border transition-all flex items-center justify-between ${
                  activeDeck?.id === deck.id
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 ring-1 ring-indigo-500/20 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="text-xs font-bold truncate">{deck.title}</div>
                  <div className="text-[11px] font-mono text-neutral-400">{deck.cards.length} flashcards</div>
                </div>
                {activeDeck?.id === deck.id && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="pt-1">
            <span className="text-[11px] font-mono text-neutral-400 block mb-1">Or enter a custom domain:</span>
            <input
              type="text"
              placeholder="e.g. Molecular Genetics & Transcription, Microeconomics, Clinical Pathology..."
              value={customTopic}
              onChange={(e) => {
                setCustomTopic(e.target.value);
                setActiveDeck(null);
              }}
              className="w-full text-xs p-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>
        </div>

        {/* Number of Questions */}
        <div>
          <label className="block text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Number of Questions
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setQuestionCount(num)}
                className={`py-2 text-xs font-semibold rounded-md border transition-all ${
                  questionCount === num
                    ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                {num} Questions
              </button>
            ))}
          </div>
        </div>

        {/* Test Mode & Timer */}
        <div>
          <label className="block text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Examination Mode
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setTestMode('timed')}
              className={`p-3 rounded-lg border text-left transition-all ${
                testMode === 'timed'
                  ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 shadow-xs ring-1 ring-indigo-500/20'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-850'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                <Timer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Timed Examination</span>
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                Simulates exam conditions with live countdown and auto-submission
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTestMode('practice')}
              className={`p-3 rounded-lg border text-left transition-all ${
                testMode === 'practice'
                  ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 shadow-xs ring-1 ring-indigo-500/20'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-850'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Untimed Practice</span>
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                Self-paced review without strict countdown pressure
              </div>
            </button>
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Calibration Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'standard', label: 'Standard', desc: 'Core foundational coursework' },
              { id: 'challenging', label: 'Challenging', desc: 'Application & synthesis cases' },
              { id: 'comprehensive', label: 'Comprehensive', desc: 'Exhaustive full-breadth scope' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id as any)}
                className={`p-2.5 text-left rounded-lg border transition-all ${
                  difficulty === d.id
                    ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 shadow-2xs font-semibold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <div className="text-xs font-bold">{d.label}</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error Notice */}
        {generationError && (
          <div className="p-3 rounded-md border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generationError}</span>
          </div>
        )}

        {/* Launch Button */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <button
            onClick={onBackToDashboard}
            className="px-3.5 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleStartTest}
            disabled={isGenerating || (!activeDeck && !customTopic.trim())}
            className="px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Synthesizing Test...' : `Start ${questionCount}-Question Assessment`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
