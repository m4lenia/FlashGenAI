import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  FileType, 
  Sparkles, 
  AlertCircle, 
  Check, 
  Trash2, 
  RefreshCw, 
  ArrowRight,
  BookOpen,
  Sliders,
  CheckCircle2,
  FileCheck2,
  Tag
} from 'lucide-react';
import { Flashcard, GenerationDifficulty, GenerationFormat, Deck } from '../types';

interface GenerateViewProps {
  onDeckCreated: (newDeck: Deck, startStudyImmediately?: boolean) => void;
  onCancel: () => void;
}

const LOADING_STEPS = [
  'Reading your document with Gemini multimodal engine...',
  'Analyzing structure and extracting high-yield definitions...',
  'Formulating active-recall spaced repetition flashcards...',
  'Calibrating question difficulty and generating contextual explanations...',
  'Finalizing deck and readying memory hooks...',
];

const STUDY_TIPS = [
  'Tip: Active recall is 50% more effective for long-term memory retention than passive re-reading.',
  'Tip: The SM-2 spaced repetition algorithm schedules reviews right at the boundary of forgetting.',
  'Tip: Fill-in-the-blank cards are ideal for exact scientific formulas and medical terminology.',
  'Tip: Keep answers concise so your brain focuses on the core concept rather than verbatim memorization.',
];

