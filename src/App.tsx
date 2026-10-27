import React, { useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { GenerateView } from './components/GenerateView';
import { StudyView } from './components/StudyView';
import { QuizView } from './components/QuizView';
import { TopicTestView } from './components/TopicTestView';
import { StudyPagesView } from './components/StudyPagesView';
import { ManagerPanel } from './components/ManagerPanel';
import { AuthModal } from './components/AuthModal';
import { AccountSwitcherModal } from './components/AccountSwitcherModal';
import { CardEditorModal } from './components/CardEditorModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { Deck, UserStudyStats, Flashcard, StudyPage } from './types';
import { 
  loadDecks, 
  saveDecks, 
  loadStats, 
  saveStats,
  recordStudySession, 
  getStoredTheme, 
  setStoredTheme,
  loadStudyPages,
  saveStudyPages
} from './utils/storage';
import { 
  loadAccountDecks, 
  saveAccountDeck, 
  deleteAccountDeck, 
  loadAccountStats, 
  saveAccountStats,
  loadAccountStudyPages,
  saveAccountStudyPage,
  deleteAccountStudyPage
} from './utils/accountSync';
import { auth, signOutUser, isUserManager, MANAGER_EMAIL } from './firebase';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks(auth.currentUser?.uid));
  const [stats, setStats] = useState<UserStudyStats>(() => loadStats(auth.currentUser?.uid));
  const [studyPages, setStudyPages] = useState<StudyPage[]>(() => loadStudyPages(auth.currentUser?.uid));
  const [currentView, setCurrentView] = useState<'dashboard' | 'generate' | 'study' | 'quiz' | 'test' | 'manager' | 'studypages'>('dashboard');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [studyDueOnly, setStudyDueOnly] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => getStoredTheme() === 'dark');
  
  // Auth state & Account Switcher
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);

  // System announcement
  const [systemAnnouncement, setSystemAnnouncement] = useState<string>(() => {
    return localStorage.getItem('flashgen_announcement') || 'Welcome to FlashGen AI! Multimodal flashcards, Turbo AI Study Pages, and diagnostic exams are active.';
  });

  // Modals
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Listen to Firebase Auth state and load account progress
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsAuthModalOpen(false);
        try {
          const [accountDecks, accountStats, accountPages] = await Promise.all([
            loadAccountDecks(user.uid),
            loadAccountStats(user.uid),
            loadAccountStudyPages(user.uid),
          ]);
          setDecks(accountDecks);
          setStats(accountStats);
          if (accountPages && accountPages.length > 0) {
            setStudyPages(accountPages);
          }
        } catch (e) {
          console.warn('Error loading account data:', e);
        }
      } else {
        // User signed out, switch back to guest data
        setDecks(loadDecks(null));
        setStats(loadStats(null));
        setStudyPages(loadStudyPages(null));
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      setStoredTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setStoredTheme('light');
    }
  }, [darkMode]);

  // Global keyboard shortcut for '?'
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === '?') {
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Show temporary toast notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setDecks(loadDecks(null));
      setStats(loadStats(null));
      setStudyPages(loadStudyPages(null));
      showToast('Signed out successfully.');
      if (currentView === 'manager') {
        setCurrentView('dashboard');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Deck operations
  const handleDeckCreated = (newDeck: Deck, startStudyImmediately: boolean = false) => {
    const deckWithUser: Deck = {
      ...newDeck,
      userId: currentUser?.uid,
    };
    const updated = [deckWithUser, ...decks];
    setDecks(updated);
    saveDecks(updated, currentUser?.uid);
    if (currentUser) {
      saveAccountDeck(currentUser.uid, deckWithUser).catch((err) => {
        console.error('Error saving deck to cloud:', err);
      });
    }
    showToast(`Created deck "${newDeck.title}" with ${newDeck.cards.length} cards`);

    if (startStudyImmediately) {
      setActiveDeckId(newDeck.id);
      setStudyDueOnly(false);
      setCurrentView('study');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleUpdateDeck = useCallback((updatedDeck: Deck) => {
    const deckWithUser: Deck = {
      ...updatedDeck,
      userId: currentUser?.uid,
    };
    setDecks((prev) => {
      const next = prev.map((d) => (d.id === updatedDeck.id ? deckWithUser : d));
      saveDecks(next, currentUser?.uid);
      return next;
    });
    if (currentUser) {
      saveAccountDeck(currentUser.uid, deckWithUser).catch((err) => {
        console.error('Error syncing deck update to cloud:', err);
      });
    }
  }, [currentUser]);

  const handleAddCardsToDeck = (deckId: string, newCards: Flashcard[]) => {
    setDecks((prev) => {
      let targetDeck: Deck | null = null;
      const next = prev.map((d) => {
        if (d.id === deckId) {
          const mod = {
            ...d,
            userId: currentUser?.uid,
            cards: [...newCards, ...d.cards],
            updatedAt: new Date().toISOString(),
          };
          targetDeck = mod;
          return mod;
        }
        return d;
      });
      saveDecks(next, currentUser?.uid);
      if (currentUser && targetDeck) {
        saveAccountDeck(currentUser.uid, targetDeck).catch(console.error);
      }
      return next;
    });
    showToast(`Added ${newCards.length} corrective flashcards to deck!`);
  };

  const handleDeleteDeck = (deckId: string) => {
    const updated = decks.filter((d) => d.id !== deckId);
    setDecks(updated);
    saveDecks(updated, currentUser?.uid);
    if (currentUser) {
      deleteAccountDeck(currentUser.uid, deckId).catch((err) => {
        console.error('Error deleting deck from cloud:', err);
      });
    }
    showToast('Deck deleted.');
    if (activeDeckId === deckId) {
      setActiveDeckId(null);
      setCurrentView('dashboard');
    }
  };

  const handleCreateEmptyDeck = (title: string, description?: string) => {
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      userId: currentUser?.uid,
      title,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['Custom'],
      cards: [],
      color: 'indigo',
    };
    const updated = [newDeck, ...decks];
    setDecks(updated);
    saveDecks(updated, currentUser?.uid);
    if (currentUser) {
      saveAccountDeck(currentUser.uid, newDeck).catch(console.error);
    }
    showToast(`Created deck "${title}"`);
    setEditingDeck(newDeck);
  };

  const handleImportDeck = (importedDeck: Deck) => {
    const deckWithUser: Deck = {
      ...importedDeck,
      userId: currentUser?.uid,
    };
    const updated = [deckWithUser, ...decks];
    setDecks(updated);
    saveDecks(updated, currentUser?.uid);
    if (currentUser) {
      saveAccountDeck(currentUser.uid, deckWithUser).catch(console.error);
    }
    showToast(`Imported "${importedDeck.title}" (${importedDeck.cards.length} cards)`);
  };

  // Study Pages operations
  const handleCreateStudyPage = (page: StudyPage) => {
    const pageWithUser: StudyPage = {
      ...page,
      userId: currentUser?.uid,
    };
    const updated = [pageWithUser, ...studyPages];
    setStudyPages(updated);
    saveStudyPages(updated, currentUser?.uid);
    if (currentUser) {
      saveAccountStudyPage(currentUser.uid, pageWithUser).catch(console.error);
    }
  };

  const handleUpdateStudyPage = (page: StudyPage) => {
    const pageWithUser: StudyPage = {
      ...page,
      userId: currentUser?.uid,
    };
    const updated = studyPages.map((p) => (p.id === page.id ? pageWithUser : p));
    setStudyPages(updated);
    saveStudyPages(updated, currentUser?.uid);
    if (currentUser) {
      saveAccountStudyPage(currentUser.uid, pageWithUser).catch(console.error);
    }
  };

  const handleDeleteStudyPage = (pageId: string) => {
    const updated = studyPages.filter((p) => p.id !== pageId);
    setStudyPages(updated);
    saveStudyPages(updated, currentUser?.uid);
    if (currentUser) {
      deleteAccountStudyPage(currentUser.uid, pageId).catch(console.error);
    }
    showToast('Study page deleted.');
  };

  // Convert study page to flashcard deck
  const handleConvertPageToDeck = (title: string, cards: Flashcard[]) => {
    const newDeck: Deck = {
      id: `deck-sp-${Date.now()}`,
      userId: currentUser?.uid,
      title: `${title} (Flashcards)`,
      description: `Spaced repetition flashcards generated from Turbo AI Study Page: "${title}"`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['Study Page', 'Turbo AI'],
      cards,
      color: 'indigo',
    };
    handleDeckCreated(newDeck, true);
  };

  // Start Topic Test from Study Page
  const handleStartTestFromTopic = (topic: string, textContext: string) => {
    setCurrentView('test');
    showToast(`Launched Topic Test for "${topic}"! 🎯`);
  };

  // Study & Quiz & Test Launchers
  const handleSelectDeckForStudy = (deck: Deck, dueOnly: boolean = false) => {
    setActiveDeckId(deck.id);
    setStudyDueOnly(dueOnly);
    setCurrentView('study');
  };

  const handleSelectDeckForQuiz = (deck: Deck) => {
    setActiveDeckId(deck.id);
    setCurrentView('quiz');
  };

  const handleSelectDeckForTest = (deck: Deck) => {
    setActiveDeckId(deck.id);
    setCurrentView('test');
  };

  const handleFinishStudySession = (reviewedCount: number) => {
    if (reviewedCount > 0) {
      const updatedStats = recordStudySession(reviewedCount, currentUser?.uid);
      setStats(updatedStats);
      if (currentUser) {
        saveAccountStats(currentUser.uid, updatedStats).catch((err) => {
          console.error('Error saving account study stats:', err);
        });
      }
      showToast(`Logged ${reviewedCount} card reviews! Streak: ${updatedStats.streak} days 🔥`);
    }
  };

  const activeDeck = decks.find((d) => d.id === activeDeckId) || decks[0];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          if (view === 'dashboard') {
            setActiveDeckId(null);
          }
        }}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((prev) => !prev)}
        stats={stats}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        activeDeckTitle={activeDeck?.title}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAccountSwitcher={() => setIsAccountSwitcherOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content View Switcher */}
      <main>
        {currentView === 'dashboard' && (
          <Dashboard
            decks={decks}
            stats={stats}
            onSelectDeckForStudy={handleSelectDeckForStudy}
            onSelectDeckForQuiz={handleSelectDeckForQuiz}
            onSelectDeckForTest={handleSelectDeckForTest}
            onOpenCardEditor={(deck) => setEditingDeck(deck)}
            onNavigateToGenerate={() => setCurrentView('generate')}
            onDeleteDeck={handleDeleteDeck}
            onCreateEmptyDeck={handleCreateEmptyDeck}
            onImportDeck={handleImportDeck}
            systemAnnouncement={systemAnnouncement}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {/* Turbo AI Study Pages View */}
        {currentView === 'studypages' && (
          <StudyPagesView
            studyPages={studyPages}
            onUpdateStudyPage={handleUpdateStudyPage}
            onCreateStudyPage={handleCreateStudyPage}
            onDeleteStudyPage={handleDeleteStudyPage}
            onConvertPageToDeck={handleConvertPageToDeck}
            onStartTestFromTopic={handleStartTestFromTopic}
            onBackToDashboard={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'generate' && (
          <GenerateView
            onDeckCreated={handleDeckCreated}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'study' && activeDeck && (
          <StudyView
            deck={activeDeck}
            onUpdateDeck={handleUpdateDeck}
            onFinishSession={handleFinishStudySession}
            onBackToDashboard={() => setCurrentView('dashboard')}
            initialFilterDueOnly={studyDueOnly}
          />
        )}

        {currentView === 'quiz' && activeDeck && (
          <QuizView
            deck={activeDeck}
            onBackToDashboard={() => setCurrentView('dashboard')}
            onFinishQuiz={() => handleFinishStudySession(10)}
          />
        )}

        {currentView === 'test' && (
          <TopicTestView
            decks={decks}
            selectedDeck={decks.find((d) => d.id === activeDeckId) || null}
            onBackToDashboard={() => setCurrentView('dashboard')}
            onAddCardsToDeck={handleAddCardsToDeck}
            currentUser={currentUser}
            onTestCompleted={() => {
              const updated = loadStats(currentUser?.uid);
              setStats(updated);
            }}
          />
        )}

        {currentView === 'manager' && (
          <ManagerPanel
            currentUser={currentUser}
            decks={decks}
            stats={stats}
            onBackToDashboard={() => setCurrentView('dashboard')}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            systemAnnouncement={systemAnnouncement}
            onUpdateAnnouncement={(msg) => {
              setSystemAnnouncement(msg);
              localStorage.setItem('flashgen_announcement', msg);
              showToast('Platform announcement updated.');
            }}
          />
        )}
      </main>

      {/* Card Editor Modal */}
      {editingDeck && (
        <CardEditorModal
          deck={editingDeck}
          isOpen={!!editingDeck}
          onClose={() => setEditingDeck(null)}
          onSaveDeck={(updated) => {
            handleUpdateDeck(updated);
            setEditingDeck(null);
            showToast('Deck updated.');
          }}
        />
      )}

      {/* Auth Modal with Remember Me and Switcher */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={async (user) => {
          setIsAuthModalOpen(false);
          setCurrentUser(user);
          if (user) {
            try {
              const [accountDecks, accountStats, accountPages] = await Promise.all([
                loadAccountDecks(user.uid),
                loadAccountStats(user.uid),
                loadAccountStudyPages(user.uid),
              ]);
              setDecks(accountDecks);
              setStats(accountStats);
              if (accountPages && accountPages.length > 0) {
                setStudyPages(accountPages);
              }
            } catch (err) {
              console.warn(err);
            }
          }
          if (isUserManager(user)) {
            showToast(`Welcome back, Manager ${user.email}! 🛡️`);
          } else {
            showToast(`Welcome ${user.displayName || user.email}!`);
          }
        }}
      />

      {/* Account Switcher Modal */}
      <AccountSwitcherModal
        isOpen={isAccountSwitcherOpen}
        onClose={() => setIsAccountSwitcherOpen(false)}
        currentUser={currentUser}
        onSelectAccount={async (user) => {
          setCurrentUser(user);
          try {
            const [accountDecks, accountStats, accountPages] = await Promise.all([
              loadAccountDecks(user.uid),
              loadAccountStats(user.uid),
              loadAccountStudyPages(user.uid),
            ]);
            setDecks(accountDecks);
            setStats(accountStats);
            if (accountPages && accountPages.length > 0) {
              setStudyPages(accountPages);
            }
          } catch (err) {
            console.warn(err);
          }
          if (isUserManager(user)) {
            showToast(`Switched to Master Manager account (${user.email}) 🛡️`);
          } else {
            showToast(`Switched to account: ${user.displayName || user.email}`);
          }
        }}
        onOpenSignIn={() => setIsAuthModalOpen(true)}
        onSwitchToGuest={handleSignOut}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-3.5 py-2 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium shadow-md border border-neutral-800 dark:border-neutral-200 flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
