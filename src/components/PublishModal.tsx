import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  ExternalLink,
  Globe,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  CoinWallet,
  PlatformSettings,
  StorageObject,
  UserProfile,
  Website,
  WebsiteVisibility,
} from '../types';
import { normalizeSlug } from '../lib/templates';
import {
  checkHostnameAvailability,
  generateId,
  publishWebsiteAtomically,
} from '../services/platformService';

interface PublishModalProps {
  profile: UserProfile;
  wallet: CoinWallet;
  settings: PlatformSettings;
  website: Website;
  draftFiles: StorageObject[];
  onClose: () => void;
  onPublishedSuccess: (updated: Website) => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  profile,
  wallet,
  settings,
  website,
  draftFiles,
  onClose,
  onPublishedSuccess,
}) => {
  const [name, setName] = useState(website.name);
  const [description, setDescription] = useState(website.description);
  const [slug, setSlug] = useState(website.slug);
  const [visibility, setVisibility] = useState<WebsiteVisibility>(website.visibility || 'PUBLIC');
  const [entryFile, setEntryFile] = useState(website.entryFile || 'index.html');

  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(true);
  const [slugReason, setSlugReason] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedResult, setPublishedResult] = useState<{
    publicUrl: string;
    hostname: string;
    versionNumber: number;
    coinsCharged: number;
  } | null>(null);

  const [idempotencyKey] = useState(() => generateId('idem_pub'));

  const htmlFiles = draftFiles.filter((f) => f.fileName.endsWith('.html'));

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      const res = await checkHostnameAvailability(slug, website.id);
      if (!active) return;
      setSlugAvailable(res.available);
      setSlugReason(res.reason || null);
      setCheckingSlug(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [slug, website.id]);

  const cleanSlug = normalizeSlug(slug);
  const isSlugChanged = website.status === 'PUBLISHED' && website.slug !== cleanSlug;
  const isNameChanged = website.status === 'PUBLISHED' && website.name !== name.trim();

  let estimatedCoinCost = settings.coinSystemEnabled ? settings.publishPriceCoins : 0;
  if (settings.coinSystemEnabled) {
    if (isSlugChanged) estimatedCoinCost += settings.domainChangePriceCoins;
    if (isNameChanged) estimatedCoinCost += settings.renamePriceCoins;
  }

  const hasEnoughCoins = wallet.balance >= estimatedCoinCost;

  const handleConfirmPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slugAvailable || !hasEnoughCoins) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishWebsiteAtomically({
        profile,
        website,
        draftFiles,
        desiredName: name,
        desiredDescription: description,
        desiredSlug: cleanSlug,
        desiredVisibility: visibility,
        selectedEntryFile: entryFile,
        idempotencyKey,
      });
      setPublishedResult({
        publicUrl: result.publicUrl,
        hostname: result.updatedWebsite.primaryHostname,
        versionNumber: result.versionNumber,
        coinsCharged: result.coinsCharged,
      });
      onPublishedSuccess(result.updatedWebsite);
    } catch (err: any) {
      setPublishError(err?.message || 'Publishing failed. Any deducted coins have been refunded.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl max-w-xl w-full p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-[#64748B] hover:text-[#172033] dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {publishedResult ? (
          <div className="text-center py-4 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-[#16A34A]/15 text-[#16A34A] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#16A34A] mb-1">
                DEPLOYMENT VERSION v{publishedResult.versionNumber} LIVE
              </div>
              <h3 className="text-2xl font-bold font-display text-[#172033] dark:text-white">
                Website Published Successfully!
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-300 mt-1">
                Your static website bundle has been deployed to the multi-tenant edge router.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Configured Subdomain:</span>
                <span className="font-mono font-semibold text-[#172033] dark:text-white">
                  {publishedResult.hostname}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Direct Public Route:</span>
                <span className="font-mono font-semibold text-[#4169F5]">
                  {publishedResult.publicUrl}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Coins Charged:</span>
                <span className="font-mono font-semibold text-[#172033] dark:text-white tabular-nums">
                  {publishedResult.coinsCharged} Coins
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={publishedResult.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl inline-flex items-center gap-2"
              >
                Open Live Website ({publishedResult.publicUrl})
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-[#172033] dark:text-white bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
              >
                Return to Workspace
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConfirmPublish} className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-[#4169F5] mb-1">
                MANDATORY DOMAIN & DEPLOYMENT CHECK
              </div>
              <h3 className="text-xl font-bold font-display text-[#172033] dark:text-white">
                Configure Address & Publish Website
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                Verify your website address, entry point, and coin cost summary before publishing.
              </p>
            </div>

            {publishError && (
              <div className="p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-xs text-[#DC2626] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{publishError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1">
                  Website Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1">
                  Selected Entry File
                </label>
                <select
                  value={entryFile}
                  onChange={(e) => setEntryFile(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                >
                  {htmlFiles.length > 0 ? (
                    htmlFiles.map((f) => (
                      <option key={f.id} value={f.fileName}>
                        {f.fileName}
                      </option>
                    ))
                  ) : (
                    <option value="index.html">index.html</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1">
                Website Slug & Requested Hostname
              </label>
              <div className="flex items-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden">
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="myportfolio"
                  className="flex-1 px-3 py-2 text-sm font-mono focus:outline-none bg-transparent"
                />
                <span className="px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-[#64748B] border-l border-slate-200 dark:border-slate-700">
                  .prachurjohost.com
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-xs">
                {checkingSlug ? (
                  <span className="text-[#64748B] inline-flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability...
                  </span>
                ) : slugAvailable ? (
                  <span className="text-[#16A34A] font-medium inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {cleanSlug}.prachurjohost.com is available
                  </span>
                ) : (
                  <span className="text-[#DC2626] font-medium">
                    {slugReason || 'Address unavailable'}
                  </span>
                )}
                <span className="font-mono text-[#64748B]">Public URL: /sites/{cleanSlug}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1">
                  Website Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as WebsiteVisibility)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                >
                  <option value="PUBLIC">Public (Listed & Accessible)</option>
                  <option value="UNLISTED">Unlisted (Direct URL Only)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1">
                  Static Bundle Summary
                </label>
                <div className="px-3 py-2 text-xs font-mono rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-[#172033] dark:text-slate-200 tabular-nums">
                  {draftFiles.length} files · {(website.storageBytes / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1">
                Website Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* Coin Cost Summary Box */}
            <div className="p-4 rounded-xl bg-[#4169F5]/8 dark:bg-[#4169F5]/15 border border-[#4169F5]/25 space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-[#172033] dark:text-white">
                <span className="inline-flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-[#4169F5]" /> Coin Settlement Summary
                </span>
                <span className="font-mono tabular-nums">Wallet: {wallet.balance} Coins</span>
              </div>

              <div className="flex items-center justify-between text-[#64748B] dark:text-slate-300">
                <span>Base Publication Fee</span>
                <span className="font-mono tabular-nums">{settings.publishPriceCoins} Coins</span>
              </div>
              {isSlugChanged && (
                <div className="flex items-center justify-between text-[#64748B] dark:text-slate-300">
                  <span>Domain Change Fee</span>
                  <span className="font-mono tabular-nums">+{settings.domainChangePriceCoins} Coins</span>
                </div>
              )}
              {isNameChanged && (
                <div className="flex items-center justify-between text-[#64748B] dark:text-slate-300">
                  <span>Website Rename Fee</span>
                  <span className="font-mono tabular-nums">+{settings.renamePriceCoins} Coins</span>
                </div>
              )}
              <div className="pt-2 border-t border-[#4169F5]/20 flex items-center justify-between font-bold text-[#172033] dark:text-white">
                <span>Total Required Coins</span>
                <span className="font-mono text-[#4169F5] tabular-nums">{estimatedCoinCost} Coins</span>
              </div>
              {!hasEnoughCoins && (
                <div className="text-[#DC2626] font-medium pt-1">
                  Insufficient balance. Claim your daily reward or redeem a promo code in the Coin Wallet.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#64748B] inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> Atomic reservation & auto-refund protected
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#172033] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing || checkingSlug || !slugAvailable || !hasEnoughCoins}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] disabled:opacity-50 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {publishing ? 'Deploying Snapshot...' : `Confirm Publish (${estimatedCoinCost} Coins)`}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