export const GenerateView: React.FC<GenerateViewProps> = ({ onDeckCreated, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [uploadedFile, setUploadedFile] = useState<{
    file: File;
    base64: string;
    mimeType: string;
    name: string;
    sizeFormatted: string;
  } | null>(null);
  const [rawText, setRawText] = useState('');
  const [deckTitle, setDeckTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [count, setCount] = useState<number>(15);
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>('mixed');
  const [format, setFormat] = useState<GenerationFormat>('qa');
  const [focusTopic, setFocusTopic] = useState('');

  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Review stage after generation
  const [generatedCards, setGeneratedCards] = useState<Flashcard[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [regeneratingCardId, setRegeneratingCardId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Cycle loading messages during generation
  useEffect(() => {
    let stepInterval: any;
    let tipInterval: any;
    if (isGenerating) {
      stepInterval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2600);
      tipInterval = setInterval(() => {
        setTipIdx((prev) => (prev + 1) % STUDY_TIPS.length);
      }, 4500);
    }
    return () => {
      clearInterval(stepInterval);
      clearInterval(tipInterval);
    };
  }, [isGenerating]);

  // File size formatter
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Process File to Base64
  const handleFile = (file: File) => {
    setError(null);
    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds 25MB limit. Please upload a smaller document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      const mimeType = file.type || 'application/octet-stream';
      setUploadedFile({
        file,
        base64,
        mimeType,
        name: file.name,
        sizeFormatted: formatBytes(file.size),
      });

      // Suggest deck title based on file name if not already set
      if (!deckTitle) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setDeckTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Trigger Gemini generation API
  const handleGenerate = async () => {
    setError(null);

    if (activeTab === 'upload' && !uploadedFile) {
      setError('Please select or drag-and-drop a file to generate flashcards.');
      return;
    }

    if (activeTab === 'text' && (!rawText || rawText.trim().length < 20)) {
      setError('Please enter at least a few sentences of study text or notes.');
      return;
    }

    setIsGenerating(true);
    setLoadingStepIdx(0);

    try {
      const response = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: uploadedFile?.base64,
          mimeType: uploadedFile?.mimeType,
          fileName: uploadedFile?.name,
          rawText: activeTab === 'text' ? rawText : undefined,
          count,
          difficulty,
          format,
          focusTopic: focusTopic.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate flashcards from Gemini.');
      }

      // Format flashcards with SM-2 defaults
      const formattedCards: Flashcard[] = (data.flashcards || []).map((c: any, idx: number) => ({
        id: `card-${Date.now()}-${idx}`,
        question: c.question || '',
        answer: c.answer || '',
        difficulty: c.difficulty === 'easy' || c.difficulty === 'hard' ? c.difficulty : 'medium',
        explanation: c.explanation || '',
        tags: Array.isArray(c.tags) ? c.tags : [],
        starred: false,
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        reviewCount: 0,
      }));

      setGeneratedCards(formattedCards);
      setIsReviewing(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to communicate with Gemini API. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Card editing & regeneration in review stage
  const handleStartEdit = (card: Flashcard) => {
    setEditingCardId(card.id);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
  };

  const handleSaveEdit = (cardId: string) => {
    setGeneratedCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, question: editQuestion.trim(), answer: editAnswer.trim() }
          : c
      )
    );
    setEditingCardId(null);
  };

  const handleDeleteCard = (cardId: string) => {
    setGeneratedCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const handleRegenerateCard = async (card: Flashcard) => {
    setRegeneratingCardId(card.id);
    try {
      const res = await fetch('/api/flashcards/regenerate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalQuestion: card.question,
          originalAnswer: card.answer,
          topic: deckTitle || focusTopic,
        }),
      });
      const data = await res.json();
      if (data.success && data.card) {
        setGeneratedCards((prev) =>
          prev.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  question: data.card.question || c.question,
                  answer: data.card.answer || c.answer,
                  difficulty: data.card.difficulty || c.difficulty,
                  explanation: data.card.explanation || c.explanation,
                }
              : c
          )
        );
      }
    } catch (e) {
      console.error('Failed to regenerate card:', e);
    } finally {
      setRegeneratingCardId(null);
    }
  };

  // Final deck confirmation
  const handleSaveDeck = (studyImmediately: boolean = false) => {
    if (generatedCards.length === 0) return;

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Collect tags from cards if user didn't enter any
    const allTags = parsedTags.length > 0 
      ? parsedTags 
      : Array.from(new Set(generatedCards.flatMap((c) => c.tags || []))).slice(0, 4);

    const title = deckTitle.trim() || (uploadedFile ? uploadedFile.name.replace(/\.[^/.]+$/, '') : 'Generated Flashcard Deck');

    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      title,
      description: focusTopic ? `Focus: ${focusTopic}` : `Generated from ${uploadedFile ? uploadedFile.name : 'study notes'} with ${generatedCards.length} flashcards`,
      sourceFileName: uploadedFile?.name,
      sourceFileType: uploadedFile ? uploadedFile.mimeType.split('/')[1]?.toUpperCase() || 'FILE' : 'NOTES',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: allTags.length > 0 ? allTags : ['Study'],
      cards: generatedCards,
      color: 'indigo',
    };

    onDeckCreated(newDeck, studyImmediately);
  };

  // ==========================================
  // REVIEW STAGE VIEW
  // ==========================================
  if (isReviewing) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Generated {generatedCards.length} Flashcards</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Review & Customize Your Deck
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Review the cards below, edit any text, regenerate questions, or jump directly into study mode.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReviewing(false)}
              className="px-3.5 py-2 text-sm font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Back to Options
            </button>
            <button
              onClick={() => handleSaveDeck(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm"
            >
              Save Deck
            </button>
            <button
              onClick={() => handleSaveDeck(true)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/25 flex items-center gap-1.5"
            >
              <span>Start Studying</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Deck metadata header */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Deck Title
            </label>
            <input
              type="text"
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              placeholder="Enter deck title..."
              className="w-full text-base font-bold bg-transparent border-b border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-indigo-500 text-neutral-900 dark:text-white focus:outline-none py-0.5"
            />
          </div>
          <div className="w-full sm:w-64">
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Biology, Exam 2"
              className="w-full text-xs bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Cards List */}
        <div className="space-y-4">
          {generatedCards.map((card, idx) => {
            const isEditing = editingCardId === card.id;
            const isRegenerating = regeneratingCardId === card.id;

            return (
              <div
                key={card.id}
                className={`p-4 rounded-xl border transition-all duration-200 ${
                  isEditing
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-neutral-900'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-neutral-400 dark:text-neutral-500">
                      #{idx + 1}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        card.difficulty === 'easy'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : card.difficulty === 'hard'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                      }`}
                    >
                      {card.difficulty}
                    </span>
                    {(card.tags || []).slice(0, 2).map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRegenerateCard(card)}
                      disabled={isRegenerating}
                      title="Regenerate this card with Gemini"
                      className="p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-indigo-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      title="Delete card"
                      className="p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                        Question / Prompt
                      </label>
                      <textarea
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                        rows={2}
                        className="w-full text-sm p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                        Answer
                      </label>
                      <textarea
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        rows={2}
                        className="w-full text-sm p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingCardId(null)}
                        className="px-3 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(card.id)}
                        className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-500"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => handleStartEdit(card)}
                    className="cursor-pointer group"
                    title="Click to edit"
                  >
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                      {card.question}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80">
                      {card.answer}
                    </div>
                    {card.explanation && (
                      <div className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                        Context: {card.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // CONFIGURATION & UPLOAD VIEW
  // ==========================================
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Multimodal File Understanding</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          Generate Spaced Repetition Flashcards
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-lg mx-auto">
          Upload any lecture PDF, lecture slides, notes photos, Word document, or raw notes.
          Gemini extracts the highest-yield active recall flashcards in seconds.
        </p>
      </div>

      {/* Tabs: File Upload vs Text */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'upload'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Upload Document / Slides / Image
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'text'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Paste Notes or Text
        </button>
      </div>

      {/* Input Section */}
      {activeTab === 'upload' ? (
        <div className="mb-6">
          {!uploadedFile ? (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[0.99]'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.pptx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Drag & drop your study material here
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-4">
                Supports <span className="font-semibold text-neutral-700 dark:text-neutral-300">PDF, DOCX, TXT, PPTX</span>, or photos/screenshots of notes and slides (<span className="font-semibold text-neutral-700 dark:text-neutral-300">PNG, JPG, WebP</span>).
              </p>
              <span className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:bg-neutral-50">
                Browse Files
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-center justify-between">
              <div className="flex items-center space-x-3 truncate">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                    {uploadedFile.name}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {uploadedFile.sizeFormatted} • {uploadedFile.mimeType}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setUploadedFile(null)}
                className="p-2 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                title="Remove file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Paste Notes, Lecture Transcript, or Textbook Content
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            placeholder="Paste your study notes, key terms, syllabus objectives, or lecture transcript here..."
            className="w-full text-sm p-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <div className="flex justify-between items-center text-xs text-neutral-400 mt-1.5 px-1">
            <span>{rawText.length} characters</span>
            <span>Recommended: 200 - 40,000 characters</span>
          </div>
        </div>
      )}

      {/* Generation Options Accordion/Grid */}
      <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-sm mb-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
            Generation Settings
          </h2>
        </div>

        {/* Number of Cards */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">
            Number of Cards
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[10, 15, 20, 30].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCount(num)}
                className={`py-2 text-sm font-semibold rounded-lg border transition-all ${
                  count === num
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                {num} Cards
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">
            Difficulty Level
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'mixed', label: 'Balanced Mix' },
              { id: 'easy', label: 'Easy' },
              { id: 'medium', label: 'Medium' },
              { id: 'hard', label: 'Hard' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id as GenerationDifficulty)}
                className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                  difficulty === d.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">
            Card Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'qa', label: 'Standard Q&A', desc: 'Direct active recall' },
              { id: 'multiple_choice', label: 'Multiple Choice', desc: 'Scenario & choices' },
              { id: 'fill_in_the_blank', label: 'Fill-in-Blank', desc: 'Cloze deletion terms' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id as GenerationFormat)}
                className={`p-2.5 text-left rounded-lg border transition-all ${
                  format === f.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <div className="text-xs font-bold">{f.label}</div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Focus Topic (optional) */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
            Topic Focus / Custom Instructions (Optional)
          </label>
          <input
            type="text"
            value={focusTopic}
            onChange={(e) => setFocusTopic(e.target.value)}
            placeholder="e.g. Focus heavily on enzymatic reaction rates and competitive inhibition"
            className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 flex items-start gap-3 text-xs leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Notice:</span> {error}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={isGenerating}
          className="px-4 py-2.5 text-sm font-medium rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (activeTab === 'upload' && !uploadedFile) || (activeTab === 'text' && !rawText.trim())}
          className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
          <span>Generate {count} Flashcards</span>
        </button>
      </div>

      {/* Loading Modal / Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="w-7 h-7 animate-spin" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
              Gemini is Analyzing Your Document
            </h3>

            {/* Stepper message */}
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 min-h-[44px] flex items-center justify-center px-4 mb-4">
              {LOADING_STEPS[loadingStepIdx]}
            </p>

            {/* Shimmer progress line */}
            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden mb-6">
              <div className="h-full bg-indigo-600 rounded-full w-2/3 animate-[pulse_1.5s_ease-in-out_infinite]" />
            </div>

            {/* Helpful study tip */}
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 text-xs text-neutral-500 dark:text-neutral-400 italic">
              {STUDY_TIPS[tipIdx]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
