import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  ExternalLink,
  Gift,
  Globe,
  HardDrive,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  AdminAuditLog,
  AdminDashboardTab,
  CoinTransaction,
  DomainRecord,
  PlatformSettings,
  RedeemCode,
  UserProfile,
  Website,
} from '../types';
import {
  adminAdjustUserCoins,
  adminGenerateRedeemCodes,
  adminSavePlatformSettings,
  adminSetUserStatus,
  adminSetWebsiteStatus,
} from '../services/platformService';

interface AdminConsoleViewProps {
  adminProfile: UserProfile;
  activeTab: AdminDashboardTab;
  settings: PlatformSettings;
  onSettingsUpdated: (s: PlatformSettings) => void;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  adminProfile,
  activeTab,
  settings,
  onSettingsUpdated,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [siteSearch, setSiteSearch] = useState('');

  // User Coin Modal State
  const [coinTargetUser, setCoinTargetUser] = useState<UserProfile | null>(null);
  const [coinDelta, setCoinDelta] = useState<number>(50);
  const [coinReason, setCoinReason] = useState<string>('');

  // Settings Form State
  const [formSettings, setFormSettings] = useState<PlatformSettings>(settings);
  const [settingsReason, setSettingsReason] = useState('Routine configuration update');

  // Redeem Code Generator Form
  const [customPromoCode, setCustomPromoCode] = useState('');
  const [batchCount, setBatchCount] = useState(1);
  const [promoCoinAmount, setPromoCoinAmount] = useState(100);
  const [promoMaxUses, setPromoMaxUses] = useState(25);
  const [promoPerUser, setPromoPerUser] = useState(1);
  const [promoExpiry, setPromoExpiry] = useState('2027-12-31');
  const [promoReason, setPromoReason] = useState('Community promotional reward');

  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const [uSnap, wSnap, dSnap, txSnap, rcSnap, alSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'websites')),
        getDocs(collection(db, 'domains')),
        getDocs(collection(db, 'coin_transactions')),
        getDocs(collection(db, 'redeem_codes')),
        getDocs(collection(db, 'admin_audit_logs')),
      ]);

      setUsers(uSnap.docs.map((d) => d.data() as UserProfile));
      setWebsites(wSnap.docs.map((d) => d.data() as Website));
      setDomains(dSnap.docs.map((d) => d.data() as DomainRecord));
      setTransactions(txSnap.docs.map((d) => d.data() as CoinTransaction));
      setRedeemCodes(rcSnap.docs.map((d) => d.data() as RedeemCode));
      setAuditLogs(
        alSnap.docs
          .map((d) => d.data() as AdminAuditLog)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      );
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Could not load administrative telemetry.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAdminData();
  }, []);

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  const totalCoinsIssued = transactions
    .filter((t) => t.amount > 0)
    .reduce((acc, t) => acc + t.amount, 0);
  const totalCoinsSpent = transactions
    .filter((t) => t.amount < 0)
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const totalStorageBytes = websites.reduce((acc, w) => acc + (w.storageBytes || 0), 0);

  const handleAdjustCoinsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coinTargetUser) return;
    setFeedback(null);
    try {
      await adminAdjustUserCoins({
        adminProfile,
        targetUserId: coinTargetUser.uid,
        targetUsername: coinTargetUser.username,
        amount: Number(coinDelta),
        reason: coinReason,
      });
      setFeedback({
        type: 'ok',
        msg: `Successfully adjusted @${coinTargetUser.username} wallet by ${coinDelta > 0 ? '+' : ''}${coinDelta} coins.`,
      });
      setCoinTargetUser(null);
      setCoinReason('');
      await fetchAllAdminData();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Wallet adjustment failed.' });
    }
  };

  const handleToggleUserStatus = async (u: UserProfile) => {
    const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const reason = `Admin console status change to ${nextStatus}`;
    try {
      await adminSetUserStatus(adminProfile, u, nextStatus, reason);
      setFeedback({ type: 'ok', msg: `Updated @${u.username} status to ${nextStatus}.` });
      await fetchAllAdminData();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Status update failed.' });
    }
  };

  const handleWebsiteGovernance = async (
    site: Website,
    status: 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED' | 'DRAFT'
  ) => {
    try {
      await adminSetWebsiteStatus(
        adminProfile,
        site,
        status,
        `Administrative governance action (${status})`
      );
      setFeedback({ type: 'ok', msg: `Website "${site.name}" status set to ${status}.` });
      await fetchAllAdminData();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Could not update website status.' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminSavePlatformSettings(adminProfile, formSettings, settingsReason);
      onSettingsUpdated(formSettings);
      setFeedback({ type: 'ok', msg: 'Platform settings and coin pricing saved.' });
      await fetchAllAdminData();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Failed to update settings.' });
    }
  };

  const handleGeneratePromoCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await adminGenerateRedeemCodes({
        adminProfile,
        customCode: customPromoCode || undefined,
        batchCount,
        coinAmount: promoCoinAmount,
        maxRedemptions: promoMaxUses,
        perUserLimit: promoPerUser,
        expiresAt: `${promoExpiry}T23:59:59.000Z`,
        reason: promoReason,
      });
      setCustomPromoCode('');
      setFeedback({
        type: 'ok',
        msg: `Generated ${created.length} promotional code(s): ${created.map((c) => c.code).join(', ')}`,
      });
      await fetchAllAdminData();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Failed to generate redeem codes.' });
    }
  };

  const handleToggleRedeemCode = async (rc: RedeemCode) => {
    try {
      await updateDoc(doc(db, 'redeem_codes', rc.id), {
        isActive: !rc.isActive,
      });
      await fetchAllAdminData();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Could not toggle code.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#4169F5]">
            SERVER-VERIFIED ADMINISTRATOR GOVERNANCE
          </div>
          <h2 className="text-xl font-bold font-display text-[#172033] dark:text-white">
            Prachurjo Host — Admin Control Center
          </h2>
        </div>
        <button
          onClick={fetchAllAdminData}
          className="px-3.5 py-2 text-xs font-semibold text-[#172033] dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Telemetry
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30'
              : 'bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30'
          }`}
        >
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Admin Overview */}
      {activeTab === 'admin-overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B]">Total Users</div>
              <div className="text-2xl font-bold font-display tabular-nums mt-1">{users.length}</div>
              <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
                {users.filter((u) => u.status === 'ACTIVE').length} Active ·{' '}
                {users.filter((u) => u.status === 'SUSPENDED').length} Suspended
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B]">Total Websites</div>
              <div className="text-2xl font-bold font-display tabular-nums mt-1">
                {websites.length}
              </div>
              <div className="text-[11px] text-[#16A34A] mt-1 tabular-nums">
                {websites.filter((w) => w.status === 'PUBLISHED').length} Published Live
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B]">Total Coins Issued</div>
              <div className="text-2xl font-bold font-display text-[#4169F5] tabular-nums mt-1">
                {totalCoinsIssued}
              </div>
              <div className="text-[11px] text-[#64748B] mt-1">Lifetime economy mint</div>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B]">Total Coins Spent</div>
              <div className="text-2xl font-bold font-display text-[#16A34A] tabular-nums mt-1">
                {totalCoinsSpent}
              </div>
              <div className="text-[11px] text-[#64748B] mt-1">Publishing & upgrades</div>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B]">Storage Consumption</div>
              <div className="text-2xl font-bold font-display tabular-nums mt-1">
                {(totalStorageBytes / 1024).toFixed(1)} KB
              </div>
              <div className="text-[11px] text-[#64748B] mt-1">Across all tenants</div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-base font-bold text-[#172033] dark:text-white mb-4">
              Recent Administrative Audit Events
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-[#64748B]">No administrative actions logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Admin</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {auditLogs.slice(0, 8).map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#4169F5]">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3">{log.adminEmail}</td>
                        <td className="py-2.5 px-3 font-medium">{log.reason}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{log.metadataSummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. User Management */}
      {activeTab === 'admin-users' && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4169F5]" /> Registered Platform Users ({users.length})
            </h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search username or email..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                  <th className="py-3 px-3">Username & Email</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Storage Used</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {users
                  .filter(
                    (u) =>
                      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearch.toLowerCase())
                  )
                  .map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#172033] dark:text-white">
                          @{u.username}
                        </div>
                        <div className="text-[#64748B]">{u.email}</div>
                      </td>
                      <td className="py-3 px-3 font-mono">{u.role}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            u.status === 'ACTIVE' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {(u.storageUsedBytes / 1024).toFixed(1)} KB /{' '}
                        {Math.round(u.storageQuotaBytes / 1024 / 1024)} MB
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setCoinTargetUser(u);
                            setCoinDelta(50);
                            setCoinReason('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#4169F5]/10 text-[#4169F5] font-semibold cursor-pointer"
                        >
                          Grant / Deduct Coins
                        </button>
                        {u.uid !== adminProfile.uid && (
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#172033] dark:text-slate-200 font-semibold cursor-pointer"
                          >
                            {u.status === 'ACTIVE' ? 'Suspend' : 'Restore'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {coinTargetUser && (
            <form
              onSubmit={handleAdjustCoinsSubmit}
              className="p-4 rounded-xl bg-[#4169F5]/8 border border-[#4169F5]/25 space-y-3"
            >
              <div className="text-xs font-bold text-[#172033] dark:text-white">
                Adjust Wallet Balance for @{coinTargetUser.username} ({coinTargetUser.email})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">
                    Coin Delta (+ to credit, - to debit)
                  </label>
                  <input
                    type="number"
                    required
                    value={coinDelta}
                    onChange={(e) => setCoinDelta(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">
                    Mandatory Audit Reason
                  </label>
                  <input
                    type="text"
                    required
                    value={coinReason}
                    onChange={(e) => setCoinReason(e.target.value)}
                    placeholder="e.g. Hackathon winner bonus"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#4169F5] rounded-lg cursor-pointer"
                >
                  Apply Wallet Adjustment
                </button>
                <button
                  type="button"
                  onClick={() => setCoinTargetUser(null)}
                  className="px-3 py-1.5 text-xs text-[#64748B] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 3. Website Governance */}
      {activeTab === 'admin-websites' && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#4169F5]" /> All Tenant Websites ({websites.length})
            </h3>
            <input
              type="text"
              value={siteSearch}
              onChange={(e) => setSiteSearch(e.target.value)}
              placeholder="Search site name or hostname..."
              className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                  <th className="py-3 px-3">Website</th>
                  <th className="py-3 px-3">Hostname & Route</th>
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Size</th>
                  <th className="py-3 px-3 text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {websites
                  .filter(
                    (w) =>
                      w.name.toLowerCase().includes(siteSearch.toLowerCase()) ||
                      w.primaryHostname.toLowerCase().includes(siteSearch.toLowerCase())
                  )
                  .map((w) => (
                    <tr key={w.id}>
                      <td className="py-3 px-3 font-semibold text-[#172033] dark:text-white">
                        {w.name}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div>{w.primaryHostname}</div>
                        <a
                          href={`/sites/${w.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#4169F5] hover:underline inline-flex items-center gap-1"
                        >
                          /sites/{w.slug} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3 px-3 font-mono">@{w.ownerUsername}</td>
                      <td className="py-3 px-3 font-mono font-semibold">{w.status}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {(w.storageBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        {w.status !== 'SUSPENDED' ? (
                          <button
                            onClick={() => handleWebsiteGovernance(w, 'SUSPENDED')}
                            className="px-2.5 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] font-semibold cursor-pointer"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleWebsiteGovernance(w, 'PUBLISHED')}
                            className="px-2.5 py-1 rounded-lg bg-[#16A34A]/10 text-[#16A34A] font-semibold cursor-pointer"
                          >
                            Restore
                          </button>
                        )}
                        <button
                          onClick={() => handleWebsiteGovernance(w, 'ARCHIVED')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#64748B] font-semibold cursor-pointer"
                        >
                          Archive
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Domain Registry */}
      {activeTab === 'admin-domains' && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-[#172033] dark:text-white">
            Tenant Domain Registry ({domains.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                  <th className="py-2.5 px-3">Hostname</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Verification</th>
                  <th className="py-2.5 px-3">DNS Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {domains.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 px-3 font-mono font-semibold">{d.hostname}</td>
                    <td className="py-2.5 px-3 font-mono">{d.domainType}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#16A34A]">
                      {d.verificationStatus}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#64748B]">{d.verificationToken}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5 & 10. Coin Configuration & Platform Settings */}
      {(activeTab === 'admin-coins' || activeTab === 'admin-settings') && (
        <form onSubmit={handleSaveSettings} className="glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#4169F5]" /> Dynamic Coin Pricing & Platform Quotas
              </h3>
              <p className="text-xs text-[#64748B]">
                Price changes take effect immediately for all subsequent transactions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Registration Bonus (Coins)</label>
              <input
                type="number"
                min={0}
                value={formSettings.registrationBonusCoins}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, registrationBonusCoins: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Website Publish Price (Coins)</label>
              <input
                type="number"
                min={0}
                value={formSettings.publishPriceCoins}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, publishPriceCoins: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Daily Login Reward (Coins)</label>
              <input
                type="number"
                min={0}
                value={formSettings.dailyRewardCoins}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, dailyRewardCoins: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Website Rename Price (Coins)</label>
              <input
                type="number"
                min={0}
                value={formSettings.renamePriceCoins}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, renamePriceCoins: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Domain Change Price (Coins)</label>
              <input
                type="number"
                min={0}
                value={formSettings.domainChangePriceCoins}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, domainChangePriceCoins: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Storage Upgrade (+50MB Coins)</label>
              <input
                type="number"
                min={0}
                value={formSettings.storageUpgradePriceCoins}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    storageUpgradePriceCoins: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.registrationEnabled}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, registrationEnabled: e.target.checked })
                }
              />
              Enable New User Registration
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.publishingEnabled}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, publishingEnabled: e.target.checked })
                }
              />
              Enable Website Publishing
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.coinSystemEnabled}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, coinSystemEnabled: e.target.checked })
                }
              />
              Enforce Coin Economy Charges
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Audit Log Reason</label>
            <input
              type="text"
              required
              value={settingsReason}
              onChange={(e) => setSettingsReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl cursor-pointer"
          >
            Save Configuration & Record Audit Entry
          </button>
        </form>
      )}

      {/* 6. Redeem Code Generator */}
      {activeTab === 'admin-redeem' && (
        <div className="space-y-6">
          <form onSubmit={handleGeneratePromoCodes} className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#4169F5]" /> Generate Single or Batch Promotional Codes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Custom Code (Leave blank for batch)
                </label>
                <input
                  type="text"
                  value={customPromoCode}
                  onChange={(e) => setCustomPromoCode(e.target.value.toUpperCase())}
                  placeholder="WELCOME2026"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Batch Count (1–25)</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  disabled={Boolean(customPromoCode)}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Coin Reward Amount</label>
                <input
                  type="number"
                  min={1}
                  value={promoCoinAmount}
                  onChange={(e) => setPromoCoinAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Max Total Redemptions</label>
                <input
                  type="number"
                  min={1}
                  value={promoMaxUses}
                  onChange={(e) => setPromoMaxUses(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Per-User Limit</label>
                <input
                  type="number"
                  min={1}
                  value={promoPerUser}
                  onChange={(e) => setPromoPerUser(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={promoExpiry}
                  onChange={(e) => setPromoExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl cursor-pointer"
            >
              Issue Promotional Code(s)
            </button>
          </form>

          <div className="glass-panel rounded-2xl p-6">
            <h4 className="text-sm font-bold mb-3">Issued Redeem Codes ({redeemCodes.length})</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3 text-right">Reward</th>
                    <th className="py-2.5 px-3 text-right">Redemptions</th>
                    <th className="py-2.5 px-3">Expires</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {redeemCodes.map((rc) => (
                    <tr key={rc.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#4169F5]">{rc.code}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        +{rc.coinAmount} Coins
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {rc.currentRedemptions} / {rc.maxRedemptions}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{rc.expiresAt?.slice(0, 10)}</td>
                      <td className="py-2.5 px-3">
                        <span className={rc.isActive ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                          {rc.isActive ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleToggleRedeemCode(rc)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                        >
                          {rc.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7, 8, 9. Storage, Security Reports, Audit Logs */}
      {(activeTab === 'admin-storage' ||
        activeTab === 'admin-reports' ||
        activeTab === 'admin-audit') && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#4169F5]" /> Immutable Administrative Audit Trail &
            Storage Telemetry ({auditLogs.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Administrator</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Mandatory Reason</th>
                  <th className="py-2.5 px-3">Metadata Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#4169F5]">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3">{log.adminEmail}</td>
                    <td className="py-2.5 px-3 font-mono">
                      {log.targetType}:{log.targetId.slice(0, 12)}
                    </td>
                    <td className="py-2.5 px-3 font-medium">{log.reason}</td>
                    <td className="py-2.5 px-3 text-[#64748B]">{log.metadataSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
