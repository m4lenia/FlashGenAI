import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Shield, 
  Clock, 
  ArrowRight, 
  Trash2, 
  KeyRound, 
  Plus, 
  LogOut,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { User, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, signInWithGoogle, MANAGER_EMAIL } from '../firebase';
import { RememberedAccount } from '../types';
import { getRememberedAccounts, removeRememberedAccount, saveRememberedAccount } from '../utils/storage';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSelectAccount: (user: User) => void;
  onOpenSignIn: () => void;
  onSwitchToGuest: () => void;
}

export const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectAccount,
  onOpenSignIn,
  onSwitchToGuest,
}) => {
  const [accounts, setAccounts] = useState<RememberedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccounts(getRememberedAccounts());
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitch = async (acc: RememberedAccount) => {
    if (currentUser?.email?.toLowerCase() === acc.email.toLowerCase()) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (acc.savedPassword) {
        // Fast 1-click login with saved credentials
        const cred = await signInWithEmailAndPassword(auth, acc.email, acc.savedPassword);
        saveRememberedAccount({
          ...acc,
          lastUsed: new Date().toISOString(),
        });
        onSelectAccount(cred.user);
        onClose();
        return;
      }

      if (acc.isGoogle) {
        const user = await signInWithGoogle();
        saveRememberedAccount({
          ...acc,
          lastUsed: new Date().toISOString(),
        });
        onSelectAccount(user);
        onClose();
        return;
      }

      // If no password saved, open sign-in modal with email pre-filled
      onClose();
      onOpenSignIn();
    } catch (err: any) {
      console.error('Account switcher error:', err);
      setError('Unable to auto-switch. Please enter your password in the sign-in modal.');
      setTimeout(() => {
        onClose();
        onOpenSignIn();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    const updated = removeRememberedAccount(email);
    setAccounts(updated);
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
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              Switch Account
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              1-click switch between remembered profiles on this device
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Accounts List */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {accounts.map((acc) => {
            const isCurrent = currentUser?.email?.toLowerCase() === acc.email.toLowerCase();
            const isMgr = acc.email.toLowerCase() === MANAGER_EMAIL.toLowerCase();

            return (
              <div
                key={acc.email}
                onClick={() => handleSwitch(acc)}
                className={`w-full p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between group ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40'
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
                      className="w-10 h-10 rounded-xl object-cover ring-1 ring-neutral-300 dark:ring-neutral-700 shrink-0"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center text-white shrink-0 ${
                      isMgr 
                        ? 'bg-gradient-to-tr from-amber-600 to-yellow-500' 
                        : 'bg-gradient-to-tr from-indigo-600 to-violet-600'
                    }`}>
                      {acc.displayName ? acc.displayName[0].toUpperCase() : 'U'}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-0.5">
                          <UserCheck className="w-2.5 h-2.5" />
                          Active Now
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate font-mono mt-0.5">
                      {acc.email}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-400">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatLastUsed(acc.lastUsed)}
                      </span>
                      {acc.savedPassword && (
                        <span className="flex items-center gap-0.5 text-indigo-500 font-medium">
                          <KeyRound className="w-2.5 h-2.5" />
                          1-Click Ready
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, acc.email)}
                    className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="Forget account on this device"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}

          {accounts.length === 0 && (
            <div className="p-6 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 text-xs text-neutral-400">
              No remembered accounts yet. Check &quot;Remember this account&quot; when signing in!
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSignIn();
            }}
            className="w-full py-2.5 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sign in to Another Account</span>
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToGuest();
              }}
              className="w-full py-2 text-center text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
            >
              Switch to Guest Mode (Offline Session)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
