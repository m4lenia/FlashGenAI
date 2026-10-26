export type CardDifficulty = 'easy' | 'medium' | 'hard';
export type CardRating = 'again' | 'hard' | 'good' | 'easy';

export interface CardReviewLog {
  date: string;
  rating: CardRating;
  interval: number;
  easeFactor: number;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  difficulty: CardDifficulty;
  explanation?: string;
  tags?: string[];
  starred?: boolean;
  // SM-2 Spaced Repetition fields
  repetitions: number;
  interval: number; // days
  easeFactor: number; // starts at 2.5
  nextReviewDate: string; // ISO string
  lastStudiedDate?: string;
  reviewCount: number;
  history?: CardReviewLog[];
}

export interface Deck {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  sourceFileName?: string;
  sourceFileType?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  cards: Flashcard[];
  color?: string;
}

export interface UserStudyStats {
  streak: number;
  lastStudyDate: string | null;
  totalReviewsCompleted: number;
  studyTimeMinutes?: number;
  testsCompleted?: number;
  averageTestScore?: number;
}

export type GenerationFormat = 'qa' | 'multiple_choice' | 'fill_in_the_blank';
export type GenerationDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export interface GenerationOptions {
  count: number;
  difficulty: GenerationDifficulty;
  format: GenerationFormat;
  focusTopic?: string;
  deckTitle?: string;
  tags?: string[];
}

// Topic Test Types
export interface TopicTestQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subtopic: string;
  difficulty?: string;
}

export interface TopicTest {
  id: string;
  testTitle: string;
  topic: string;
  timeLimitMinutes: number;
  questions: TopicTestQuestion[];
  deckId?: string;
  deckTitle?: string;
}

export interface TopicTestResult {
  id: string;
  testId: string;
  testTitle: string;
  topic: string;
  completedAt: string;
  timeSpentSeconds: number;
  score: number;
  totalQuestions: number;
  percentage: number;
  userAnswers: { [questionId: string]: number };
  flaggedQuestions: string[];
  subtopicBreakdown: Array<{
    subtopic: string;
    correct: number;
    total: number;
    percentage: number;
  }>;
  missedQuestions: Array<{
    questionId: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    subtopic: string;
  }>;
}

// Remember Me & Account Switcher
export interface RememberedAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'manager' | 'user';
  lastUsed: string; // ISO date
  isGoogle?: boolean;
  savedPassword?: string;
}

// Turbo AI style Study Pages
export interface StudyPageCallout {
  type: 'concept' | 'warning' | 'formula' | 'mnemonic' | 'example';
  title: string;
  content: string;
}

export interface StudyPageSection {
  id: string;
  title: string;
  content: string; // Rich Markdown text
  callouts?: StudyPageCallout[];
  isCompleted?: boolean;
  tags?: string[];
}

export interface StudyPage {
  id: string;
  userId?: string;
  title: string;
  topic: string;
  subject: string;
  summary: string;
  keyTakeaways: string[];
  sections: StudyPageSection[];
  linkedDeckId?: string;
  createdAt: string;
  updatedAt: string;
  color?: string;
  tags: string[];
}

export interface StudyCopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedAction?: {
    type: 'append_section' | 'create_deck' | 'take_test';
    label: string;
    data?: any;
  };
}

