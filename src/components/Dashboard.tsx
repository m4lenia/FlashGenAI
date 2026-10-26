import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Layers, 
  Flame, 
  Clock, 
  CheckCircle, 
  BookOpen, 
  Search, 
  Plus, 
  Download, 
  MoreVertical, 
  Trash2, 
  Play, 
  HelpCircle, 
  FileUp, 
  ArrowRight,
  TrendingUp,
  Tag,
  Share2,
  Award
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Deck, UserStudyStats } from '../types';
import { isCardDue, getCardStatus } from '../utils/sm2';
import { exportDeckToCSV, exportDeckToJSON } from '../utils/storage';

interface DashboardProps {
  decks: Deck[];
  stats: UserStudyStats;
  onSelectDeckForStudy: (deck: Deck, dueOnly?: boolean) => void;
  onSelectDeckForQuiz: (deck: Deck) => void;
  onSelectDeckForTest: (deck: Deck) => void;
  onOpenCardEditor: (deck: Deck) => void;
  onNavigateToGenerate: () => void;
  onDeleteDeck: (deckId: string) => void;
  onCreateEmptyDeck: (title: string, description?: string) => void;
  onImportDeck: (deck: Deck) => void;
  systemAnnouncement?: string;
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  decks,
  stats,
  onSelectDeckForStudy,
  onSelectDeckForQuiz,
  onSelectDeckForTest,
  onOpenCardEditor,
  onNavigateToGenerate,
  onDeleteDeck,
  onCreateEmptyDeck,
  onImportDeck,
  systemAnnouncement,
  currentUser,
  onOpenAuthModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [activeMenuDeckId, setActiveMenuDeckId] = useState<string | null>(null);

  // Compute aggregate stats across all decks
  const aggregateMetrics = useMemo(() => {
    let totalCards = 0;
    let totalMastered = 0;
    let totalLearning = 0;
    let totalDue = 0;

    decks.forEach((deck) => {
      deck.cards.forEach((card) => {
        totalCards++;
        const status = getCardStatus(card);
        if (status === 'mastered') totalMastered++;
        else if (status === 'learning') totalLearning++;

        if (isCardDue(card)) totalDue++;
      });
    });

    return { totalCards, totalMastered, totalLearning, totalDue };
  }, [decks]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    decks.forEach((d) => (d.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [decks]);

  // Filter decks
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      const matchesSearch =
        deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (deck.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.cards.some(
          (c) =>
            c.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.answer.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesTag = !selectedTag || (deck.tags && deck.tags.includes(selectedTag));
      return matchesSearch && matchesTag;
    });
  }, [decks, searchQuery, selectedTag]);

