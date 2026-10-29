import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { AlertCircle, CheckCircle2, Lock, Mail, User as UserIcon, X } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { Language } from '../types';
import { t } from '../i18n/translations';

interface AuthModalProps {
  initialMode: 'login' | 'register' | 'reset';
  lang: Language;
  registrationEnabled: boolean;
  onClose: () => void;
  onSuccess: (preferredUsername?: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode,
  lang,
  registrationEnabled,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess(username || undefined);
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (mode === 'reset') {
      if (!email.includes('@')) {
        setError('Enter a valid email address to receive a password reset link.');
        return;
      }
      setLoading(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        setInfoMessage('Password reset instructions have been sent to your email address.');
      } catch (err: any) {
        setError(err?.message || 'Failed to send password reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      if (!registrationEnabled) {
        setError('New account registration is currently disabled by the administrator.');
        return;
      }
      const cleanUsername = username.toLowerCase().trim();
      if (!/^[a-z0-9_-]{3,28}$/.test(cleanUsername)) {
        setError('Username must be 3–28 characters using lowercase letters, numbers, underscores, or hyphens.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      setLoading(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: cleanUsername });
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Non-fatal if verification email rate-limited
        }
        onSuccess(cleanUsername);
      } catch (err: any) {
        if (err?.code === 'auth/operation-not-allowed') {
          setError(
            'Email/Password provider is not yet enabled in your Firebase Console. Use "Continue with Google" below, or enable Email/Password under Firebase Console → Authentication → Sign-in method.'
          );
        } else {
          setError(err?.message || 'Registration failed.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Login mode
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onSuccess();
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password sign-in is not enabled in the Firebase project. Please sign in with Google below.'
        );
      } else {
        setError(err?.message || 'Invalid credentials or account not found.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl max-w-md w-full p-6 lg:p-8 relative">
        <button
          onClick={onClose}
          aria-label="Close authentication modal"
          className="absolute top-5 right-5 p-2 rounded-lg text-[#64748B] hover:text-[#172033] dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <div className="text-xs font-semibold text-[#4169F5] mb-1">PRACHURJO HOST ACCOUNT</div>
          <h2 className="text-2xl font-bold font-display text-[#172033] dark:text-white">
            {mode === 'login' && t(lang, 'login')}
            {mode === 'register' && t(lang, 'register')}
            {mode === 'reset' && 'Reset Account Password'}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
            One unified login routes USER accounts to the Hosting Workspace and ADMIN accounts to the Governance Console.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-xs text-[#DC2626] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/30 text-xs text-[#16A34A] flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {mode !== 'reset' && (
          <div className="mb-5">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#4169F5] text-sm font-semibold text-[#172033] dark:text-white flex items-center justify-center gap-3 transition-colors shadow-2xs cursor-pointer"
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
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{t(lang, 'googleSignIn')}</span>
            </button>

            <div className="relative my-5 flex items-center justify-center">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="px-3 text-xs text-[#64748B] bg-transparent whitespace-nowrap">
                or with email
              </span>
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            </div>
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="prachurjo_dev"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-white font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-white"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#172033] dark:text-slate-200">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('reset');
                    }}
                    className="text-xs text-[#4169F5] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-white"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#4169F5] hover:bg-[#3156d8] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {loading
              ? 'Processing...'
              : mode === 'login'
              ? t(lang, 'login')
              : mode === 'register'
              ? t(lang, 'register')
              : 'Send Password Reset Link'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs text-[#64748B]">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('register');
                }}
                className="text-[#4169F5] font-semibold hover:underline cursor-pointer"
              >
                Create free account
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className="text-[#4169F5] font-semibold hover:underline cursor-pointer"
              >
                Log in to your account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
