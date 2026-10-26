import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Users,
  Trash2,
  KeyRound,
  Shield,
  Clock
} from 'lucide-react';
import { 
  signInWithGoogle, 
  auth, 
  db, 
  isUserManager, 
  MANAGER_EMAIL 
} from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { 
  getRememberedAccounts, 
  saveRememberedAccount, 
  removeRememberedAccount 
} from '../utils/storage';
import { RememberedAccount } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'switch'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);

  // Load remembered accounts when opening
  useEffect(() => {
    if (isOpen) {
      const accounts = getRememberedAccounts();
      setRememberedAccounts(accounts);
      if (accounts.length > 0 && mode !== 'signup') {
        setMode('switch');
      }
    }
  }, [isOpen]);

  // Automatically close modal as soon as authentication state becomes signed-in
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        onClose();
      }
    });
    return () => unsub();
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRememberAccount = (user: User, pass?: string, isGoogle: boolean = false) => {
    if (!rememberMe) return;
    const isMgr = user.email?.trim().toLowerCase() === MANAGER_EMAIL.toLowerCase();
    saveRememberedAccount({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Learner',
      photoURL: user.photoURL || undefined,
      role: isMgr ? 'manager' : 'user',
      lastUsed: new Date().toISOString(),
      isGoogle,
      savedPassword: rememberPassword && pass ? pass : undefined,
    });
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      handleRememberAccount(user, undefined, true);
      onClose();
      onAuthSuccess?.(user);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        if (displayName.trim()) {
          await updateProfile(user, { displayName: displayName.trim() });
        }

        // Save profile
        const isMgr = email.trim().toLowerCase() === MANAGER_EMAIL.toLowerCase();
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: displayName.trim() || user.email?.split('@')[0],
          photoURL: '',
          role: isMgr ? 'manager' : 'user',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });

        handleRememberAccount(user, password, false);
        onClose();
        onAuthSuccess?.(user);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        handleRememberAccount(userCredential.user, password, false);
        onClose();
        onAuthSuccess?.(userCredential.user);
      }
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || 'Authentication error.';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        msg = 'Invalid email or password.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (msg.includes('auth/weak-password')) {
        msg = 'Password should be at least 6 characters.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 1-Click switch to remembered account
  const handleSelectRememberedAccount = async (account: RememberedAccount) => {
    setLoading(true);
    setError(null);
    try {
      if (account.savedPassword) {
        // Fast instant switch with saved password
        const userCredential = await signInWithEmailAndPassword(auth, account.email, account.savedPassword);
        handleRememberAccount(userCredential.user, account.savedPassword, !!account.isGoogle);
        onClose();
        onAuthSuccess?.(userCredential.user);
        return;
      }

      if (account.isGoogle) {
        // Trigger Google Auth
        const user = await signInWithGoogle();
        handleRememberAccount(user, undefined, true);
        onClose();
        onAuthSuccess?.(user);
        return;
      }

      // Pre-populate email and prompt password
      setEmail(account.email);
      setMode('signin');
      setError('Please enter password to switch to this account.');
    } catch (err: any) {
      console.error('Account switch error:', err);
      // Fallback: fill email and show error
      setEmail(account.email);
      setMode('signin');
      setError('Saved credentials expired or changed. Please enter password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccount = (e: React.MouseEvent, accEmail: string) => {
    e.stopPropagation();
    const updated = removeRememberedAccount(accEmail);
    setRememberedAccounts(updated);
    if (updated.length === 0 && mode === 'switch') {
      setMode('signin');
    }
  };

  const formatLastUsed = (isoStr: string) => {
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch (e) {
      return 'Recently';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white mx-auto mb-3 shadow-md shadow-indigo-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
            {mode === 'switch' 
              ? 'Switch Saved Account' 
              : mode === 'signin' 
              ? 'Welcome Back to FlashGen AI' 
              : 'Create Your Study Account'}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {mode === 'switch'
              ? 'Click any saved profile below to switch instantly without re-typing credentials.'
              : 'Save decks to the cloud, create Turbo AI Study Pages, and track your streaks.'}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl mb-5">
          {rememberedAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMode('switch');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'switch'
                  ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Saved ({rememberedAccounts.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* REMEMBERED ACCOUNTS SWITCHER VIEW */}
        {mode === 'switch' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="font-semibold">Select Account to Switch:</span>
              <span className="text-[11px] text-indigo-500">Fast 1-Click Login</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {rememberedAccounts.map((acc) => {
                const isMgr = acc.email.toLowerCase() === MANAGER_EMAIL.toLowerCase();
                const isCurrent = auth.currentUser?.email?.toLowerCase() === acc.email.toLowerCase();

                return (
                  <div
                    key={acc.email}
                    onClick={() => handleSelectRememberedAccount(acc)}
                    className={`w-full p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between group ${
                      isCurrent
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                        : isMgr
                        ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {acc.photoURL ? (
                        <img
                          src={acc.photoURL}
                          alt={acc.displayName}
                          className="w-9 h-9 rounded-xl object-cover ring-1 ring-neutral-300 dark:ring-neutral-700 shrink-0"
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center text-white shrink-0 ${
                          isMgr 
                            ? 'bg-gradient-to-tr from-amber-600 to-yellow-500' 
                            : 'bg-gradient-to-tr from-indigo-600 to-violet-600'
                        }`}>
                          {acc.displayName ? acc.displayName[0].toUpperCase() : 'U'}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                            {acc.displayName || acc.email.split('@')[0]}
                          </span>
                          {isMgr && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5" />
                              Manager
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate font-mono">
                          {acc.email}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {formatLastUsed(acc.lastUsed)}
                          </span>
                          {acc.savedPassword && (
                            <span className="flex items-center gap-0.5 text-indigo-500 font-medium">
                              <KeyRound className="w-2.5 h-2.5" />
                              Auto-Sign In
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleRemoveAccount(e, acc.email)}
                        className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Forget this account on this device"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setEmail('');
                  setPassword('');
                  setError(null);
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>+ Sign in to another account</span>
              </button>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                Google Login
              </button>
            </div>
          </div>
        )}

        {/* REGULAR SIGN IN / SIGN UP FORM */}
        {mode !== 'switch' && (
          <div>
            {/* One-Click Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-100 font-semibold text-xs flex items-center justify-center gap-2.5 shadow-xs transition-all mb-4 hover:scale-[1.01]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
              </div>
              <span className="relative bg-white dark:bg-neutral-900 px-3 text-[11px] text-neutral-400 uppercase tracking-wider">
                or with email
              </span>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Rivera"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                {email.trim().toLowerCase() === MANAGER_EMAIL.toLowerCase() && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Authorized Manager Email Detected</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* REMEMBER ME CHECKBOXES */}
              <div className="pt-1 pb-1 space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Remember this account on this device</span>
                </label>

                {rememberMe && (
                  <label className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 cursor-pointer select-none pl-5">
                    <input
                      type="checkbox"
                      checked={rememberPassword}
                      onChange={(e) => setRememberPassword(e.target.checked)}
                      className="w-3 h-3 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Remember password for 1-click switching</span>
                  </label>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>{loading ? 'Processing...' : mode === 'signin' ? 'Sign In & Remember' : 'Create Free Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