  // Handle file import
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (parsed && Array.isArray(parsed.cards)) {
            const importedDeck: Deck = {
              ...parsed,
              id: `deck-${Date.now()}`,
              title: parsed.title || 'Imported Deck',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            onImportDeck(importedDeck);
          }
        } else if (file.name.endsWith('.csv')) {
          // Parse CSV lines
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          const cards = [];
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
            if (parts[0] && parts[1]) {
              cards.push({
                id: `card-${Date.now()}-${i}`,
                question: parts[0],
                answer: parts[1],
                difficulty: (parts[2] as any) || 'medium',
                explanation: parts[3] || '',
                repetitions: 0,
                interval: 0,
                easeFactor: 2.5,
                nextReviewDate: new Date().toISOString(),
                reviewCount: 0,
              });
            }
          }
          if (cards.length > 0) {
            const importedDeck: Deck = {
              id: `deck-${Date.now()}`,
              title: file.name.replace(/\.[^/.]+$/, ''),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tags: ['Imported'],
              cards,
              color: 'violet',
            };
            onImportDeck(importedDeck);
          }
        }
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateEmpty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckTitle.trim()) return;
    onCreateEmptyDeck(newDeckTitle.trim(), newDeckDesc.trim());
    setNewDeckTitle('');
    setNewDeckDesc('');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Global System Announcement Banner */}
      {systemAnnouncement && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-indigo-500/10 border border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 flex items-center gap-3 text-xs shadow-xs animate-in fade-in duration-200">
          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider shrink-0">
            Notice
          </span>
          <span className="font-medium leading-relaxed flex-1">
            {systemAnnouncement}
          </span>
        </div>
      )}

      {/* Account Cloud Status */}
      {currentUser ? (
        <div className="mb-6 px-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-neutral-500 dark:text-neutral-400">
              Account Cloud Sync:
            </span>
            <span className="font-bold text-neutral-900 dark:text-white font-mono">
              {currentUser.email}
            </span>
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Flashcards, test scores, & SM-2 repetition saved to your account</span>
          </span>
        </div>
      ) : (
        <div className="mb-6 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>
              <strong>Guest Mode:</strong> Study progress is currently stored locally in this browser.
            </span>
          </div>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors shrink-0 w-fit"
            >
              Sign In to Save to Account
            </button>
          )}
        </div>
      )}

      {/* Hero / Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {/* Total Cards */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Cards</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
            {aggregateMetrics.totalCards}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            Across {decks.length} study {decks.length === 1 ? 'deck' : 'decks'}
          </div>
        </div>

        {/* Due Today */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Due For Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
            {aggregateMetrics.totalDue}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            {aggregateMetrics.totalDue > 0 ? 'Ready for spaced recall' : 'All caught up!'}
          </div>
        </div>

        {/* Mastered */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cards Mastered</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
            {aggregateMetrics.totalMastered}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            {aggregateMetrics.totalCards > 0
              ? `${Math.round((aggregateMetrics.totalMastered / aggregateMetrics.totalCards) * 100)}% retention rate`
              : '0%'}
          </div>
        </div>

        {/* Study Streak */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Daily Streak</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
            {stats.streak} {stats.streak === 1 ? 'Day' : 'Days'}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            {stats.totalReviewsCompleted} total card reviews
          </div>
        </div>
      </div>

      {/* AI Generator Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-neutral-900 border border-indigo-800/40 text-white shadow-lg shadow-indigo-950/20 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 mb-2">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Multimodal Gemini Understanding</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Turn Any Lecture, Document, or Photo into Flashcards
          </h2>
          <p className="text-xs text-indigo-200/80 max-w-xl mt-1">
            Drag and drop a PDF, Word document, lecture slides, or photos of your notebook.
            Gemini synthesizes active-recall flashcards calibrated for spaced repetition.
          </p>
        </div>

        <button
          onClick={onNavigateToGenerate}
          className="px-5 py-2.5 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 hover:scale-[1.02]"
        >
          <span>Generate from File</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search decks, questions, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Import file */}
          <label className="cursor-pointer px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-2xs">
            <FileUp className="w-3.5 h-3.5" />
            <span>Import</span>
            <input
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
          </label>

          {/* New Empty Deck */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Deck</span>
          </button>
        </div>
      </div>

      {/* Tag Pills */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              selectedTag === null
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            All Decks ({decks.length})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1 ${
                selectedTag === tag
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              <Tag className="w-3 h-3 opacity-60" />
              <span>{tag}</span>
            </button>
          ))}
        </div>
      )}

      {/* Decks Grid */}
      {filteredDecks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8">
          <BookOpen className="w-12 h-12 text-neutral-400 mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200 mb-1">
            No Decks Found
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            {searchQuery
              ? `No decks matching "${searchQuery}". Try a different keyword.`
              : 'Create your first deck or generate one automatically with Gemini AI.'}
          </p>
          <button
            onClick={onNavigateToGenerate}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 shadow-sm"
          >
            Generate with Gemini
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDecks.map((deck) => {
            const dueCount = deck.cards.filter((c) => isCardDue(c)).length;
            const masteredCount = deck.cards.filter(
              (c) => getCardStatus(c) === 'mastered'
            ).length;
            const masteredPercent = deck.cards.length
              ? Math.round((masteredCount / deck.cards.length) * 100)
              : 0;

            const isMenuOpen = activeMenuDeckId === deck.id;

            return (
              <div
                key={deck.id}
                className="group relative rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 shadow-xs hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top row: tags, due count, dropdown menu */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-1">
                      {dueCount > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{dueCount} due</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Reviewed</span>
                        </span>
                      )}

                      {(deck.tags || []).slice(0, 2).map((t, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Menu toggle */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenuDeckId(isMenuOpen ? null : deck.id)
                        }
                        className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        title="Deck options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-6 z-20 w-44 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl py-1 text-xs">
                          <button
                            onClick={() => {
                              setActiveMenuDeckId(null);
                              onOpenCardEditor(deck);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Edit Cards ({deck.cards.length})</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuDeckId(null);
                              onSelectDeckForTest(deck);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium"
                          >
                            <Award className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Take Topic Test</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuDeckId(null);
                              exportDeckToCSV(deck);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                          >
                            <Download className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Export as CSV (Anki)</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuDeckId(null);
                              exportDeckToJSON(deck);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                          >
                            <Download className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Export as JSON</span>
                          </button>
                          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
                          <button
                            onClick={() => {
                              setActiveMenuDeckId(null);
                              if (confirm(`Delete deck "${deck.title}"?`)) {
                                onDeleteDeck(deck.id);
                              }
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Deck</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white line-clamp-1 mb-1">
                    {deck.title}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[32px] leading-relaxed mb-4">
                    {deck.description || 'Spaced repetition flashcards deck.'}
                  </p>

                  {/* Progress info */}
                  <div className="space-y-1.5 mb-5">
                    <div className="flex justify-between items-center text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      <span>{masteredCount} of {deck.cards.length} mastered</span>
                      <span>{masteredPercent}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${masteredPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-1.5 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onSelectDeckForStudy(deck, dueCount > 0)}
                      className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Study Flip</span>
                    </button>

                    <button
                      onClick={() => onSelectDeckForQuiz(deck)}
                      className="py-2 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Quiz</span>
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectDeckForTest(deck)}
                    className="w-full py-1.5 px-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 hover:bg-indigo-100/70 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Award className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Topic Test</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Empty Deck */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateEmpty}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
              Create New Deck
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Deck Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biochemistry Chapter 4"
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Key concepts, exam dates, or study goals..."
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-sm"
              >
                Create Deck
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
