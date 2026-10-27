import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Shuffle, 
  Volume2, 
  ArrowLeft, 
  Award, 
  CheckCircle, 
  Repeat, 
  Sparkles,
  HelpCircle,
  Clock,
  Layers,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CardRating, Deck, Flashcard } from '../types';
import { calculateSM2, getRatingIntervalPreview, isCardDue } from '../utils/sm2';

interface StudyViewProps {
  deck: Deck;
  onUpdateDeck: (updatedDeck: Deck) => void;
  onFinishSession: (reviewedCount: number) => void;
  onBackToDashboard: () => void;
  initialFilterDueOnly?: boolean;
}

export const StudyView: React.FC<StudyViewProps> = ({
  deck,
  onUpdateDeck,
  onFinishSession,
  onBackToDashboard,
  initialFilterDueOnly = false,
}) => {
  const [filterDueOnly, setFilterDueOnly] = useState(initialFilterDueOnly);
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);
  const [isReverseMode, setIsReverseMode] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);

  // Cards array prepared according to filters and shuffle
  const activeCards = useMemo(() => {
    let list = [...deck.cards];
    if (filterDueOnly) {
      list = list.filter((c) => isCardDue(c));
    }
    if (filterStarredOnly) {
      list = list.filter((c) => c.starred);
    }
    if (isShuffled) {
      // Deterministic or seeded shuffle
      list = [...list].sort(() => Math.random() - 0.5);
    }
    return list;
  }, [deck.cards, filterDueOnly, filterStarredOnly, isShuffled]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<
    Array<{ cardId: string; rating: CardRating }>
  >([]);

  // Current Card
  const currentCard = activeCards[currentIndex];

  // Reset when filters change
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(false);
    setSessionLogs([]);
  }, [filterDueOnly, filterStarredOnly, isShuffled]);

  // Flip card handler
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // Star card handler
  const handleToggleStar = useCallback(() => {
    if (!currentCard) return;
    const updatedCards = deck.cards.map((c) =>
      c.id === currentCard.id ? { ...c, starred: !c.starred } : c
    );
    onUpdateDeck({ ...deck, cards: updatedCards, updatedAt: new Date().toISOString() });
  }, [currentCard, deck, onUpdateDeck]);

  // Text-to-speech
  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // SM-2 Rating handler
  const handleRate = useCallback(
    (rating: CardRating) => {
      if (!currentCard) return;

      const sm2Result = calculateSM2(currentCard, rating);
      const updatedCard: Flashcard = {
        ...currentCard,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        easeFactor: sm2Result.easeFactor,
        nextReviewDate: sm2Result.nextReviewDate,
        lastStudiedDate: new Date().toISOString(),
        reviewCount: currentCard.reviewCount + 1,
        history: [
          ...(currentCard.history || []),
          {
            date: new Date().toISOString(),
            rating,
            interval: sm2Result.interval,
            easeFactor: sm2Result.easeFactor,
          },
        ],
      };

      // Update in deck
      const updatedCards = deck.cards.map((c) =>
        c.id === currentCard.id ? updatedCard : c
      );
      onUpdateDeck({ ...deck, cards: updatedCards, updatedAt: new Date().toISOString() });

      // Track log
      const newLogs = [...sessionLogs, { cardId: currentCard.id, rating }];
      setSessionLogs(newLogs);

      // Advance
      if (currentIndex + 1 < activeCards.length) {
        setIsFlipped(false);
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Session complete!
        setSessionCompleted(true);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b'],
        });
        onFinishSession(newLogs.length);
      }
    },
    [currentCard, deck, onUpdateDeck, sessionLogs, currentIndex, activeCards.length, onFinishSession]
  );

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentIndex + 1 < activeCards.length) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, activeCards.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid if user is in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (isFlipped) {
        if (e.key === '1') handleRate('again');
        if (e.key === '2') handleRate('hard');
        if (e.key === '3') handleRate('good');
        if (e.key === '4') handleRate('easy');
      } else {
        if (e.key.toLowerCase() === 's') handleToggleStar();
        if (e.key.toLowerCase() === 'r') setIsReverseMode((r) => !r);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleNext, handlePrev, handleRate, handleToggleStar, isFlipped]);

  // If no cards match filter
  if (activeCards.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          {filterDueOnly ? 'All Due Cards Cleared!' : 'No Cards Found'}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          {filterDueOnly
            ? 'Great job! You have reviewed all cards scheduled for today in this deck.'
            : filterStarredOnly
            ? 'You have not starred any cards in this deck yet.'
            : 'This deck does not contain any flashcards yet.'}
        </p>
        <div className="flex justify-center gap-3">
          {filterDueOnly && (
            <button
              onClick={() => setFilterDueOnly(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            >
              Study All {deck.cards.length} Cards
            </button>
          )}
          {filterStarredOnly && (
            <button
              onClick={() => setFilterStarredOnly(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            >
              Show All Cards
            </button>
          )}
          <button
            onClick={onBackToDashboard}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // SESSION COMPLETED SUMMARY SCREEN
  // ==========================================
  if (sessionCompleted) {
    const againCount = sessionLogs.filter((l) => l.rating === 'again').length;
    const hardCount = sessionLogs.filter((l) => l.rating === 'hard').length;
    const goodCount = sessionLogs.filter((l) => l.rating === 'good').length;
    const easyCount = sessionLogs.filter((l) => l.rating === 'easy').length;

    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto mb-5 shadow-sm">
          <Award className="w-7 h-7" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2">
          Session Complete
        </h2>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          You reviewed {sessionLogs.length} flashcards in <span className="font-semibold text-neutral-800 dark:text-neutral-200">{deck.title}</span>.
        </p>

        {/* Rating Breakdown Badges */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/60">
            <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">{againCount}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-rose-700 dark:text-rose-300">Again</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60">
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">{hardCount}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-300">Hard</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60">
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{goodCount}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Good</div>
          </div>
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/60">
            <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">{easyCount}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Easy</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setSessionCompleted(false);
              setSessionLogs([]);
            }}
            className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Study Again</span>
          </button>
          <button
            onClick={onBackToDashboard}
            className="px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            Return to Decks
          </button>
        </div>
      </div>
    );
  }

  // Front vs Back text based on Reverse Mode
  const frontContent = isReverseMode ? currentCard.answer : currentCard.question;
  const backContent = isReverseMode ? currentCard.question : currentCard.answer;
  const progressPercent = Math.round(((currentIndex + 1) / activeCards.length) * 100);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Study</span>
        </button>

        {/* Study Toggles */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Due filter toggle */}
          <button
            onClick={() => setFilterDueOnly((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
              filterDueOnly
                ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-850'
            }`}
            title="Filter cards due for SM-2 review today"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Due Only</span>
          </button>

          {/* Starred filter toggle */}
          <button
            onClick={() => setFilterStarredOnly((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
              filterStarredOnly
                ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-850'
            }`}
            title="Study starred cards only"
          >
            <Star className={`w-3.5 h-3.5 ${filterStarredOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span className="hidden sm:inline">Starred</span>
          </button>

          {/* Reverse mode toggle */}
          <button
            onClick={() => setIsReverseMode((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
              isReverseMode
                ? 'bg-violet-50 dark:bg-violet-950/80 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300'
                : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-850'
            }`}
            title="Reverse mode: show answer first (Press R)"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reverse</span>
          </button>

          {/* Shuffle toggle */}
          <button
            onClick={() => setIsShuffled((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-all ${
              isShuffled
                ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-850'
            }`}
            title="Shuffle deck"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar & Counters */}
      <div className="mb-4">
        <div className="flex justify-between items-center text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            Card {currentIndex + 1} of {activeCards.length}
          </span>
          <span>{progressPercent}% Complete</span>
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ==========================================
          3D PERSPECTIVE FLIP CARD CONTAINER
      ========================================== */}
      <div className="perspective-1000 w-full min-h-[380px] sm:min-h-[420px] select-none my-4">
        <div
          onClick={handleFlip}
          className={`relative w-full min-h-[380px] sm:min-h-[420px] rounded-xl transition-transform duration-500 preserve-3d cursor-pointer shadow-sm hover:shadow-md ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* ================= FRONT FACE ================= */}
          <div className="absolute inset-0 backface-hidden rounded-xl p-6 sm:p-8 flex flex-col justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    currentCard.difficulty === 'easy'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400'
                      : currentCard.difficulty === 'hard'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-400'
                  }`}
                >
                  {currentCard.difficulty}
                </span>

                {isReverseMode && (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300">
                    Reverse Mode
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                {/* Audio button */}
                <button
                  onClick={() => handleSpeak(frontContent)}
                  className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Read aloud"
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                {/* Star button */}
                <button
                  onClick={handleToggleStar}
                  className="p-1.5 rounded-md text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Favorite / Star Card (Press S)"
                >
                  <Star
                    className={`w-4 h-4 ${
                      currentCard.starred ? 'fill-amber-500 text-amber-500' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Prompt / Question Content */}
            <div className="my-auto py-6">
              <div className="text-[11px] font-mono font-semibold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase mb-2">
                {isReverseMode ? 'Answer (Identify the Question)' : 'Question / Concept'}
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white leading-snug">
                {frontContent}
              </div>

              {/* Tags */}
              {currentCard.tags && currentCard.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {currentCard.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Flip hint footer */}
            <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 pt-4 border-t border-neutral-100 dark:border-neutral-800/80">
              <span className="flex items-center gap-1 font-medium">
                <RotateCw className="w-3.5 h-3.5" />
                Click card or press <kbd className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[10px]">Space</kbd> to flip
              </span>
              <span className="text-[11px] font-mono">
                Interval: {currentCard.interval}d
              </span>
            </div>
          </div>

          {/* ================= BACK FACE ================= */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl p-6 sm:p-8 flex flex-col justify-between bg-neutral-50/50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                {isReverseMode ? 'Target Question' : 'Target Answer'}
              </span>

              <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleSpeak(backContent)}
                  className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Read aloud"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToggleStar}
                  className="p-1.5 rounded-md text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Star
                    className={`w-4 h-4 ${
                      currentCard.starred ? 'fill-amber-500 text-amber-500' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Answer Content */}
            <div className="my-auto py-4">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white leading-snug mb-3">
                {backContent}
              </div>

              {/* Context / Explanation */}
              {currentCard.explanation && (
                <div className="p-3.5 rounded-lg bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mt-4">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">Rationale: </span>
                  {currentCard.explanation}
                </div>
              )}
            </div>

            {/* Flip Back hint */}
            <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
              <span className="flex items-center gap-1 font-medium">
                <RotateCw className="w-3.5 h-3.5" />
                Click card or press <kbd className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[10px]">Space</kbd> to flip back
              </span>
              <span className="text-[11px] font-mono">
                Ease: {currentCard.easeFactor}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          RATING BUTTONS (SM-2 ALGORITHM)
      ========================================== */}
      {isFlipped ? (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2.5">
            Calibrate recall for next spaced interval (or keys 1 - 4):
          </div>

          <div className="grid grid-cols-4 gap-2">
            {/* Again */}
            <button
              onClick={() => handleRate('again')}
              className="p-3 rounded-lg bg-rose-50/70 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-900/60 transition-all text-center flex flex-col items-center justify-center"
            >
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                Again <kbd className="text-[10px] font-mono bg-rose-200/60 dark:bg-rose-900/60 px-1 rounded">1</kbd>
              </span>
              <span className="text-[11px] text-rose-500 dark:text-rose-400/80 font-mono mt-0.5">
                {getRatingIntervalPreview(currentCard, 'again')}
              </span>
            </button>

            {/* Hard */}
            <button
              onClick={() => handleRate('hard')}
              className="p-3 rounded-lg bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 border border-amber-200 dark:border-amber-900/60 transition-all text-center flex flex-col items-center justify-center"
            >
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                Hard <kbd className="text-[10px] font-mono bg-amber-200/60 dark:bg-amber-900/60 px-1 rounded">2</kbd>
              </span>
              <span className="text-[11px] text-amber-500 dark:text-amber-400/80 font-mono mt-0.5">
                {getRatingIntervalPreview(currentCard, 'hard')}
              </span>
            </button>

            {/* Good */}
            <button
              onClick={() => handleRate('good')}
              className="p-3 rounded-lg bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900/60 transition-all text-center flex flex-col items-center justify-center"
            >
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                Good <kbd className="text-[10px] font-mono bg-emerald-200/60 dark:bg-emerald-900/60 px-1 rounded">3</kbd>
              </span>
              <span className="text-[11px] text-emerald-500 dark:text-emerald-400/80 font-mono mt-0.5">
                {getRatingIntervalPreview(currentCard, 'good')}
              </span>
            </button>

            {/* Easy */}
            <button
              onClick={() => handleRate('easy')}
              className="p-3 rounded-lg bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-900/60 transition-all text-center flex flex-col items-center justify-center"
            >
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                Easy <kbd className="text-[10px] font-mono bg-indigo-200/60 dark:bg-indigo-900/60 px-1 rounded">4</kbd>
              </span>
              <span className="text-[11px] text-indigo-500 dark:text-indigo-400/80 font-mono mt-0.5">
                {getRatingIntervalPreview(currentCard, 'easy')}
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* Navigation arrows when not yet flipped */
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleFlip}
            className="px-5 py-2 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-xs transition-all"
          >
            Show Answer
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === activeCards.length - 1}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
