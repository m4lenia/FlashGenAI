import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Plus, 
  Search, 
  Layers, 
  BrainCircuit, 
  CheckCircle2, 
  Circle, 
  Lightbulb, 
  AlertTriangle, 
  Calculator, 
  Table as TableIcon, 
  FileText, 
  Send, 
  Trash2, 
  ChevronRight, 
  Share2, 
  ArrowRight, 
  MessageSquare, 
  UploadCloud, 
  X, 
  Wand2, 
  HelpCircle, 
  Download, 
  Edit3, 
  Check,
  Zap,
  Bookmark,
  GraduationCap
} from 'lucide-react';
import { StudyPage, StudyPageSection, StudyPageCallout, StudyCopilotMessage, Deck, Flashcard } from '../types';

interface StudyPagesViewProps {
  studyPages: StudyPage[];
  onUpdateStudyPage: (page: StudyPage) => void;
  onCreateStudyPage: (page: StudyPage) => void;
  onDeleteStudyPage: (pageId: string) => void;
  onConvertPageToDeck: (title: string, cards: Flashcard[]) => void;
  onStartTestFromTopic: (topic: string, textContext: string) => void;
  onBackToDashboard: () => void;
}

const SAMPLE_SUBJECTS = ['All', 'Biochemistry', 'Computer Science', 'Medicine', 'Physics', 'Psychology', 'General'];

