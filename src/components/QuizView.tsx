import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Award, 
  RotateCcw, 
  Sparkles, 
  HelpCircle, 
  ArrowRight,
  Loader2,
  Check,
  Paperclip
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Deck, Flashcard } from '../types';
import { safeApiPost } from '../utils/apiClient';

interface QuizViewProps {
  deck: Deck;
  onBackToDashboard: () => void;
  onFinishQuiz?: (score: number, total: number) => void;
}

interface QuizQuestion {
  card: Flashcard;
  options: string[];
  correctIndex: number;
  explanation?: string;
  hint?: string;
}

export const QuizView: React.FC<QuizViewProps> = ({
  deck,
  onBackToDashboard,
  onFinishQuiz,
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHint, setShowHint] = useState(false);

  // Generate quiz questions
  useEffect(() => {
    let isCancelled = false;

    async function prepareQuiz() {
      setIsLoading(true);
      const cardsToQuiz = [...deck.cards].sort(() => Math.random() - 0.5).slice(0, 10);

      // Pre-extract potential distractor answers from the deck itself as immediate fallbacks
      const allDeckAnswers = deck.cards.map((c) => c.answer);

      const generatedQuestions: QuizQuestion[] = [];

      for (let i = 0; i < cardsToQuiz.length; i++) {
        const card = cardsToQuiz[i];

        // Fetch AI distractors
        let distractors: string[] = [];
        let hint = '';

        try {
          const res = await safeApiPost('/api/flashcards/distractors', {
            question: card.question,
            answer: card.answer,
            topicContext: deck.title,
          });
          if (res.success && res.data && Array.isArray(res.data.distractors) && res.data.distractors.length >= 2) {
            distractors = res.data.distractors.slice(0, 3);
            hint = res.data.hint || '';
          }
        } catch (e) {
          console.warn('Distractor fetch error:', e);
        }

        // If AI generation didn't return 3, fill with other cards' answers
        if (distractors.length < 3) {
          const fallbacks = allDeckAnswers
            .filter((a) => a !== card.answer && !distractors.includes(a))
            .sort(() => Math.random() - 0.5);

          while (distractors.length < 3 && fallbacks.length > 0) {
            distractors.push(fallbacks.pop()!);
          }

          // If still fewer than 3, add generic plausible distractors
          const generic = [
            'Increases activation energy and destabilizes equilibrium state',
            'Primary messenger synthesized in the Golgi apparatus',
            'Inverse relationship mediated by negative feedback loops',
          ];
          while (distractors.length < 3) {
            distractors.push(generic.pop() || 'None of the above statements apply.');
          }
        }

        // Assemble 4 options and shuffle
        const allFour = [card.answer, ...distractors.slice(0, 3)];
        const shuffled = [...allFour].sort(() => Math.random() - 0.5);
        const correctIndex = shuffled.indexOf(card.answer);

        generatedQuestions.push({
          card,
          options: shuffled,
          correctIndex,
          explanation: card.explanation,
          hint,
        });

        // If first question is ready, show it without waiting for all 10!
        if (i === 0 && !isCancelled) {
          setQuestions([...generatedQuestions]);
          setIsLoading(false);
        }
      }

      if (!isCancelled) {
        setQuestions(generatedQuestions);
        setIsLoading(false);
      }
    }

    prepareQuiz();

    return () => {
      isCancelled = true;
    };
  }, [deck]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (index === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowHint(false);
    } else {
      setIsQuizComplete(true);
      if (score + (selectedOption === currentQ.correctIndex ? 1 : 0) >= questions.length * 0.7) {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#10b981', '#3b82f6'],
        });
      }
      onFinishQuiz?.(score, questions.length);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsQuizComplete(false);
    setShowHint(false);
  };

  if (isLoading && questions.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 text-neutral-900 dark:text-white flex items-center justify-center mx-auto mb-3.5">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">
          Generating Multiple-Choice Quiz
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Synthesizing calibrated distractors and concept checks...
        </p>
      </div>
    );
  }

  // Quiz Complete Screen
  if (isQuizComplete) {
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto mb-5 shadow-sm">
          <Award className="w-7 h-7" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2">
          Quiz Completed
        </h2>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          Deck: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{deck.title}</span>
        </p>

        {/* Score Card */}
        <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs mb-6">
          <div className="text-4xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mb-1">
            {percentage}%
          </div>
          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 font-mono">
            {score} / {questions.length} correct
          </div>

          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">
            {percentage >= 90
              ? 'Outstanding mastery. Your concepts are firmly consolidated.'
              : percentage >= 70
              ? 'Good recall. A targeted review will reinforce the remaining items.'
              : 'Keep practicing. Reviewing with flashcards will build up strong recall.'}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 justify-center">
          <button
            onClick={handleRestart}
            className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Quiz</span>
          </button>
          <button
            onClick={onBackToDashboard}
            className="px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Quiz</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            Score: {score} / {currentIndex + (isAnswered ? 1 : 0)}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Question {currentIndex + 1} of {questions.length}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="p-6 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs mb-6">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
          Question
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white leading-snug">
          {currentQ.card.question}
        </h2>

        {/* Card Attachments if present */}
        {currentQ.card.attachments && currentQ.card.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            {currentQ.card.attachments.map((att) => {
              const isImg = att.mimeType.startsWith('image/') || att.dataUrl.startsWith('data:image/');
              if (isImg) {
                return (
                  <div key={att.id} className="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 shadow-2xs">
                    <img src={att.dataUrl} alt={att.name} className="max-h-24 sm:max-h-32 max-w-[200px] object-contain rounded-lg" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate font-mono">
                      {att.name}
                    </div>
                  </div>
                );
              }
              return (
                <a
                  key={att.id}
                  href={att.dataUrl}
                  download={att.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-750 transition-colors border border-neutral-200 dark:border-neutral-700"
                >
                  <Paperclip className="w-3 h-3 text-neutral-500" />
                  <span className="truncate max-w-[140px]">{att.name}</span>
                </a>
              );
            })}
          </div>
        )}

        {currentQ.hint && (
          <div className="mt-4">
            {!showHint ? (
              <button
                onClick={() => setShowHint(true)}
                className="text-xs text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-medium"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Show Diagnostic Hint</span>
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/60 text-xs text-indigo-700 dark:text-indigo-300">
                <span className="font-semibold">Hint: </span>
                {currentQ.hint}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2.5 mb-6">
        {currentQ.options.map((option, idx) => {
          const letter = String.fromCharCode(65 + idx); // A, B, C, D
          let stateStyle = 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-800 dark:text-neutral-200';

          if (isAnswered) {
            if (idx === currentQ.correctIndex) {
              stateStyle = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500/20';
            } else if (idx === selectedOption) {
              stateStyle = 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-1 ring-rose-500/20';
            } else {
              stateStyle = 'opacity-40 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelectOption(idx)}
              disabled={isAnswered}
              className={`w-full p-3.5 rounded-lg border text-left transition-all flex items-start gap-3 ${stateStyle}`}
            >
              <div
                className={`w-6 h-6 rounded-md font-mono flex items-center justify-center font-bold text-xs shrink-0 ${
                  isAnswered && idx === currentQ.correctIndex
                    ? 'bg-emerald-600 text-white'
                    : isAnswered && idx === selectedOption
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {letter}
              </div>

              <div className="flex-1 text-xs sm:text-sm font-medium pt-0.5 leading-snug">
                {option}
              </div>

              {isAnswered && idx === currentQ.correctIndex && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              {isAnswered && idx === selectedOption && idx !== currentQ.correctIndex && (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation Banner & Next Button */}
      {isAnswered && (
        <div className="p-4 rounded-lg bg-neutral-100/70 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 mb-6 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                {selectedOption === currentQ.correctIndex ? 'Correct' : 'Incorrect'}
              </div>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {currentQ.explanation || `The correct answer is: ${currentQ.card.answer}`}
              </p>
            </div>

            <button
              onClick={handleNextQuestion}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>{currentIndex + 1 === questions.length ? 'Finish' : 'Next'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
