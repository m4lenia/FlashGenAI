import React, { useState, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Star, 
  Edit3, 
  Check, 
  Sparkles,
  Search,
  BookOpen,
  Paperclip,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { Deck, Flashcard, CardAttachment } from '../types';
import { safeApiPost } from '../utils/apiClient';
import { processUploadFile } from '../utils/fileCompressor';

interface CardEditorModalProps {
  deck: Deck;
  isOpen: boolean;
  onClose: () => void;
  onSaveDeck: (updatedDeck: Deck) => void;
}

export const CardEditorModal: React.FC<CardEditorModalProps> = ({
  deck,
  isOpen,
  onClose,
  onSaveDeck,
}) => {
  const [cards, setCards] = useState<Flashcard[]>(deck.cards);
  const [deckTitle, setDeckTitle] = useState(deck.title);
  const [deckDescription, setDeckDescription] = useState(deck.description || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  // Form states for active edit or new card
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editDifficulty, setEditDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [editExplanation, setEditExplanation] = useState('');
  const [editAttachments, setEditAttachments] = useState<CardAttachment[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const cardAttachmentInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleAttachFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) continue;
      try {
        const processed = await processUploadFile(file);
        const dataUrl = `data:${processed.mimeType};base64,${processed.base64}`;
        const newAtt: CardAttachment = {
          id: processed.id,
          name: processed.name,
          mimeType: processed.mimeType,
          dataUrl,
          sizeFormatted: processed.sizeFormatted,
        };
        setEditAttachments((prev) => [...prev, newAtt]);
      } catch (e) {
        console.warn('Failed to process card attachment:', e);
      }
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setEditAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const filteredCards = cards.filter(
    (c) =>
      c.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartEdit = (card: Flashcard) => {
    setIsAddingNew(false);
    setEditingCardId(card.id);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
    setEditDifficulty(card.difficulty);
    setEditExplanation(card.explanation || '');
    setEditAttachments(card.attachments || []);
  };

  const handleSaveCardEdit = (cardId: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              question: editQuestion.trim(),
              answer: editAnswer.trim(),
              difficulty: editDifficulty,
              explanation: editExplanation.trim(),
              attachments: editAttachments,
            }
          : c
      )
    );
    setEditingCardId(null);
    setEditAttachments([]);
  };

  const handleAddNewCard = () => {
    if (!editQuestion.trim() || !editAnswer.trim()) return;

    const newCard: Flashcard = {
      id: `card-${Date.now()}`,
      question: editQuestion.trim(),
      answer: editAnswer.trim(),
      difficulty: editDifficulty,
      explanation: editExplanation.trim(),
      attachments: editAttachments,
      starred: false,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      reviewCount: 0,
    };

    setCards((prev) => [newCard, ...prev]);
    setIsAddingNew(false);
    setEditQuestion('');
    setEditAnswer('');
    setEditExplanation('');
    setEditAttachments([]);
  };

  const handleDeleteCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (editingCardId === cardId) setEditingCardId(null);
  };

  const handleToggleStar = (cardId: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, starred: !c.starred } : c))
    );
  };

  const handleRegenerateCard = async (card: Flashcard) => {
    setRegeneratingId(card.id);
    try {
      const res = await safeApiPost('/api/flashcards/regenerate-card', {
        originalQuestion: card.question,
        originalAnswer: card.answer,
        topic: deckTitle,
      });
      if (res.success && res.data?.card) {
        const newCard = res.data.card;
        setCards((prev) =>
          prev.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  question: newCard.question || c.question,
                  answer: newCard.answer || c.answer,
                  difficulty: newCard.difficulty || c.difficulty,
                  explanation: newCard.explanation || c.explanation,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleCommitAll = () => {
    onSaveDeck({
      ...deck,
      title: deckTitle.trim() || deck.title,
      description: deckDescription.trim(),
      cards,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const renderAttachmentEditor = () => (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-neutral-400" />
          <span>Card Files & Diagrams ({editAttachments.length})</span>
        </label>
        <button
          type="button"
          onClick={() => cardAttachmentInputRef.current?.click()}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          <span>Upload Files / Images</span>
        </button>
      </div>

      <input
        ref={cardAttachmentInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.docx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleAttachFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {editAttachments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 max-h-36 overflow-y-auto">
          {editAttachments.map((att) => {
            const isImg = att.mimeType.startsWith('image/') || att.dataUrl.startsWith('data:image/');
            return (
              <div
                key={att.id}
                className="p-1.5 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isImg ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="w-7 h-7 rounded object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">{att.name}</div>
                    <div className="text-[10px] text-neutral-400 font-mono">{att.sizeFormatted || 'File'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="p-1 text-neutral-400 hover:text-rose-500 rounded transition-colors shrink-0"
                  title="Remove file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          onClick={() => cardAttachmentInputRef.current?.click()}
          className="border border-dashed border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 rounded-lg p-2.5 text-center cursor-pointer transition-colors"
        >
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Click to upload one or more diagrams, formulas, or reference files for this card
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Edit Deck & Cards</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {cards.length} flashcards in this deck
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Deck metadata editor */}
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Deck Title
            </label>
            <input
              type="text"
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              className="w-full text-sm font-semibold p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              Deck Description
            </label>
            <input
              type="text"
              value={deckDescription}
              onChange={(e) => setDeckDescription(e.target.value)}
              placeholder="Add an optional description..."
              className="w-full text-xs p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Toolbar: Search & Add */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search cards in deck..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => {
              setIsAddingNew(true);
              setEditingCardId(null);
              setEditQuestion('');
              setEditAnswer('');
              setEditExplanation('');
              setEditAttachments([]);
            }}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Card</span>
          </button>
        </div>

        {/* Cards Scrollable List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Add New Card Form */}
          {isAddingNew && (
            <div className="p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 space-y-3 mb-4 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Create New Flashcard
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Question / Concept
                </label>
                <textarea
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  rows={2}
                  placeholder="Enter active recall prompt..."
                  className="w-full text-xs p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Answer
                </label>
                <textarea
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  rows={2}
                  placeholder="Enter correct answer..."
                  className="w-full text-xs p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {renderAttachmentEditor()}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewCard}
                  className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-500"
                >
                  Add Card
                </button>
              </div>
            </div>
          )}

          {filteredCards.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              No cards found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredCards.map((card, idx) => {
              const isEditing = editingCardId === card.id;
              const isRegenerating = regeneratingId === card.id;

              return (
                <div
                  key={card.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isEditing
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-neutral-900'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                          Question
                        </label>
                        <textarea
                          value={editQuestion}
                          onChange={(e) => setEditQuestion(e.target.value)}
                          rows={2}
                          className="w-full text-xs p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                          className="w-full text-xs p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {renderAttachmentEditor()}

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingCardId(null)}
                          className="px-3 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveCardEdit(card.id)}
                          className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-500"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-neutral-400 font-semibold">
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
                          <span className="text-[10px] text-neutral-400 font-mono">
                            Interval: {card.interval}d
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleStar(card.id)}
                            className="p-1 text-neutral-400 hover:text-amber-500 rounded"
                            title="Star Card"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                card.starred ? 'fill-amber-500 text-amber-500' : ''
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => handleRegenerateCard(card)}
                            disabled={isRegenerating}
                            className="p-1 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                            title="Regenerate with Gemini"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-indigo-500' : ''}`}
                            />
                          </button>
                          <button
                            onClick={() => handleStartEdit(card)}
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-neutral-900 dark:text-white mb-1">
                        {card.question}
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950/40 p-2 rounded-lg">
                        {card.answer}
                      </div>

                      {/* Display card attachments if any */}
                      {card.attachments && card.attachments.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {card.attachments.map((att) => {
                            const isImg = att.mimeType.startsWith('image/') || att.dataUrl.startsWith('data:image/');
                            return (
                              <div
                                key={att.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
                              >
                                {isImg ? (
                                  <img src={att.dataUrl} alt={att.name} className="w-3.5 h-3.5 rounded object-cover" />
                                ) : (
                                  <Paperclip className="w-3 h-3 text-neutral-400" />
                                )}
                                <span className="truncate max-w-[140px]">{att.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 bg-neutral-50 dark:bg-neutral-950/60 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCommitAll}
            className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