export const StudyPagesView: React.FC<StudyPagesViewProps> = ({
  studyPages,
  onUpdateStudyPage,
  onCreateStudyPage,
  onDeleteStudyPage,
  onConvertPageToDeck,
  onStartTestFromTopic,
  onBackToDashboard,
}) => {
  const [selectedPageId, setSelectedPageId] = useState<string>(() => {
    return studyPages[0]?.id || '';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');

  // Generator Modal state
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newSubject, setNewSubject] = useState('General');
  const [newLevel, setNewLevel] = useState('undergraduate');
  const [newNotesText, setNewNotesText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);
  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  const [genStep, setGenStep] = useState(0);

  // Copilot Chat state
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<StudyCopilotMessage[]>([
    {
      id: 'm-welcome',
      role: 'assistant',
      content: 'Hello! I am your Turbo AI Study Copilot. Ask me anything about this study page, request simpler explanations, or tell me to add notes, mnemonics, or test questions directly to your page.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  // AI Add to notes quick prompt state
  const [customAddPrompt, setCustomAddPrompt] = useState('');
  const [isExpandingNotes, setIsExpandingNotes] = useState(false);
  const [expandingAction, setExpandingAction] = useState<string | null>(null);
  const [isConvertingToDeck, setIsConvertingToDeck] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Editing state for active page
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [tempSectionContent, setTempSectionContent] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const activePage = studyPages.find((p) => p.id === selectedPageId) || studyPages[0];

  useEffect(() => {
    if (activePage) {
      setTempTitle(activePage.title);
    }
  }, [activePage?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages]);

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Filter study pages
  const filteredPages = studyPages.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || p.subject.toLowerCase() === selectedSubject.toLowerCase();
    return matchesSearch && matchesSubject;
  });

  // Handle File Upload for Generator
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      setUploadedFile({
        base64,
        mimeType: file.type || 'text/plain',
        name: file.name,
      });
      if (!newTopic) {
        setNewTopic(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit generate new study page
  const handleGenerateStudyPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic && !newNotesText && !uploadedFile) return;

    setIsGeneratingPage(true);
    setGenStep(0);

    const stepInterval = setInterval(() => {
      setGenStep((s) => (s < 4 ? s + 1 : s));
    }, 1800);

    try {
      const res = await fetch('/api/studypages/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: newTopic || 'Study Topic',
          rawText: newNotesText,
          fileBase64: uploadedFile?.base64,
          mimeType: uploadedFile?.mimeType,
          fileName: uploadedFile?.name,
          level: newLevel,
          subject: newSubject,
        }),
      });

      const data = await res.json();
      clearInterval(stepInterval);

      if (data.success && data.studyPage) {
        onCreateStudyPage(data.studyPage);
        setSelectedPageId(data.studyPage.id);
        setIsGeneratorOpen(false);
        setNewTopic('');
        setNewNotesText('');
        setUploadedFile(null);
        showNotice(`Created Study Page: "${data.studyPage.title}" ✨`);
      } else {
        throw new Error(data.error || 'Failed to generate study page.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error(err);
      alert(err.message || 'Error generating study page.');
    } finally {
      setIsGeneratingPage(false);
    }
  };

  // Turbo AI Add-to-Notes (Mnemonics, Tables, Practice Problems, Case Studies, Custom)
  const handleExpandNotes = async (actionType: 'add_mnemonic' | 'add_table' | 'add_problems' | 'add_case_study' | 'custom', promptOverride?: string) => {
    if (!activePage) return;
    setIsExpandingNotes(true);
    setExpandingAction(actionType);

    try {
      const res = await fetch('/api/studypages/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyPage: activePage,
          actionType,
          userPrompt: promptOverride || customAddPrompt,
        }),
      });

      const data = await res.json();
      if (data.success && data.section) {
        const updatedPage: StudyPage = {
          ...activePage,
          sections: [...activePage.sections, data.section],
          updatedAt: new Date().toISOString(),
        };
        onUpdateStudyPage(updatedPage);
        setCustomAddPrompt('');
        showNotice(`Added "${data.section.title}" to your study page! 🚀`);
      } else {
        throw new Error(data.error || 'Failed to add AI notes.');
      }
    } catch (err: any) {
      console.error(err);
      showNotice(err.message || 'Failed to add notes.');
    } finally {
      setIsExpandingNotes(false);
      setExpandingAction(null);
    }
  };

  // Convert entire study page to flashcard deck
  const handleConvertToFlashcards = async () => {
    if (!activePage) return;
    setIsConvertingToDeck(true);

    try {
      const combinedText = `Title: ${activePage.title}
Subject: ${activePage.subject}
Summary: ${activePage.summary}
Key Takeaways: ${activePage.keyTakeaways.join('; ')}
Sections:
${activePage.sections.map((s) => `### ${s.title}\n${s.content}`).join('\n\n')}`;

      const res = await fetch('/api/studypages/convert-to-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyPageTitle: activePage.title,
          content: combinedText,
          count: 12,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.flashcards)) {
        const cards: Flashcard[] = data.flashcards.map((c: any, i: number) => ({
          id: `card-sp-${Date.now()}-${i}`,
          question: c.question,
          answer: c.answer,
          difficulty: c.difficulty || 'medium',
          explanation: c.explanation || '',
          tags: [activePage.subject, ...(c.tags || [])],
          repetitions: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
          reviewCount: 0,
        }));

        onConvertPageToDeck(activePage.title, cards);
        showNotice(`Created new deck "${activePage.title}" with ${cards.length} flashcards! 🗂️`);
      } else {
        throw new Error(data.error || 'Could not generate cards.');
      }
    } catch (err: any) {
      console.error(err);
      showNotice(err.message || 'Error generating cards.');
    } finally {
      setIsConvertingToDeck(false);
    }
  };

  // Send Copilot Chat
  const handleSendCopilot = async (overrideText?: string) => {
    const textToSend = overrideText || copilotInput;
    if (!textToSend.trim() || !activePage) return;

    const userMsg: StudyCopilotMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    setCopilotMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setCopilotInput('');
    setIsCopilotLoading(true);

    try {
      const res = await fetch('/api/studypages/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyPage: activePage,
          question: textToSend.trim(),
          history: copilotMessages.slice(-6),
        }),
      });

      const data = await res.json();
      if (data.success && data.answer) {
        const assistantMsg: StudyCopilotMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          timestamp: new Date().toISOString(),
          suggestedAction: {
            type: 'append_section',
            label: 'Add this explanation to notebook',
            data: {
              title: `AI Note: ${textToSend.slice(0, 30)}...`,
              content: data.answer,
            },
          },
        };
        setCopilotMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data.error || 'Copilot error.');
      }
    } catch (err: any) {
      console.error(err);
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I hit an error answering. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  // Toggle Section Completed
  const handleToggleSection = (sectionId: string) => {
    if (!activePage) return;
    const updatedSections = activePage.sections.map((s) =>
      s.id === sectionId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    const updatedPage: StudyPage = {
      ...activePage,
      sections: updatedSections,
      updatedAt: new Date().toISOString(),
    };
    onUpdateStudyPage(updatedPage);
  };

  // Save Title
  const handleSaveTitle = () => {
    if (!activePage || !tempTitle.trim()) return;
    const updatedPage: StudyPage = {
      ...activePage,
      title: tempTitle.trim(),
      updatedAt: new Date().toISOString(),
    };
    onUpdateStudyPage(updatedPage);
    setEditingTitle(false);
  };

  // Save Section Content
  const handleSaveSection = (sectionId: string) => {
    if (!activePage) return;
    const updatedSections = activePage.sections.map((s) =>
      s.id === sectionId ? { ...s, content: tempSectionContent } : s
    );
    const updatedPage: StudyPage = {
      ...activePage,
      sections: updatedSections,
      updatedAt: new Date().toISOString(),
    };
    onUpdateStudyPage(updatedPage);
    setEditingSectionId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
              Turbo AI Study Notebooks
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              {studyPages.length} {studyPages.length === 1 ? 'Page' : 'Pages'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
            <span>Study Pages</span>
            <Sparkles className="w-5 h-5 text-indigo-500" />
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Interactive living study guides with structured chapters, instant flashcard generation, and active AI copilot.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsGeneratorOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <Wand2 className="w-4 h-4" />
            <span>Generate Study Page with AI</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Selector, Center Notebook, Right Copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Notebook List / Search */}
        <div className="lg:col-span-3 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search study pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Subject Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SAMPLE_SUBJECTS.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  selectedSubject === sub
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Pages List */}
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filteredPages.map((page) => {
              const isSelected = page.id === activePage?.id;
              const completedCount = (page.sections || []).filter((s) => s.isCompleted).length;
              const totalSections = page.sections?.length || 0;
              const progressPct = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

              return (
                <div
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                      {page.subject}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {totalSections} sec
                    </span>
                  </div>

                  <h3 className="font-bold text-xs text-neutral-900 dark:text-white mt-1.5 line-clamp-2">
                    {page.title}
                  </h3>

                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-1">
                    {page.summary}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-neutral-400">
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 mr-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-medium">{progressPct}%</span>
                  </div>
                </div>
              );
            })}

            {filteredPages.length === 0 && (
              <div className="p-6 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 text-xs text-neutral-400">
                No study pages found. Click &quot;Generate Study Page&quot; to create one!
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Active Study Page Canvas */}
        <div className={`space-y-6 ${isCopilotOpen ? 'lg:col-span-6' : 'lg:col-span-9'}`}>
          {activePage ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xs">
              {/* Top toolbar */}
              <div className="flex items-center justify-between gap-3 pb-5 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
                    {activePage.subject}
                  </span>
                  <span className="text-xs text-neutral-400">
                    Updated {new Date(activePage.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Convert to Flashcards button */}
                  <button
                    onClick={handleConvertToFlashcards}
                    disabled={isConvertingToDeck}
                    className="py-1.5 px-3 rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    title="Send this study page directly into a Flashcard Deck"
                  >
                    <Zap className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{isConvertingToDeck ? 'Creating Deck...' : 'Send to Deck'}</span>
                  </button>

                  {/* Take Topic Test button */}
                  <button
                    onClick={() => {
                      const allText = activePage.sections.map((s) => `${s.title}: ${s.content}`).join('\n\n');
                      onStartTestFromTopic(activePage.topic, allText);
                    }}
                    className="py-1.5 px-3 rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Take Test</span>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => {
                      if (confirm(`Delete study page "${activePage.title}"?`)) {
                        onDeleteStudyPage(activePage.id);
                      }
                    }}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title="Delete study page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title Header */}
              <div className="mt-5 mb-6">
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-950 px-3 py-1.5 rounded-xl border border-indigo-500 w-full focus:outline-none"
                    />
                    <button
                      onClick={handleSaveTitle}
                      className="p-2 rounded-xl bg-indigo-600 text-white font-bold"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="group flex items-center justify-between">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                      {activePage.title}
                    </h2>
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-opacity"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Executive Summary Card */}
              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 mb-6 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  <Bookmark className="w-4 h-4 text-indigo-500" />
                  <span>Executive Summary</span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {activePage.summary}
                </p>

                {/* Key Takeaways */}
                {activePage.keyTakeaways && activePage.keyTakeaways.length > 0 && (
                  <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                    <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      High-Yield Exam Takeaways:
                    </div>
                    <ul className="space-y-1.5">
                      {activePage.keyTakeaways.map((takeaway, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Sections / Notebook Blocks */}
              <div className="space-y-6">
                {activePage.sections.map((section, idx) => (
                  <div
                    key={section.id}
                    className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleToggleSection(section.id)}
                          className="text-neutral-400 hover:text-indigo-600 transition-colors"
                          title={section.isCompleted ? 'Mark incomplete' : 'Mark reviewed'}
                        >
                          {section.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                          {section.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (editingSectionId === section.id) {
                              setEditingSectionId(null);
                            } else {
                              setEditingSectionId(section.id);
                              setTempSectionContent(section.content);
                            }
                          }}
                          className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded"
                          title="Edit section notes"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    {editingSectionId === section.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={6}
                          value={tempSectionContent}
                          onChange={(e) => setTempSectionContent(e.target.value)}
                          className="w-full p-3 text-xs rounded-xl border border-indigo-500 bg-neutral-50 dark:bg-neutral-950 font-mono text-neutral-900 dark:text-white focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingSectionId(null)}
                            className="px-3 py-1 text-xs text-neutral-500"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveSection(section.id)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap font-sans">
                        {section.content}
                      </div>
                    )}

                    {/* Callouts (Formulas, Mnemonics, Traps, Concepts) */}
                    {section.callouts && section.callouts.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {section.callouts.map((c, cIdx) => {
                          const isWarning = c.type === 'warning';
                          const isFormula = c.type === 'formula';
                          const isMnemonic = c.type === 'mnemonic';

                          return (
                            <div
                              key={cIdx}
                              className={`p-3 rounded-xl border text-xs ${
                                isWarning
                                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                                  : isFormula
                                  ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/60 text-purple-900 dark:text-purple-200 font-mono'
                                  : isMnemonic
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                                  : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 font-bold mb-1">
                                {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                                {isFormula && <Calculator className="w-3.5 h-3.5 text-purple-600" />}
                                {isMnemonic && <BrainCircuit className="w-3.5 h-3.5 text-emerald-600" />}
                                {!isWarning && !isFormula && !isMnemonic && <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />}
                                <span>{c.title}</span>
                              </div>
                              <div className="whitespace-pre-wrap">{c.content}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* TURBO AI: ADD TO NOTES TOOLBAR */}
              <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    Turbo AI: Add to Notes
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    One-click add smart memory structures
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <button
                    onClick={() => handleExpandNotes('add_mnemonic')}
                    disabled={isExpandingNotes}
                    className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-100">
                      <BrainCircuit className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Mnemonics</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Memory hooks & rhymes
                    </div>
                  </button>

                  <button
                    onClick={() => handleExpandNotes('add_table')}
                    disabled={isExpandingNotes}
                    className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-100">
                      <TableIcon className="w-3.5 h-3.5 text-sky-500" />
                      <span>Comparison Table</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Contrast difficult terms
                    </div>
                  </button>

                  <button
                    onClick={() => handleExpandNotes('add_problems')}
                    disabled={isExpandingNotes}
                    className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-100">
                      <Calculator className="w-3.5 h-3.5 text-purple-500" />
                      <span>Practice Problems</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Step-by-step solutions
                    </div>
                  </button>

                  <button
                    onClick={() => handleExpandNotes('add_case_study')}
                    disabled={isExpandingNotes}
                    className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left transition-all"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-100">
                      <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Case Study</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Real-world scenario
                    </div>
                  </button>
                </div>

                {/* Custom AI Addition Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customAddPrompt.trim()) {
                      handleExpandNotes('custom');
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Ask Turbo AI to add anything (e.g. 'Add a section on clinical enzyme inhibitors')..."
                    value={customAddPrompt}
                    onChange={(e) => setCustomAddPrompt(e.target.value)}
                    disabled={isExpandingNotes}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isExpandingNotes || !customAddPrompt.trim()}
                    className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0"
                  >
                    <span>{isExpandingNotes ? 'Adding...' : 'Add to Notes'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <BookOpen className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                No Study Page Selected
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Select a page from the library on the left or generate a new study page with Turbo AI.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Turbo AI Study Copilot Drawer */}
        {isCopilotOpen && (
          <div className="lg:col-span-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-4 shadow-xs flex flex-col h-[75vh] sticky top-24">
            {/* Copilot Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-neutral-900 dark:text-white">
                    Study Copilot
                  </h4>
                  <p className="text-[10px] text-neutral-400">Context: {activePage?.title?.slice(0, 20)}...</p>
                </div>
              </div>

              <button
                onClick={() => setIsCopilotOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div className="py-2.5 flex flex-wrap gap-1 border-b border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => handleSendCopilot('Explain the core concept in simpler terms with a real-life analogy.')}
                className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 transition-colors"
              >
                Explain like I&apos;m 5 🧸
              </button>
              <button
                onClick={() => handleSendCopilot('What are 3 tricky multiple-choice questions professors love to ask on this?')}
                className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 transition-colors"
              >
                Tricky exam traps 🎯
              </button>
              <button
                onClick={() => handleSendCopilot('Give me a memorable acronym or mnemonic for this.')}
                className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 transition-colors"
              >
                Mnemonic 💡
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
              {copilotMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] p-3 rounded-2xl ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                    {/* Copilot Action: Add this answer to notebook */}
                    {m.suggestedAction && activePage && (
                      <div className="mt-2 pt-2 border-t border-neutral-200/40 dark:border-neutral-700/40">
                        <button
                          onClick={() => {
                            const newSec: StudyPageSection = {
                              id: `sec-${Date.now()}`,
                              title: m.suggestedAction?.data?.title || 'Copilot Note',
                              content: m.suggestedAction?.data?.content || m.content,
                              isCompleted: false,
                            };
                            onUpdateStudyPage({
                              ...activePage,
                              sections: [...activePage.sections, newSec],
                              updatedAt: new Date().toISOString(),
                            });
                            showNotice('Added Copilot answer to your notes! 📝');
                          }}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{m.suggestedAction.label}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isCopilotLoading && (
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Turbo Copilot is thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCopilot();
              }}
              className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-1.5"
            >
              <input
                type="text"
                placeholder="Ask about this page..."
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                disabled={isCopilotLoading}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isCopilotLoading || !copilotInput.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* GENERATOR MODAL (TURBO AI STYLE) */}
      {isGeneratorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsGeneratorOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white mx-auto mb-3 shadow-md shadow-indigo-600/20">
                <Wand2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                Generate Turbo AI Study Page
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Enter any topic, paste lecture notes, or upload a PDF to synthesize a structured living notebook.
              </p>
            </div>

            <form onSubmit={handleGenerateStudyPage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Topic or Lecture Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Action Potentials & Synaptic Transmission"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Subject Field
                  </label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Medicine">Medicine & Anatomy</option>
                    <option value="Physics">Physics</option>
                    <option value="Psychology">Psychology</option>
                    <option value="History">History</option>
                    <option value="General">General / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Academic Level
                  </label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="high_school">High School / AP</option>
                    <option value="undergraduate">College / Undergraduate</option>
                    <option value="graduate">Graduate / Professional (MCAT/USMLE/GRE)</option>
                  </select>
                </div>
              </div>

              {/* Source Document or Notes */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Optional Source Material (Paste text or upload file)
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste lecture notes, syllabus concepts, textbook excerpts..."
                  value={newNotesText}
                  onChange={(e) => setNewNotesText(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* File Attachment */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Attach Document (PDF, Image, DOCX, TXT)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer py-2 px-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300 text-xs flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-neutral-400" />
                    <span>{uploadedFile ? uploadedFile.name : 'Choose File...'}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {uploadedFile && (
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Steps when Generating */}
              {isGeneratingPage && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="w-4 h-4 animate-spin text-indigo-500" />
                    <span>Turbo AI Synthesis in Progress...</span>
                  </div>
                  <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
                    {genStep === 0 && 'Reading topic material & extracting core cognitive concepts...'}
                    {genStep === 1 && 'Synthesizing executive summary & high-yield exam takeaways...'}
                    {genStep === 2 && 'Structuring master notebook chapters with deep explanations...'}
                    {genStep === 3 && 'Formulating mnemonic devices, formula blocks, and exam warnings...'}
                    {genStep >= 4 && 'Polishing Turbo AI study page...'}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isGeneratingPage || (!newTopic && !newNotesText && !uploadedFile)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all"
              >
                <Wand2 className="w-4 h-4" />
                <span>{isGeneratingPage ? 'Synthesizing...' : 'Generate Full Study Page'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notice */}
      {statusNotice && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold shadow-2xl border border-neutral-800 dark:border-neutral-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{statusNotice}</span>
          </div>
        </div>
      )}
    </div>
  );
};
