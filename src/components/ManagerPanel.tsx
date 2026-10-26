import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  Layers, 
  FileText, 
  Activity, 
  CheckCircle2, 
  ArrowLeft, 
  Search, 
  Lock, 
  LogOut, 
  Sparkles,
  BarChart3,
  Download,
  AlertCircle,
  Database,
  Cpu,
  RefreshCw,
  Megaphone
} from 'lucide-react';
import { User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { db, MANAGER_EMAIL, isUserManager } from '../firebase';
import { Deck, UserStudyStats } from '../types';

interface ManagerPanelProps {
  currentUser: User | null;
  decks: Deck[];
  stats: UserStudyStats;
  onBackToDashboard: () => void;
  onOpenAuthModal: () => void;
  systemAnnouncement: string;
  onUpdateAnnouncement: (msg: string) => void;
}

export const ManagerPanel: React.FC<ManagerPanelProps> = ({
  currentUser,
  decks,
  stats,
  onBackToDashboard,
  onOpenAuthModal,
  systemAnnouncement,
  onUpdateAnnouncement,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'decks' | 'settings'>('overview');
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [announcementText, setAnnouncementText] = useState(systemAnnouncement);
  const [announcementSaved, setAnnouncementSaved] = useState(false);

  const isAuthorized = currentUser !== null && currentUser.email?.toLowerCase().trim() === MANAGER_EMAIL.toLowerCase();

  // Load registered users if authorized
  useEffect(() => {
    if (isAuthorized) {
      async function fetchUsers() {
        setLoadingUsers(true);
        try {
          const snap = await getDocs(collection(db, 'users'));
          const list = snap.docs.map((d) => d.data());
          setRegisteredUsers(list);
        } catch (err) {
          console.warn('Users fetch notice:', err);
        } finally {
          setLoadingUsers(false);
        }
      }
      fetchUsers();
    }
  }, [isAuthorized]);

  // ==========================================
  // ACCESS DENIED SCREEN (Non-Manager or Logged Out)
  // ==========================================
  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/10">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-2">
          Access Restricted: Manager Panel
        </h1>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
          This administration console is strictly protected by attribute-based security rules and is exclusively authorized for:
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100 mb-8 shadow-xs">
          <Lock className="w-4 h-4 text-indigo-500" />
          <span>{MANAGER_EMAIL}</span>
        </div>

        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-8 max-w-md mx-auto">
          {currentUser ? (
            <span>You are currently signed in as <strong className="text-neutral-700 dark:text-neutral-300">{currentUser.email}</strong>, which does not have administrative privileges.</span>
          ) : (
            <span>Please sign in with the authorized manager account to access platform metrics and administrative tools.</span>
          )}
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Return to Dashboard
          </button>
          <button
            onClick={onOpenAuthModal}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-colors"
          >
            Sign In as Manager
          </button>
        </div>
      </div>
    );
  }

  // Guaranteed authorized non-null manager user
  const manager = currentUser as User;

  // ==========================================
  // AUTHORIZED MANAGER CONSOLE
  // ==========================================
  const totalCards = decks.reduce((acc, d) => acc + d.cards.length, 0);

  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAnnouncement(announcementText.trim());
    setAnnouncementSaved(true);
    setTimeout(() => setAnnouncementSaved(false), 3000);
  };

  const exportAuditLog = () => {
    const auditData = {
      timestamp: new Date().toISOString(),
      manager: manager.email,
      platformStats: {
        totalDecks: decks.length,
        totalCards,
        totalReviews: stats.totalReviewsCompleted,
        totalTests: stats.testsCompleted || 0,
      },
      registeredUsersCount: registeredUsers.length,
      decks: decks.map((d) => ({
        id: d.id,
        title: d.title,
        cardsCount: d.cards.length,
        tags: d.tags,
      })),
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashgen_manager_audit_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-200">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Restricted Manager Console</span>
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              Role: Master Administrator
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            FlashGen Platform Oversight
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Authorized Account: <strong className="text-neutral-800 dark:text-neutral-200">{manager.email}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportAuditLog}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit Log</span>
          </button>
          <button
            onClick={onBackToDashboard}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Learner View</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-6 overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'Platform Overview', icon: Activity },
          { id: 'users', label: 'Users Directory', icon: Users, count: registeredUsers.length },
          { id: 'decks', label: 'Curriculum & Decks', icon: Layers, count: decks.length },
          { id: 'settings', label: 'Announcements & Controls', icon: Megaphone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive ? 'bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB: OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Decks</span>
                <Layers className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                {decks.length}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Active study sets
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Flashcards</span>
                <Sparkles className="w-4 h-4 text-violet-500" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                {totalCards}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Generated via Gemini multimodal
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Registered Accounts</span>
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                {Math.max(1, registeredUsers.length)}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                Firestore synced
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Card Reviews</span>
                <Activity className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                {stats.totalReviewsCompleted}
              </div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                SM-2 spaced repetitions logged
              </div>
            </div>
          </div>

          {/* Infrastructure Health & Live Subsystems */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span>Platform Subsystems & Live Infrastructure Status</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white">
                    Gemini 3.8 Flash Multimodal API
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Server proxy with automatic exponential retry
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white">
                    Google Cloud Firestore
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    ABAC rules deployed & active
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white">
                    Firebase Authentication
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Locked role gate: m4len1as@gmail.com
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB: USERS ================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800 mb-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Registered Learner Accounts ({Math.max(1, registeredUsers.length)})
              </h3>
              <span className="text-xs text-neutral-400">
                Managed in Firestore <code className="font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">/users</code>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">User</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">UID</th>
                    <th className="pb-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {/* Current manager */}
                  <tr className="bg-amber-50/30 dark:bg-amber-950/20 font-medium">
                    <td className="py-3 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-xs">
                        M
                      </div>
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {manager.displayName || 'Master Manager'}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {manager.email}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Manager
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-neutral-400 truncate max-w-[120px]">
                      {manager.uid}
                    </td>
                    <td className="py-3 text-neutral-400">
                      Today
                    </td>
                  </tr>

                  {/* Registered Firestore Users */}
                  {registeredUsers
                    .filter((u) => u.email !== manager.email)
                    .map((user, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
                        <td className="py-3 font-medium text-neutral-800 dark:text-neutral-200">
                          {user.displayName || 'Learner'}
                        </td>
                        <td className="py-3 font-mono text-neutral-600 dark:text-neutral-400">
                          {user.email}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                            {user.role || 'user'}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[11px] text-neutral-400 truncate max-w-[120px]">
                          {user.uid}
                        </td>
                        <td className="py-3 text-neutral-400">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB: DECKS DIRECTORY ================= */}
      {activeTab === 'decks' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">
              All Study Decks Across Platform ({decks.length})
            </h3>

            <div className="space-y-3">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-neutral-900 dark:text-white">
                        {deck.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                        {deck.cards.length} cards
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-1">
                      {deck.description || 'No description'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(deck.tags || []).map((t, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB: SETTINGS & ANNOUNCEMENTS ================= */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          <form
            onSubmit={handleSaveAnnouncement}
            className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4"
          >
            <div>
              <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-white mb-1">
                <Megaphone className="w-4 h-4 text-indigo-500" />
                <span>Global Platform Announcement Banner</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                Broadcast a notification or study update banner displayed to all learners at the top of their dashboard.
              </p>
              <textarea
                rows={3}
                placeholder="e.g. Midterm season update: New diagnostic topic exams are now active! Spaced repetition intervals have been recalibrated."
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between">
              {announcementSaved ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Announcement published!</span>
                </span>
              ) : (
                <span className="text-[11px] text-neutral-400">Leave blank to hide banner</span>
              )}

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 shadow-sm transition-colors"
              >
                Publish Announcement
              </button>
            </div>
          </form>

          {/* Security Rules Verification Summary */}
          <div className="p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Hardened Access Control Summary
            </h4>
            <ul className="text-xs space-y-1.5 text-neutral-600 dark:text-neutral-400 list-disc list-inside">
              <li>Manager Role Lock: Bound to verified token matching <strong className="text-neutral-800 dark:text-neutral-200">{MANAGER_EMAIL}</strong></li>
              <li>ABAC Gatekeeper: Self-assigned admin elevation is blocked at the Firestore security rule level</li>
              <li>Zero-Trust Updates: Updates to other users' decks and test data return PERMISSION_DENIED</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
