import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Layers, 
  Flame, 
  Sun, 
  Moon, 
  PlusCircle, 
  HelpCircle,
  Shield,
  User as UserIcon,
  LogOut,
  ChevronDown,
  CheckCircle2,
  BookOpen,
  Users,
  Repeat
} from 'lucide-react';
import { User } from 'firebase/auth';
import { UserStudyStats, RememberedAccount } from '../types';
import { isUserManager, MANAGER_EMAIL } from '../firebase';
import { getRememberedAccounts } from '../utils/storage';

interface NavbarProps {
  currentView: 'dashboard' | 'generate' | 'study' | 'quiz' | 'test' | 'manager' | 'studypages';
  onNavigate: (view: 'dashboard' | 'generate' | 'study' | 'quiz' | 'test' | 'manager' | 'studypages') => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  stats: UserStudyStats;
  onOpenShortcuts: () => void;
  activeDeckTitle?: string;
  currentUser: User | null;
  onOpenAuthModal: () => void;
  onOpenAccountSwitcher: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  darkMode,
  onToggleTheme,
  stats,
  onOpenShortcuts,
  activeDeckTitle,
  currentUser,
  onOpenAuthModal,
  onOpenAccountSwitcher,
  onSignOut,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isManager = isUserManager(currentUser);

  useEffect(() => {
    setRememberedAccounts(getRememberedAccounts());
  }, [currentUser, isUserMenuOpen]);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors duration-150 border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center space-x-2.5 text-left group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 flex items-center justify-center shadow-xs transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-neutral-900 dark:text-white">
                FlashGen
              </span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900">
                PRO
              </span>
            </div>
          </button>

          {activeDeckTitle && (currentView === 'study' || currentView === 'quiz' || currentView === 'test') && (
            <div className="hidden md:flex items-center text-xs text-neutral-500 dark:text-neutral-400 pl-3 border-l border-neutral-200 dark:border-neutral-800">
              <span className="truncate max-w-[200px] font-medium text-neutral-700 dark:text-neutral-300">{activeDeckTitle}</span>
              <span className="mx-2 text-neutral-300 dark:text-neutral-700">/</span>
              <span className="capitalize font-semibold text-neutral-900 dark:text-neutral-100">
                {currentView === 'study' ? 'Spaced Repetition' : currentView === 'quiz' ? 'Quiz' : 'Topic Test'}
              </span>
            </div>
          )}
        </div>

        {/* Center Nav tabs */}
        <nav className="flex items-center space-x-1">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentView === 'dashboard'
                ? 'bg-neutral-100 dark:bg-neutral-850 text-neutral-900 dark:text-white font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Decks
            </span>
          </button>

          {/* Study Pages Tab */}
          <button
            onClick={() => onNavigate('studypages')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentView === 'studypages'
                ? 'bg-neutral-100 dark:bg-neutral-850 text-neutral-900 dark:text-white font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Study Pages</span>
            </span>
          </button>

          <button
            onClick={() => onNavigate('test')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentView === 'test'
                ? 'bg-neutral-100 dark:bg-neutral-850 text-neutral-900 dark:text-white font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              Topic Tests
            </span>
          </button>

          <button
            onClick={() => onNavigate('generate')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              currentView === 'generate'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Generate Cards</span>
          </button>

          {/* Manager Quick Tab - Strictly visible only if m4len1as@gmail.com */}
          {isManager && (
            <button
              onClick={() => onNavigate('manager')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                currentView === 'manager'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
              title="Restricted Manager Console"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Manager</span>
            </button>
          )}
        </nav>

        {/* Right side items */}
        <div className="flex items-center space-x-2">
          {/* Streak indicator */}
          <div 
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
            title={`${stats.streak} day study streak`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{stats.streak}d streak</span>
          </div>

          {/* Keyboard shortcuts helper */}
          <button
            onClick={onOpenShortcuts}
            className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Keyboard shortcuts (Press ?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-neutral-300" /> : <Moon className="w-4 h-4 text-neutral-700" />}
          </button>

          {/* User Account / Switcher / Sign-In Button */}
          {currentUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-850 transition-colors"
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-6 h-6 rounded-md object-cover border border-neutral-200 dark:border-neutral-700"
                  />
                ) : (
                  <div className={`w-6 h-6 rounded-md text-white font-semibold text-xs flex items-center justify-center ${
                    isManager ? 'bg-amber-600' : 'bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900'
                  }`}>
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-9 w-60 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg py-1.5 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="font-semibold text-neutral-900 dark:text-white truncate">
                      {currentUser.displayName || 'Learner'}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate font-mono">
                      {currentUser.email}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Cloud Sync Active</span>
                    </div>
                    {isManager && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        <Shield className="w-3 h-3" />
                        <span>Master Manager</span>
                      </div>
                    )}
                  </div>

                  {/* Switch Account Quick Action */}
                  <div className="py-1 border-b border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAccountSwitcher();
                      }}
                      className="w-full text-left px-3 py-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Repeat className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Switch Account</span>
                      </div>
                      {rememberedAccounts.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                          {rememberedAccounts.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Manager Panel Link - Strictly shown only to m4len1as@gmail.com */}
                  {isManager && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('manager');
                      }}
                      className="w-full text-left px-3 py-1.5 text-amber-700 dark:text-amber-400 font-medium hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Manager Console</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {rememberedAccounts.length > 0 && (
                <button
                  onClick={onOpenAccountSwitcher}
                  className="px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1"
                  title="Switch saved account"
                >
                  <Users className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="hidden sm:inline">Accounts ({rememberedAccounts.length})</span>
                </button>
              )}
              <button
                onClick={onOpenAuthModal}
                className="px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
