import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Code2,
  Coins,
  ExternalLink,
  FileArchive,
  FileCode,
  FolderKanban,
  Gift,
  Globe,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PlusCircle,
  Search,
  Settings,
  Shield,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  AdminDashboardTab,
  AppNotification,
  CoinTransaction,
  CoinWallet,
  DomainRecord,
  Language,
  PlatformSettings,
  StarterTemplateId,
  StorageObject,
  UserDashboardTab,
  UserProfile,
  Website,
} from './types';
import { t } from './i18n/translations';
import {
  ALLOWED_EXTENSIONS,
  getExtension,
  normalizeSlug,
  STARTER_TEMPLATES,
  TemplateFileSeed,
  validateAndExtractZipArchive,
  validateSafeFilePath,
} from './lib/templates';
import {
  addCustomDomainToWebsite,
  claimDailyCoinReward,
  createWebsiteProject,
  DEFAULT_PLATFORM_SETTINGS,
  deleteWebsiteProject,
  ensureUserInitialized,
  getDraftFilesForWebsite,
  redeemPromotionalCode,
  unpublishWebsite,
  upgradeUserStorageWithCoins,
  verifyCustomDomainRecord,
} from './services/platformService';
import { PublicLanding } from './components/PublicLanding';
import { AuthModal } from './components/AuthModal';
import { OnlineEditorView } from './components/OnlineEditorView';
import { PublishModal } from './components/PublishModal';
import { AdminConsoleView } from './components/AdminConsoleView';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('ph_lang');
    return saved === 'bn' ? 'bn' : 'en';
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ph_theme') === 'dark';
  });

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<CoinWallet | null>(null);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

  const [websites, setWebsites] = useState<Website[]>([]);
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [showPublicLanding, setShowPublicLanding] = useState<boolean>(true);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<'user' | 'admin'>('user');
  const [activeUserTab, setActiveUserTab] = useState<UserDashboardTab>('overview');
  const [activeAdminTab, setActiveAdminTab] = useState<AdminDashboardTab>('admin-overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Selected website for Editor / File Manager / Publish Modal
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('');
  const [draftFiles, setDraftFiles] = useState<StorageObject[]>([]);
  const [publishModalWebsite, setPublishModalWebsite] = useState<Website | null>(null);

  // Create Website Form State
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteSlug, setNewSiteSlug] = useState('');
  const [newSiteDesc, setNewSiteDesc] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<StarterTemplateId>('portfolio');
  const [creatingSite, setCreatingSite] = useState(false);

  // Upload Website State
  const [uploadSiteName, setUploadSiteName] = useState('');
  const [uploadSiteSlug, setUploadSiteSlug] = useState('');
  const [extractedUploadFiles, setExtractedUploadFiles] = useState<TemplateFileSeed[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadInspecting, setUploadInspecting] = useState(false);

  // Custom Domain State
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [customDomainWebsiteId, setCustomDomainWebsiteId] = useState('');

  // Redeem Code Input State
  const [promoCodeInput, setPromoCodeInput] = useState('');

  // Profile Edit State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editTwoFactor, setEditTwoFactor] = useState(false);

  // Banner Feedback
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('ph_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('ph_theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (u) {
        try {
          const { profile: p, wallet: w } = await ensureUserInitialized(u);
          setProfile(p);
          setWallet(w);
          setEditDisplayName(p.displayName);
          setEditPhotoUrl(p.photoURL || '');
          setEditTwoFactor(Boolean(p.twoFactorEnabled));
          setShowPublicLanding(false);
        } catch (err) {
          console.error('Failed to initialize user profile:', err);
        }
      } else {
        setProfile(null);
        setWallet(null);
        setWebsites([]);
        setDomains([]);
        setTransactions([]);
        setNotifications([]);
        setShowPublicLanding(true);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listeners once authenticated
  useEffect(() => {
    const settingsUnsub = onSnapshot(
      doc(db, 'platform_settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as PlatformSettings);
        }
      },
      () => {}
    );

    if (!firebaseUser || !authReady) {
      return () => settingsUnsub();
    }

    const uid = firebaseUser.uid;

    const userUnsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) setProfile(snap.data() as UserProfile);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    const walletUnsub = onSnapshot(
      doc(db, 'coin_wallets', uid),
      (snap) => {
        if (snap.exists()) setWallet(snap.data() as CoinWallet);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `coin_wallets/${uid}`)
    );

    const sitesUnsub = onSnapshot(
      query(collection(db, 'websites'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Website)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setWebsites(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'websites')
    );

    const domainsUnsub = onSnapshot(
      query(collection(db, 'domains'), where('userId', '==', uid)),
      (snap) => {
        setDomains(snap.docs.map((d) => d.data() as DomainRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'domains')
    );

    const txUnsub = onSnapshot(
      query(collection(db, 'coin_transactions'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as CoinTransaction)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'coin_transactions')
    );

    const notifUnsub = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as AppNotification)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    return () => {
      settingsUnsub();
      userUnsub();
      walletUnsub();
      sitesUnsub();
      domainsUnsub();
      txUnsub();
      notifUnsub();
    };
  }, [firebaseUser, authReady]);

  const selectedWebsite = useMemo(
    () => websites.find((w) => w.id === selectedWebsiteId) || websites[0] || null,
    [websites, selectedWebsiteId]
  );

  const refreshDraftFiles = async (targetSite?: Website | null) => {
    const site = targetSite ?? selectedWebsite;
    if (!profile || !site) {
      setDraftFiles([]);
      return;
    }
    try {
      const files = await getDraftFilesForWebsite(profile.uid, site.id);
      setDraftFiles(files);
    } catch (err) {
      console.error('Error loading draft files:', err);
    }
  };

  useEffect(() => {
    if (selectedWebsite && profile) {
      setSelectedWebsiteId(selectedWebsite.id);
      refreshDraftFiles(selectedWebsite);
    } else {
      setDraftFiles([]);
    }
  }, [selectedWebsite?.id, profile?.uid]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // Handlers
  const handleCreateWebsiteFromTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setToast(null);
    const tpl = STARTER_TEMPLATES.find((t) => t.id === selectedTemplateId) || STARTER_TEMPLATES[0];
    setCreatingSite(true);
    try {
      const created = await createWebsiteProject(profile, {
        name: newSiteName.trim(),
        slug: newSiteSlug.trim() || newSiteName.trim(),
        description: newSiteDesc.trim() || `${tpl.name} hosted on Prachurjo Host`,
        visibility: 'PUBLIC',
        entryFile: 'index.html',
        files: tpl.files,
      });
      setNewSiteName('');
      setNewSiteSlug('');
      setNewSiteDesc('');
      setSelectedWebsiteId(created.id);
      await refreshDraftFiles(created);
      setToast({
        type: 'ok',
        text: `Website "${created.name}" created! You can now edit files or publish to ${created.primaryHostname}.`,
      });
      setActiveUserTab('editor');
    } catch (err: any) {
      setToast({ type: 'err', text: err?.message || 'Could not create website.' });
    } finally {
      setCreatingSite(false);
    }
  };

  const handleInspectUploadedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErrors([]);
    setExtractedUploadFiles([]);
    setUploadInspecting(true);

    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const res = await validateAndExtractZipArchive(file, settings.uploadSizeLimitMb || 10);
        setExtractedUploadFiles(res.files);
        setUploadErrors(res.errors);
        if (!uploadSiteName) {
          const base = file.name.replace(/\.zip$/i, '');
          setUploadSiteName(base);
          setUploadSiteSlug(normalizeSlug(base));
        }
      } else {
        const check = validateSafeFilePath(file.name);
        if (!check.valid) {
          setUploadErrors([check.error || 'Unsupported file type.']);
        } else {
          const text = await file.text();
          const ext = getExtension(check.normalizedPath);
          const targetName = ext === '.html' || ext === '.htm' ? 'index.html' : check.normalizedPath;
          setExtractedUploadFiles([
            {
              fileName: targetName,
              mimeType: ALLOWED_EXTENSIONS[ext] || 'text/html; charset=utf-8',
              content: text,
            },
          ]);
          if (!uploadSiteName) {
            const base = file.name.replace(/\.[^.]+$/, '');
            setUploadSiteName(base);
            setUploadSiteSlug(normalizeSlug(base));
          }
        }
      }
    } catch (err: any) {
      setUploadErrors([err?.message || 'Failed to inspect uploaded file.']);
    } finally {
      setUploadInspecting(false);
      e.target.value = '';
    }
  };

  const handleConfirmUploadWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || extractedUploadFiles.length === 0 || uploadErrors.length > 0) return;
    setCreatingSite(true);
    setToast(null);
    try {
      const created = await createWebsiteProject(profile, {
        name: uploadSiteName.trim(),
        slug: uploadSiteSlug.trim() || uploadSiteName.trim(),
        description: 'Uploaded static website bundle',
        visibility: 'PUBLIC',
        entryFile:
          extractedUploadFiles.find((f) => f.fileName === 'index.html')?.fileName ||
          extractedUploadFiles.find((f) => f.fileName.endsWith('.html'))?.fileName ||
          'index.html',
        files: extractedUploadFiles,
      });
      setUploadSiteName('');
      setUploadSiteSlug('');
      setExtractedUploadFiles([]);
      setSelectedWebsiteId(created.id);
      await refreshDraftFiles(created);
      setToast({
        type: 'ok',
        text: `Uploaded "${created.name}" (${extractedUploadFiles.length} files verified).`,
      });
      setActiveUserTab('editor');
    } catch (err: any) {
      setToast({ type: 'err', text: err?.message || 'Upload creation failed.' });
    } finally {
      setCreatingSite(false);
    }
  };

  const handleClaimDaily = async () => {
    if (!profile) return;
    setToast(null);
    try {
      const res = await claimDailyCoinReward(profile.uid);
      setToast({
        type: 'ok',
        text: `Claimed +${res.rewardAmount} daily reward coins! New balance: ${res.newBalance} coins.`,
      });
    } catch (err: any) {
      setToast({ type: 'err', text: err?.message || 'Could not claim daily reward.' });
    }
  };

  const handleRedeemCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !promoCodeInput.trim()) return;
    setToast(null);
    try {
      const res = await redeemPromotionalCode(profile.uid, promoCodeInput);
      setPromoCodeInput('');
      setToast({
        type: 'ok',
        text: `Promotional code "${res.code}" redeemed! +${res.coinAmount} coins added to your wallet.`,
      });
    } catch (err: any) {
      setToast({ type: 'err', text: err?.message || 'Redemption failed.' });
    }
  };

  const handleAddCustomDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const targetSite =
      websites.find((w) => w.id === customDomainWebsiteId) || selectedWebsite || websites[0];
    if (!targetSite) {
      setToast({ type: 'err', text: 'Create a website first before attaching a custom domain.' });
      return;
    }
    try {
      const rec = await addCustomDomainToWebsite(profile, targetSite, customDomainInput);
      setCustomDomainInput('');
      setToast({
        type: 'ok',
        text: `Added ${rec.hostname}. Configure the DNS TXT token to verify ownership.`,
      });
    } catch (err: any) {
      setToast({ type: 'err', text: err?.message || 'Could not add custom domain.' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: editDisplayName.trim().slice(0, 80) || profile.username,
        photoURL: editPhotoUrl.trim().slice(0, 500),
        twoFactorEnabled: editTwoFactor,
        updatedAt: serverTimestamp(),
      });
      setToast({ type: 'ok', text: 'Account profile settings updated.' });
    } catch (err: any) {
      setToast({ type: 'err', text: err?.message || 'Could not update profile.' });
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    await batch.commit();
  };

  // Show Public Landing Page when unauthenticated or when user clicks "Public Site"
  if (!firebaseUser || showPublicLanding || !profile || !wallet) {
    return (
      <div className={darkMode ? 'dark bg-[#0B0F19] text-slate-100' : 'bg-[#F2F5FF] text-[#172033]'}>
        <PublicLanding
          lang={lang}
          setLang={setLang}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          settings={settings}
          isAuthenticated={Boolean(firebaseUser && profile)}
          onOpenAuth={(mode) => setAuthModalMode(mode)}
          onEnterDashboard={() => setShowPublicLanding(false)}
        />
        {authModalMode && (
          <AuthModal
            initialMode={authModalMode}
            lang={lang}
            registrationEnabled={settings.registrationEnabled}
            onClose={() => setAuthModalMode(null)}
            onSuccess={async (prefUser) => {
              setAuthModalMode(null);
              if (auth.currentUser) {
                const { profile: p, wallet: w } = await ensureUserInitialized(
                  auth.currentUser,
                  prefUser
                );
                setProfile(p);
                setWallet(w);
                setShowPublicLanding(false);
              }
            }}
          />
        )}
      </div>
    );
  }

  // Suspended Account Gate
  if (profile.status === 'SUSPENDED') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F2F5FF] dark:bg-[#0B0F19]">
        <div className="glass-panel rounded-2xl max-w-md w-full p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-[#DC2626] mx-auto" />
          <h1 className="text-xl font-bold text-[#172033] dark:text-white">
            Account Suspended
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-300">
            Your Prachurjo Host account (@{profile.username}) has been suspended by a platform administrator.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#4169F5] rounded-xl cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const userNavItems: { id: UserDashboardTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t(lang, 'overview'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'websites', label: t(lang, 'myWebsites'), icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'create', label: t(lang, 'createWebsite'), icon: <PlusCircle className="w-4 h-4" /> },
    { id: 'upload', label: t(lang, 'uploadWebsite'), icon: <Upload className="w-4 h-4" /> },
    { id: 'editor', label: t(lang, 'onlineEditor'), icon: <Code2 className="w-4 h-4" /> },
    { id: 'domains', label: t(lang, 'domains'), icon: <Globe className="w-4 h-4" /> },
    { id: 'files', label: t(lang, 'fileManager'), icon: <FileCode className="w-4 h-4" /> },
    { id: 'wallet', label: t(lang, 'coinWallet'), icon: <Coins className="w-4 h-4" /> },
    { id: 'redeem', label: t(lang, 'redeemCodes'), icon: <Gift className="w-4 h-4" /> },
    { id: 'storage', label: t(lang, 'storage'), icon: <HardDrive className="w-4 h-4" /> },
    { id: 'notifications', label: t(lang, 'notifications'), icon: <Bell className="w-4 h-4" /> },
    { id: 'activity', label: t(lang, 'activityHistory'), icon: <Activity className="w-4 h-4" /> },
    { id: 'profile', label: t(lang, 'profile'), icon: <UserIcon className="w-4 h-4" /> },
    { id: 'settings', label: t(lang, 'settings'), icon: <Settings className="w-4 h-4" /> },
    { id: 'help', label: t(lang, 'helpSupport'), icon: <HelpCircle className="w-4 h-4" /> },
  ];

  const adminNavItems: { id: AdminDashboardTab; label: string }[] = [
    { id: 'admin-overview', label: t(lang, 'adminOverview') },
    { id: 'admin-users', label: t(lang, 'adminUsers') },
    { id: 'admin-websites', label: t(lang, 'adminWebsites') },
    { id: 'admin-domains', label: t(lang, 'adminDomains') },
    { id: 'admin-coins', label: t(lang, 'adminCoins') },
    { id: 'admin-redeem', label: t(lang, 'adminRedeem') },
    { id: 'admin-storage', label: t(lang, 'adminStorage') },
    { id: 'admin-reports', label: t(lang, 'adminReports') },
    { id: 'admin-audit', label: t(lang, 'adminAudit') },
    { id: 'admin-settings', label: t(lang, 'adminSettings') },
  ];

  const publishedCount = websites.filter((w) => w.status === 'PUBLISHED').length;
  const draftCount = websites.filter((w) => w.status === 'DRAFT').length;
  const storageRemainingBytes = Math.max(0, profile.storageQuotaBytes - profile.storageUsedBytes);

  return (
    <div
      className={`min-h-screen flex ${
        darkMode ? 'dark bg-[#0B0F19] text-slate-100' : 'bg-[#F2F5FF] text-[#172033]'
      }`}
    >
      {/* Desktop Sidebar (260px fixed) */}
      <aside className="hidden lg:flex flex-col w-[264px] shrink-0 glass-panel border-r border-white/80 dark:border-slate-800/80 p-4 justify-between">
        <div className="space-y-5 overflow-y-auto pr-1">
          <div className="flex items-center justify-between px-2 pt-1">
            <button
              onClick={() => setShowPublicLanding(true)}
              className="text-lg font-bold font-display text-[#172033] dark:text-white tracking-tight cursor-pointer"
            >
              {t(lang, 'brandName')}
            </button>
            <span className="text-[11px] font-mono text-[#4169F5] font-semibold">
              {profile.role}
            </span>
          </div>

          {/* Role Mode Switcher if Admin */}
          {profile.role === 'ADMIN' && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
              <button
                onClick={() => setWorkspaceMode('user')}
                className={`py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                  workspaceMode === 'user'
                    ? 'bg-white dark:bg-slate-900 text-[#172033] dark:text-white shadow-2xs'
                    : 'text-[#64748B]'
                }`}
              >
                User View
              </button>
              <button
                onClick={() => setWorkspaceMode('admin')}
                className={`py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                  workspaceMode === 'admin'
                    ? 'bg-[#4169F5] text-white shadow-2xs'
                    : 'text-[#64748B]'
                }`}
              >
                Admin Console
              </button>
            </div>
          )}

          {/* Navigation List */}
          <nav className="space-y-1">
            {workspaceMode === 'user'
              ? userNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveUserTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeUserTab === item.id
                        ? 'bg-[#4169F5] text-white shadow-xs'
                        : 'text-[#64748B] dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-[#172033] dark:hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded-md ${
                          activeUserTab === 'notifications'
                            ? 'bg-white text-[#4169F5]'
                            : 'bg-[#4169F5]/15 text-[#4169F5]'
                        }`}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))
              : adminNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveAdminTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeAdminTab === item.id
                        ? 'bg-[#4169F5] text-white shadow-xs'
                        : 'text-[#64748B] dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <Shield className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
          </nav>
        </div>

        {/* Bottom Coin Wallet & Sign Out Summary */}
        <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800 space-y-3">
          <div className="p-3 rounded-xl bg-[#4169F5]/10 border border-[#4169F5]/20 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Available Coins</div>
              <div className="text-base font-bold font-mono text-[#4169F5] tabular-nums">
                {wallet.balance} Coins
              </div>
            </div>
            <button
              onClick={handleClaimDaily}
              title="Claim 24h Daily Reward"
              className="px-2.5 py-1.5 text-[11px] font-semibold bg-[#4169F5] text-white rounded-lg hover:bg-[#3156d8] cursor-pointer"
            >
              +{settings.dailyRewardCoins} Daily
            </button>
          </div>

          <div className="flex items-center justify-between px-1 text-xs">
            <div className="truncate">
              <div className="font-semibold text-[#172033] dark:text-white truncate">
                @{profile.username}
              </div>
              <div className="text-[11px] text-[#64748B] truncate">{profile.email}</div>
            </div>
            <button
              onClick={() => signOut(auth)}
              title="Sign Out"
              className="p-2 rounded-lg text-[#64748B] hover:text-[#DC2626] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Slide-Out Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-950/50 backdrop-blur-xs flex">
          <div className="w-72 glass-panel h-full p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold font-display text-lg">{t(lang, 'brandName')}</span>
                <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {profile.role === 'ADMIN' && (
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
                  <button
                    onClick={() => setWorkspaceMode('user')}
                    className={`py-1.5 text-xs font-semibold rounded-lg ${
                      workspaceMode === 'user' ? 'bg-white text-[#172033]' : 'text-[#64748B]'
                    }`}
                  >
                    User
                  </button>
                  <button
                    onClick={() => setWorkspaceMode('admin')}
                    className={`py-1.5 text-xs font-semibold rounded-lg ${
                      workspaceMode === 'admin' ? 'bg-[#4169F5] text-white' : 'text-[#64748B]'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              )}
              <nav className="space-y-1">
                {workspaceMode === 'user'
                  ? userNavItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveUserTab(item.id);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                          activeUserTab === item.id
                            ? 'bg-[#4169F5] text-white'
                            : 'text-[#64748B] dark:text-slate-300'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    ))
                  : adminNavItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveAdminTab(item.id);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                          activeAdminTab === item.id
                            ? 'bg-[#4169F5] text-white'
                            : 'text-[#64748B] dark:text-slate-300'
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    ))}
              </nav>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#DC2626]/10 text-[#DC2626] text-xs font-semibold"
            >
              {t(lang, 'signOut')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-20 glass-panel border-b border-white/80 dark:border-slate-800/80 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-2">
              <span className="font-semibold text-[#172033] dark:text-white">
                {workspaceMode === 'admin' ? t(lang, 'adminPanel') : t(lang, 'userWorkspace')}
              </span>
              <span>/</span>
              <span className="capitalize">
                {workspaceMode === 'admin' ? activeAdminTab.replace('admin-', '') : activeUserTab}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="hidden md:block relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (workspaceMode === 'user' && activeUserTab !== 'websites') {
                    setActiveUserTab('websites');
                  }
                }}
                placeholder="Search websites or domains..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 w-52"
              />
            </div>

            {/* Instant Language Switcher */}
            <button
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap"
            >
              {lang === 'en' ? 'বাংলা' : 'EN'}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => {
                setWorkspaceMode('user');
                setActiveUserTab('notifications');
              }}
              className="relative p-2 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[10px] font-mono font-bold bg-[#4169F5] text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Public Site Link */}
            <button
              onClick={() => setShowPublicLanding(true)}
              className="hidden sm:inline-flex px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#172033] dark:hover:text-white cursor-pointer whitespace-nowrap"
            >
              Landing Page
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 max-w-[1320px] w-full mx-auto space-y-6">
          {toast && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between ${
                toast.type === 'ok'
                  ? 'bg-[#16A34A]/12 text-[#16A34A] border border-[#16A34A]/30'
                  : 'bg-[#DC2626]/12 text-[#DC2626] border border-[#DC2626]/30'
              }`}
            >
              <span className="flex items-center gap-2">
                {toast.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                {toast.text}
              </span>
              <button onClick={() => setToast(null)} className="underline ml-4 cursor-pointer">
                Close
              </button>
            </div>
          )}

          {/* ADMIN WORKSPACE */}
          {workspaceMode === 'admin' && profile.role === 'ADMIN' ? (
            <AdminConsoleView
              adminProfile={profile}
              activeTab={activeAdminTab}
              settings={settings}
              onSettingsUpdated={(s) => setSettings(s)}
            />
          ) : (
            <>
              {/* 1. OVERVIEW */}
              {activeUserTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold font-display text-[#172033] dark:text-white">
                        Welcome back, {profile.displayName} (@{profile.username})
                      </h1>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                        Multi-Tenant Hosting Workspace · Real-time database metrics
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setActiveUserTab('create')}
                        className="px-4 py-2.5 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        {t(lang, 'createWebsite')}
                      </button>
                      <button
                        onClick={() => setActiveUserTab('upload')}
                        className="px-4 py-2.5 text-xs font-semibold text-[#172033] dark:text-white glass-panel rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-[#4169F5]" />
                        {t(lang, 'uploadWebsite')}
                      </button>
                    </div>
                  </div>

                  {/* 6 Required Real Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">{t(lang, 'totalWebsites')}</div>
                      <div className="text-2xl font-bold font-display tabular-nums mt-1">
                        {websites.length}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1">
                        Quota: {settings.maxWebsitesPerUser} sites
                      </div>
                    </div>
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">{t(lang, 'publishedWebsites')}</div>
                      <div className="text-2xl font-bold font-display text-[#16A34A] tabular-nums mt-1">
                        {publishedCount}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1">Live on edge router</div>
                    </div>
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">{t(lang, 'draftWebsites')}</div>
                      <div className="text-2xl font-bold font-display tabular-nums mt-1">
                        {draftCount}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1">Private staging</div>
                    </div>
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">{t(lang, 'availableCoins')}</div>
                      <div className="text-2xl font-bold font-display text-[#4169F5] tabular-nums mt-1">
                        {wallet.balance}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
                        Earned: {wallet.totalEarned} · Spent: {wallet.totalSpent}
                      </div>
                    </div>
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">{t(lang, 'storageUsed')}</div>
                      <div className="text-2xl font-bold font-display tabular-nums mt-1">
                        {(profile.storageUsedBytes / 1024).toFixed(1)} KB
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1">Static files & assets</div>
                    </div>
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">{t(lang, 'storageRemaining')}</div>
                      <div className="text-2xl font-bold font-display tabular-nums mt-1">
                        {(storageRemainingBytes / 1024 / 1024).toFixed(1)} MB
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1">Available quota</div>
                    </div>
                  </div>

                  {/* Websites + Recent Ledger Activity Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-[#172033] dark:text-white">
                          Your Hosted Websites
                        </h2>
                        <button
                          onClick={() => setActiveUserTab('websites')}
                          className="text-xs font-semibold text-[#4169F5] hover:underline cursor-pointer"
                        >
                          View All →
                        </button>
                      </div>

                      {websites.length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                          <p className="text-sm font-semibold mb-1">No websites created yet</p>
                          <p className="text-xs text-[#64748B] mb-4">
                            Launch a starter template or upload a ZIP bundle to publish your first site.
                          </p>
                          <button
                            onClick={() => setActiveUserTab('create')}
                            className="px-4 py-2 text-xs font-semibold text-white bg-[#4169F5] rounded-xl cursor-pointer"
                          >
                            Create First Website
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {websites.slice(0, 4).map((site) => (
                            <div
                              key={site.id}
                              className="p-4 rounded-xl bg-white/75 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-[#172033] dark:text-white">
                                    {site.name}
                                  </span>
                                  <span className="text-xs text-[#64748B]">·</span>
                                  <span
                                    className={`text-xs font-mono font-semibold ${
                                      site.status === 'PUBLISHED'
                                        ? 'text-[#16A34A]'
                                        : site.status === 'SUSPENDED'
                                        ? 'text-[#DC2626]'
                                        : 'text-amber-600'
                                    }`}
                                  >
                                    {site.status}
                                  </span>
                                </div>
                                <div className="text-xs font-mono text-[#64748B] mt-1">
                                  {site.primaryHostname} · {(site.storageBytes / 1024).toFixed(1)} KB
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedWebsiteId(site.id);
                                    setActiveUserTab('editor');
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                                >
                                  Edit Code
                                </button>
                                <button
                                  onClick={async () => {
                                    setSelectedWebsiteId(site.id);
                                    const files = await getDraftFilesForWebsite(profile.uid, site.id);
                                    setDraftFiles(files);
                                    setPublishModalWebsite(site);
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#4169F5] rounded-lg cursor-pointer"
                                >
                                  Publish
                                </button>
                                {site.status === 'PUBLISHED' && (
                                  <a
                                    href={`/sites/${site.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-[#4169F5] hover:underline"
                                    title="Open Public Website"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Activity & Coin Ledger */}
                    <div className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-[#172033] dark:text-white">
                          Recent Coin & Deployment Activity
                        </h2>
                        <button
                          onClick={handleClaimDaily}
                          className="text-xs font-semibold text-[#16A34A] hover:underline cursor-pointer"
                        >
                          Claim +{settings.dailyRewardCoins} Daily Reward
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {transactions.slice(0, 5).map((tx) => (
                          <div
                            key={tx.id}
                            className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="truncate pr-3">
                              <div className="font-semibold text-[#172033] dark:text-white truncate">
                                {tx.description}
                              </div>
                              <div className="font-mono text-[11px] text-[#64748B]">
                                {tx.transactionType}
                              </div>
                            </div>
                            <div
                              className={`font-mono font-bold tabular-nums shrink-0 ${
                                tx.amount >= 0 ? 'text-[#16A34A]' : 'text-[#172033] dark:text-slate-200'
                              }`}
                            >
                              {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} C
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. MY WEBSITES */}
              {activeUserTab === 'websites' && (
                <div className="glass-panel rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-[#172033] dark:text-white">
                        My Hosted Websites ({websites.length})
                      </h2>
                      <p className="text-xs text-[#64748B]">
                        Manage drafts, open the Online Editor, configure domains, or publish live snapshots.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveUserTab('create')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#4169F5] rounded-xl cursor-pointer"
                    >
                      + New Website
                    </button>
                  </div>

                  {websites.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[#64748B]">
                      No websites match your filter. Click &ldquo;+ New Website&rdquo; to create one.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                            <th className="py-3 px-3">Project Name</th>
                            <th className="py-3 px-3">Configured Hostname & Route</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3 text-right">Version</th>
                            <th className="py-3 px-3 text-right">Storage</th>
                            <th className="py-3 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                          {websites
                            .filter(
                              (w) =>
                                !globalSearch ||
                                w.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
                                w.slug.toLowerCase().includes(globalSearch.toLowerCase())
                            )
                            .map((site) => (
                              <tr key={site.id}>
                                <td className="py-3.5 px-3">
                                  <div className="font-bold text-sm text-[#172033] dark:text-white">
                                    {site.name}
                                  </div>
                                  <div className="text-[#64748B] truncate max-w-xs">
                                    {site.description}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 font-mono">
                                  <div>{site.primaryHostname}</div>
                                  {site.status === 'PUBLISHED' && (
                                    <a
                                      href={`/sites/${site.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#4169F5] hover:underline inline-flex items-center gap-1"
                                    >
                                      /sites/{site.slug} <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </td>
                                <td className="py-3.5 px-3 font-mono font-semibold">
                                  <span
                                    className={
                                      site.status === 'PUBLISHED'
                                        ? 'text-[#16A34A]'
                                        : site.status === 'SUSPENDED'
                                        ? 'text-[#DC2626]'
                                        : 'text-amber-600'
                                    }
                                  >
                                    {site.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                                  v{site.currentVersionNumber || 0}
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                                  {(site.storageBytes / 1024).toFixed(1)} KB
                                </td>
                                <td className="py-3.5 px-3 text-right space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedWebsiteId(site.id);
                                      setActiveUserTab('editor');
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                                  >
                                    Editor
                                  </button>
                                  <button
                                    onClick={async () => {
                                      setSelectedWebsiteId(site.id);
                                      const files = await getDraftFilesForWebsite(
                                        profile.uid,
                                        site.id
                                      );
                                      setDraftFiles(files);
                                      setPublishModalWebsite(site);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#4169F5] text-white font-semibold cursor-pointer"
                                  >
                                    Publish
                                  </button>
                                  {site.status === 'PUBLISHED' && (
                                    <button
                                      onClick={async () => {
                                        await unpublishWebsite(site);
                                        setToast({
                                          type: 'ok',
                                          text: `Unpublished ${site.name} back to DRAFT.`,
                                        });
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 font-semibold cursor-pointer"
                                    >
                                      Unpublish
                                    </button>
                                  )}
                                  <button
                                    onClick={async () => {
                                      await deleteWebsiteProject(profile, site);
                                      setToast({
                                        type: 'ok',
                                        text: `Deleted website "${site.name}".`,
                                      });
                                    }}
                                    className="p-1.5 text-[#DC2626] hover:bg-[#DC2626]/10 rounded-lg cursor-pointer"
                                    title="Delete Website"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 3. CREATE WEBSITE (STARTER TEMPLATES) */}
              {activeUserTab === 'create' && (
                <div className="glass-panel rounded-2xl p-6 lg:p-8 space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-[#4169F5] mb-1">
                      INSTANT PROJECT INITIALIZER
                    </div>
                    <h2 className="text-xl font-bold font-display text-[#172033] dark:text-white">
                      Create Website from Starter Template
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Choose from Blank HTML5, Personal Portfolio, SaaS Landing Page, or Creator Link-in-Bio.
                    </p>
                  </div>

                  <form onSubmit={handleCreateWebsiteFromTemplate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {STARTER_TEMPLATES.map((tpl) => {
                        const active = selectedTemplateId === tpl.id;
                        return (
                          <div
                            key={tpl.id}
                            onClick={() => setSelectedTemplateId(tpl.id)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                              active
                                ? 'border-[#4169F5] bg-[#4169F5]/8 dark:bg-[#4169F5]/15'
                                : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-[#4169F5]/50'
                            }`}
                          >
                            <div className="text-[11px] font-mono text-[#4169F5] font-semibold mb-1">
                              {tpl.category}
                            </div>
                            <div className="font-bold text-sm text-[#172033] dark:text-white mb-1">
                              {lang === 'bn' ? tpl.nameBn : tpl.name}
                            </div>
                            <p className="text-xs text-[#64748B] leading-relaxed">
                              {tpl.description}
                            </p>
                            <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] font-mono text-[#64748B]">
                              {tpl.files.map((f) => f.fileName).join(' · ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Website Name</label>
                        <input
                          type="text"
                          required
                          value={newSiteName}
                          onChange={(e) => {
                            setNewSiteName(e.target.value);
                            if (!newSiteSlug) {
                              setNewSiteSlug(normalizeSlug(e.target.value));
                            }
                          }}
                          placeholder="My Portfolio Site"
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1.5">
                          Initial Address Slug
                        </label>
                        <div className="flex items-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <input
                            type="text"
                            required
                            value={newSiteSlug}
                            onChange={(e) =>
                              setNewSiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                            }
                            placeholder="my-portfolio"
                            className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-transparent focus:outline-none"
                          />
                          <span className="px-3 py-2.5 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-[#64748B]">
                            .prachurjohost.com
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Project Description
                      </label>
                      <input
                        type="text"
                        value={newSiteDesc}
                        onChange={(e) => setNewSiteDesc(e.target.value)}
                        placeholder="Personal software engineering portfolio and project notes"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={creatingSite}
                      className="px-6 py-3 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl cursor-pointer"
                    >
                      {creatingSite ? 'Initializing Project...' : 'Create Draft & Open in Online Editor'}
                    </button>
                  </form>
                </div>
              )}

              {/* 4. UPLOAD WEBSITE (HTML OR ZIP ARCHIVE) */}
              {activeUserTab === 'upload' && (
                <div className="glass-panel rounded-2xl p-6 lg:p-8 space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-[#4169F5] mb-1">
                      SECURITY-VALIDATED ARCHIVE UPLOADER
                    </div>
                    <h2 className="text-xl font-bold font-display text-[#172033] dark:text-white">
                      Upload HTML File or ZIP Website Archive
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Archives are inspected before extraction for path traversal, prohibited server scripts (.php, .sh, .py), file count caps, and required <code>index.html</code> entry point.
                    </p>
                  </div>

                  <label className="block border-2 border-dashed border-[#4169F5]/40 hover:border-[#4169F5] rounded-2xl p-10 text-center cursor-pointer transition-colors bg-white/50 dark:bg-slate-900/40">
                    <FileArchive className="w-10 h-10 text-[#4169F5] mx-auto mb-3" />
                    <div className="text-sm font-bold text-[#172033] dark:text-white mb-1">
                      {uploadInspecting
                        ? 'Inspecting archive structure & security rules...'
                        : 'Click to select a .zip archive or .html file'}
                    </div>
                    <div className="text-xs text-[#64748B]">
                      Maximum archive size: {settings.uploadSizeLimitMb} MB · Up to 40 static files
                    </div>
                    <input
                      type="file"
                      accept=".zip,.html,.htm"
                      onChange={handleInspectUploadedFile}
                      className="hidden"
                    />
                  </label>

                  {uploadErrors.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 space-y-1 text-xs text-[#DC2626]">
                      <div className="font-bold">Security Validation Rejected Archive:</div>
                      {uploadErrors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}

                  {extractedUploadFiles.length > 0 && uploadErrors.length === 0 && (
                    <form onSubmit={handleConfirmUploadWebsite} className="space-y-4">
                      <div className="p-4 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/30 text-xs text-[#16A34A]">
                        <strong>Validation Passed:</strong> {extractedUploadFiles.length} static file(s) verified and ready for staging.
                        <div className="font-mono mt-1 text-[#172033] dark:text-slate-200">
                          {extractedUploadFiles.map((f) => f.fileName).join(' · ')}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold mb-1">Website Name</label>
                          <input
                            type="text"
                            required
                            value={uploadSiteName}
                            onChange={(e) => setUploadSiteName(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Requested Slug</label>
                          <input
                            type="text"
                            required
                            value={uploadSiteSlug}
                            onChange={(e) =>
                              setUploadSiteSlug(
                                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                              )
                            }
                            className="w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={creatingSite}
                        className="px-6 py-3 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl cursor-pointer"
                      >
                        {creatingSite ? 'Creating Website...' : 'Import Verified Files into Workspace'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* 5 & 7. ONLINE EDITOR & FILE MANAGER */}
              {(activeUserTab === 'editor' || activeUserTab === 'files') && (
                <OnlineEditorView
                  profile={profile}
                  websites={websites}
                  selectedWebsite={selectedWebsite}
                  onSelectWebsite={(w) => setSelectedWebsiteId(w.id)}
                  draftFiles={draftFiles}
                  onRefreshDraftFiles={() => refreshDraftFiles(selectedWebsite)}
                  onOpenPublishModal={(w) => setPublishModalWebsite(w)}
                  onCreateNewWebsiteTrigger={() => setActiveUserTab('create')}
                />
              )}

              {/* 6. DOMAINS */}
              {activeUserTab === 'domains' && (
                <div className="space-y-6">
                  <div className="glass-panel rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-[#172033] dark:text-white">
                      Subdomains & Custom Domain Verification
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Every website receives a verified <code>*.prachurjohost.com</code> subdomain and <code>/sites/:slug</code> route. You can also bind custom domains and verify ownership via DNS TXT records.
                    </p>

                    <form onSubmit={handleAddCustomDomain} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select
                        value={customDomainWebsiteId || selectedWebsite?.id || ''}
                        onChange={(e) => setCustomDomainWebsiteId(e.target.value)}
                        className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      >
                        {websites.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.slug})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        value={customDomainInput}
                        onChange={(e) => setCustomDomainInput(e.target.value)}
                        placeholder="docs.yourdomain.com"
                        className="px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#4169F5] rounded-xl cursor-pointer"
                      >
                        Add Custom Domain
                      </button>
                    </form>
                  </div>

                  <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-sm font-bold mb-3">Configured Domains ({domains.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                            <th className="py-2.5 px-3">Hostname</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">DNS TXT Verification Token</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                          {domains.map((dom) => (
                            <tr key={dom.id}>
                              <td className="py-3 px-3 font-mono font-semibold">{dom.hostname}</td>
                              <td className="py-3 px-3 font-mono">{dom.domainType}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`font-semibold ${
                                    dom.verificationStatus === 'VERIFIED'
                                      ? 'text-[#16A34A]'
                                      : 'text-amber-600'
                                  }`}
                                >
                                  {dom.verificationStatus}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-[#64748B]">
                                {dom.verificationToken}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {dom.verificationStatus !== 'VERIFIED' && (
                                  <button
                                    onClick={async () => {
                                      await verifyCustomDomainRecord(dom);
                                      setToast({
                                        type: 'ok',
                                        text: `Domain ${dom.hostname} verified!`,
                                      });
                                    }}
                                    className="px-3 py-1 rounded-lg bg-[#16A34A] text-white font-semibold cursor-pointer"
                                  >
                                    Verify DNS Now
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 8 & 12. COIN WALLET & ACTIVITY HISTORY */}
              {(activeUserTab === 'wallet' || activeUserTab === 'activity') && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">Current Coin Balance</div>
                      <div className="text-3xl font-bold font-display text-[#4169F5] tabular-nums mt-1">
                        {wallet.balance}
                      </div>
                    </div>
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">Total Coins Earned</div>
                      <div className="text-3xl font-bold font-display text-[#16A34A] tabular-nums mt-1">
                        +{wallet.totalEarned}
                      </div>
                    </div>
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="text-xs text-[#64748B]">Total Coins Spent</div>
                      <div className="text-3xl font-bold font-display tabular-nums mt-1">
                        {wallet.totalSpent}
                      </div>
                    </div>
                    <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
                      <div className="text-xs text-[#64748B]">Daily Login Bonus</div>
                      <button
                        onClick={handleClaimDaily}
                        className="mt-2 w-full py-2.5 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl cursor-pointer"
                      >
                        Claim +{settings.dailyRewardCoins} Daily Coins
                      </button>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-base font-bold mb-4">
                      Immutable Coin Transaction Ledger ({transactions.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                            <th className="py-2.5 px-3">Transaction Type</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3">Idempotency Key</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-right">Balance After</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                          {transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td className="py-2.5 px-3 font-mono font-semibold text-[#4169F5]">
                                {tx.transactionType}
                              </td>
                              <td className="py-2.5 px-3">{tx.description}</td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748B]">
                                {tx.idempotencyKey}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                                  tx.amount >= 0 ? 'text-[#16A34A]' : 'text-[#172033] dark:text-white'
                                }`}
                              >
                                {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                {tx.balanceAfter}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. REDEEM CODES */}
              {activeUserTab === 'redeem' && (
                <div className="glass-panel rounded-2xl p-6 lg:p-8 max-w-xl space-y-5">
                  <div>
                    <div className="text-xs font-semibold text-[#4169F5] mb-1">
                      PROMOTIONAL COIN VOUCHERS
                    </div>
                    <h2 className="text-xl font-bold font-display">Redeem Promotional Code</h2>
                    <p className="text-xs text-[#64748B]">
                      Enter an administrator-issued promotional code to credit bonus coins to your wallet atomically.
                    </p>
                  </div>

                  <form onSubmit={handleRedeemCodeSubmit} className="space-y-4">
                    <input
                      type="text"
                      required
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      placeholder="ENTER-PROMO-CODE"
                      className="w-full px-4 py-3 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl cursor-pointer"
                    >
                      Verify & Redeem Code
                    </button>
                  </form>
                </div>
              )}

              {/* 10. STORAGE */}
              {activeUserTab === 'storage' && (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">Account Storage Quota & Upgrade</h2>
                      <p className="text-xs text-[#64748B] tabular-nums">
                        Using {(profile.storageUsedBytes / 1024).toFixed(1)} KB of{' '}
                        {(profile.storageQuotaBytes / 1024 / 1024).toFixed(1)} MB total allocation
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const res = await upgradeUserStorageWithCoins(profile);
                          setToast({
                            type: 'ok',
                            text: `Upgraded storage quota by +50 MB (-${res.cost} coins)!`,
                          });
                        } catch (err: any) {
                          setToast({ type: 'err', text: err?.message || 'Storage upgrade failed.' });
                        }
                      }}
                      className="px-4 py-2.5 text-xs font-semibold text-white bg-[#4169F5] rounded-xl cursor-pointer"
                    >
                      Upgrade +50 MB ({settings.storageUpgradePriceCoins} Coins)
                    </button>
                  </div>

                  <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#4169F5]"
                      style={{
                        width: `${Math.min(
                          100,
                          (profile.storageUsedBytes / Math.max(1, profile.storageQuotaBytes)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 11. NOTIFICATIONS */}
              {activeUserTab === 'notifications' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">
                      In-App Notifications ({notifications.length})
                    </h2>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllNotificationsRead}
                        className="text-xs font-semibold text-[#4169F5] hover:underline cursor-pointer"
                      >
                        Mark all {unreadCount} as read
                      </button>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 rounded-xl border flex items-start justify-between gap-4 text-xs ${
                          n.isRead
                            ? 'bg-white/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800'
                            : 'bg-[#4169F5]/8 border-[#4169F5]/30'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-[#172033] dark:text-white">
                            {n.title}
                          </div>
                          <div className="text-[#64748B] mt-0.5">{n.message}</div>
                        </div>
                        {!n.isRead && (
                          <button
                            onClick={() => updateDoc(doc(db, 'notifications', n.id), { isRead: true })}
                            className="text-[#4169F5] font-semibold shrink-0 cursor-pointer"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 13 & 14. PROFILE & SETTINGS */}
              {(activeUserTab === 'profile' || activeUserTab === 'settings') && (
                <form
                  onSubmit={handleSaveProfile}
                  className="glass-panel rounded-2xl p-6 lg:p-8 max-w-xl space-y-4"
                >
                  <h2 className="text-lg font-bold">Account Profile & Security Preferences</h2>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Username (Immutable Handle)</label>
                    <input
                      type="text"
                      disabled
                      value={`@${profile.username}`}
                      className="w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-slate-100 dark:bg-slate-800 text-[#64748B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Profile Image URL</label>
                    <input
                      type="url"
                      value={editPhotoUrl}
                      onChange={(e) => setEditPhotoUrl(e.target.value)}
                      placeholder="https://example.com/avatar.png"
                      className="w-full px-3.5 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={editTwoFactor}
                      onChange={(e) => setEditTwoFactor(e.target.checked)}
                    />
                    Enable Two-Factor Verification Prompt on Sensitive Actions
                  </label>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4169F5] rounded-xl cursor-pointer"
                  >
                    Save Account Settings
                  </button>
                </form>
              )}

              {/* 15. HELP & SUPPORT */}
              {activeUserTab === 'help' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-lg font-bold">Prachurjo Host — Documentation & Support</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
                    <div className="p-4 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div className="font-bold text-sm text-[#172033] dark:text-white mb-1">
                        Packaging ZIP Archives
                      </div>
                      Ensure your archive contains an <code>index.html</code> file at the root level. Relative links to <code>styles.css</code> and <code>app.js</code> are automatically resolved.
                    </div>
                    <div className="p-4 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div className="font-bold text-sm text-[#172033] dark:text-white mb-1">
                        Accessing Published Websites
                      </div>
                      Every published website is immediately live at <code>/sites/&lt;slug&gt;</code> and maps incoming requests for <code>&lt;slug&gt;.prachurjohost.com</code> when wildcard DNS is configured.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mandatory Pre-Publish Domain Selection & Cost Modal */}
      {publishModalWebsite && (
        <PublishModal
          profile={profile}
          wallet={wallet}
          settings={settings}
          website={publishModalWebsite}
          draftFiles={draftFiles}
          onClose={() => setPublishModalWebsite(null)}
          onPublishedSuccess={(updated) => {
            setSelectedWebsiteId(updated.id);
          }}
        />
      )}
    </div>
  );
}
