import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Coins,
  ExternalLink,
  FileArchive,
  Globe,
  HelpCircle,
  Lock,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
} from 'lucide-react';
import { Language, PlatformSettings } from '../types';
import { t } from '../i18n/translations';

interface PublicLandingProps {
  lang: Language;
  setLang: (lang: Language) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  settings: PlatformSettings;
  onOpenAuth: (mode: 'login' | 'register') => void;
  isAuthenticated: boolean;
  onEnterDashboard: () => void;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({
  lang,
  setLang,
  darkMode,
  setDarkMode,
  settings,
  onOpenAuth,
  isAuthenticated,
  onEnterDashboard,
}) => {
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | 'contact' | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const faqs = [
    {
      q:
        lang === 'bn'
          ? 'প্রাচুর্য হোস্টে কীভাবে ওয়েবসাইট পাবলিশ করব?'
          : 'How do I publish a website on Prachurjo Host?',
      a:
        lang === 'bn'
          ? 'অ্যাকাউন্ট তৈরি করার সাথে সাথে আপনি ফ্রি রেজিস্ট্রেশন বোনাস কয়েন পাবেন। এরপর একটি স্টার্টার টেমপ্লেট বেছে নিন অথবা আপনার HTML/ZIP ফাইল আপলোড করুন, আপনার পছন্দের ওয়েবসাইট অ্যাড্রেস (slug) যাচাই করুন এবং পাবলিশ বাটনে ক্লিক করুন।'
          : 'Upon registration you receive a welcome bonus of virtual coins. Create a site from one of our 4 starter templates or upload an HTML file or ZIP archive, verify your desired hostname before publishing, and confirm publication.',
    },
    {
      q:
        lang === 'bn'
          ? 'কয়েন ইকোনমি কীভাবে কাজ করে? এতে কি আসল টাকা লাগে?'
          : 'How does the virtual coin economy work? Does it cost real money?',
      a:
        lang === 'bn'
          ? 'না, প্রাচুর্য হোস্ট সম্পূর্ণভাবে প্ল্যাটফর্মের ভার্চুয়াল কয়েন লেজারে চলে। আপনি রেজিস্ট্রেশন বোনাস, প্রতিদিনের ডেইলি রিওয়ার্ড এবং অ্যাডমিনের দেওয়া প্রোমোশনাল রিডিম কোড ব্যবহার করে কয়েন অর্জন করতে পারবেন।'
          : 'No real-money payment is required. Every new account receives an initial registration bonus, can claim daily login rewards every 24 hours, and can redeem promotional codes distributed by administrators.',
    },
    {
      q:
        lang === 'bn'
          ? 'কোন ধরনের ফাইল আপলোড করা যাবে?'
          : 'What file types and archive limits are enforced?',
      a:
        lang === 'bn'
          ? 'শুধুমাত্র স্ট্যাটিক ওয়েব ফাইল যেমন HTML, CSS, JavaScript, SVG, JSON, TXT এবং MD অনুমোদিত। নিরাপত্তার জন্য PHP বা সার্ভার-সাইড স্ক্রিপ্ট এবং পাথ ট্রাভার্সাল সম্পূর্ণ নিষিদ্ধ।'
          : 'We host static client-side web assets: HTML (.html), CSS (.css), JavaScript (.js), SVG (.svg), JSON (.json), and Markdown/Text files. Server-side scripts (.php, .py, .sh, executables) and path traversal archives are automatically rejected.',
    },
    {
      q:
        lang === 'bn'
          ? 'ডোমেইন ও কাস্টম হোস্টনেম কীভাবে কাজ করে?'
          : 'How does domain selection and custom hostname routing work?',
      a:
        lang === 'bn'
          ? 'পাবলিশ করার আগে আপনি একটি ইউনিক স্লাগ (যেমন myportfolio.prachurjohost.com এবং /sites/myportfolio) নির্বাচন করবেন। এছাড়াও DNS TXT ভেরিফিকেশনের মাধ্যমে নিজস্ব কাস্টম ডোমেইন যুক্ত করা যায়।'
          : 'Before publishing, you select a unique normalized slug (mapped to <slug>.prachurjohost.com and publicly accessible at /sites/<slug>). You can also attach custom domains and verify ownership via a DNS TXT token.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/80 dark:border-slate-800/80 px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-[#172033] dark:text-white whitespace-nowrap shrink-0 font-display"
          >
            {t(lang, 'brandName')}
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#64748B] dark:text-slate-300">
            <a
              href="#capabilities"
              className="hover:text-[#4169F5] transition-colors whitespace-nowrap shrink-0"
            >
              {t(lang, 'featuresNav')}
            </a>
            <a
              href="#workflow"
              className="hover:text-[#4169F5] transition-colors whitespace-nowrap shrink-0"
            >
              {t(lang, 'workflowNav')}
            </a>
            <a
              href="#coin-economy"
              className="hover:text-[#4169F5] transition-colors whitespace-nowrap shrink-0"
            >
              {t(lang, 'coinSystemNav')}
            </a>
            <a
              href="#security"
              className="hover:text-[#4169F5] transition-colors whitespace-nowrap shrink-0"
            >
              {t(lang, 'securityNav')}
            </a>
            <a
              href="#faq"
              className="hover:text-[#4169F5] transition-colors whitespace-nowrap shrink-0"
            >
              {t(lang, 'faqNav')}
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => (isAuthenticated ? onEnterDashboard() : onOpenAuth('register'))}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              {isAuthenticated ? t(lang, 'dashboard') : t(lang, 'createWebsite')}
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Workspace Controls & Language Bar inside Hero Canvas */}
      <main id="top" className="flex-1">
        <div className="max-w-[1200px] mx-auto px-6 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200/70 dark:border-slate-800/80 text-xs text-[#64748B] dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>prachurjohost.vercel.app</span>
              <span aria-hidden="true">·</span>
              <span>Multi-Tenant Static Web Hosting</span>
              <span aria-hidden="true">·</span>
              <a
                href="/sites/prachurjo-demo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4169F5] hover:underline font-medium inline-flex items-center gap-1"
              >
                Live Tenant Example (/sites/prachurjo-demo)
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <div className="flex items-center gap-1 p-1 bg-white/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <button
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    lang === 'en'
                      ? 'bg-[#4169F5] text-white'
                      : 'text-[#64748B] dark:text-slate-300 hover:text-[#172033]'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setLang('bn')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    lang === 'bn'
                      ? 'bg-[#4169F5] text-white'
                      : 'text-[#64748B] dark:text-slate-300 hover:text-[#172033]'
                  }`}
                >
                  বাংলা
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Toggle color theme"
                className="p-2 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-[#172033] dark:text-slate-200 hover:border-[#4169F5] transition-colors cursor-pointer"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {!isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenAuth('login')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#172033] dark:text-white bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-[#4169F5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {t(lang, 'login')}
                  </button>
                  <button
                    onClick={() => onOpenAuth('register')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#4169F5] bg-[#4169F5]/10 rounded-lg hover:bg-[#4169F5]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {t(lang, 'register')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={onEnterDashboard}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#4169F5] bg-[#4169F5]/10 rounded-lg hover:bg-[#4169F5]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t(lang, 'dashboard')} →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <section className="max-w-[1200px] mx-auto px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="text-xs font-medium text-[#4169F5] mb-3">
                {lang === 'bn'
                  ? 'ফ্রি স্টার্টার বোনাস · ইনস্ট্যান্ট ব্রাউজার IDE · কাস্টম ডোমেইন রাউটিং'
                  : 'Free Registration Coin Bonus · Browser Code Editor · Custom Hostname Routing'}
              </div>
              <h1
                className="font-display font-bold text-[#172033] dark:text-white tracking-tight mb-5"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', lineHeight: 1.12, textWrap: 'balance' }}
              >
                {t(lang, 'heroHeadline')}
              </h1>
              <p className="text-base lg:text-lg text-[#64748B] dark:text-slate-300 leading-relaxed mb-8 max-w-[62ch]">
                {t(lang, 'heroSubtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-8">
                <button
                  onClick={() => (isAuthenticated ? onEnterDashboard() : onOpenAuth('register'))}
                  className="px-6 py-3.5 text-sm font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl transition-all inline-flex items-center gap-2 shadow-md shadow-[#4169F5]/20 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isAuthenticated ? t(lang, 'dashboard') : t(lang, 'createWebsite')}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="/sites/prachurjo-demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3.5 text-sm font-semibold text-[#172033] dark:text-white glass-panel rounded-xl hover:border-[#4169F5] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  Inspect Live Demo Site
                  <ExternalLink className="w-4 h-4 text-[#4169F5]" />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#64748B] dark:text-slate-400">
                <span className="tabular-nums">+{settings.registrationBonusCoins} Coins on Signup</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{settings.publishPriceCoins} Coins per Publish</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {Math.round(settings.defaultStorageQuotaBytes / 1024 / 1024)} MB Initial Storage Quota
                </span>
                <span aria-hidden="true">·</span>
                <span>Google & Email Auth</span>
              </div>
            </div>

            {/* Right Column: Interactive Glassmorphic Deployment Preview Window */}
            <div className="lg:col-span-5 flex">
              <div className="glass-panel rounded-2xl p-6 w-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200/70 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                        PRE-PUBLISH ADDRESS CHECKER
                      </div>
                      <div className="text-sm font-bold text-[#172033] dark:text-white mt-0.5">
                        Domain Selection & Atomic Publish
                      </div>
                    </div>
                    <Globe className="w-5 h-5 text-[#4169F5]" />
                  </div>

                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-xs text-[#64748B] dark:text-slate-400 mb-1">
                        Selected Project & Entry Point
                      </div>
                      <div className="flex items-center justify-between text-sm font-medium text-[#172033] dark:text-white">
                        <span>My Developer Portfolio</span>
                        <span className="font-mono text-xs text-[#4169F5]">index.html · 3 files</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-xs text-[#64748B] dark:text-slate-400 mb-1">
                        Requested Hostname & Public Route
                      </div>
                      <div className="font-mono text-sm font-semibold text-[#172033] dark:text-white break-all">
                        myportfolio.prachurjohost.com
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-[#16A34A] font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Address Available
                        </span>
                        <span className="font-mono text-[#64748B]">/sites/myportfolio</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#4169F5]/8 dark:bg-[#4169F5]/15 border border-[#4169F5]/20">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[#64748B] dark:text-slate-300">Registration Bonus Wallet</span>
                        <span className="font-mono font-semibold text-[#172033] dark:text-white tabular-nums">
                          {settings.registrationBonusCoins} Coins
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[#64748B] dark:text-slate-300">Publication Settlement Cost</span>
                        <span className="font-mono font-semibold text-[#4169F5] tabular-nums">
                          -{settings.publishPriceCoins} Coins
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#4169F5]/20 flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#172033] dark:text-white">Balance After Publish</span>
                        <span className="font-mono text-[#16A34A] tabular-nums">
                          {Math.max(0, settings.registrationBonusCoins - settings.publishPriceCoins)} Coins
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs text-[#64748B] dark:text-slate-400">
                  <span>Automatic refund if deployment fails</span>
                  <span className="font-mono text-[#172033] dark:text-slate-200">Idempotent Ledger</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width 4-Column Platform Metric Strip below Hero Split */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B] dark:text-slate-400 mb-1">Starter Templates</div>
              <div className="text-2xl font-bold font-display text-[#172033] dark:text-white tabular-nums">
                4 Included
              </div>
              <div className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Blank HTML5 · Portfolio · SaaS · Link-in-Bio
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B] dark:text-slate-400 mb-1">Welcome Coin Grant</div>
              <div className="text-2xl font-bold font-display text-[#4169F5] tabular-nums">
                +{settings.registrationBonusCoins} Coins
              </div>
              <div className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Credited atomically upon signup
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B] dark:text-slate-400 mb-1">Daily Login Reward</div>
              <div className="text-2xl font-bold font-display text-[#16A34A] tabular-nums">
                +{settings.dailyRewardCoins} Coins / 24h
              </div>
              <div className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Plus promotional redeem codes
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-xs text-[#64748B] dark:text-slate-400 mb-1">Archive Protection</div>
              <div className="text-2xl font-bold font-display text-[#172033] dark:text-white tabular-nums">
                Zero Server Exec
              </div>
              <div className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Static HTML/CSS/JS/SVG allowlist
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Bento Grid */}
        <section id="capabilities" className="max-w-[1200px] mx-auto px-6 py-14">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl lg:text-3xl font-bold font-display text-[#172033] dark:text-white tracking-tight mb-3">
              01. Engineered for Complete Static Hosting Lifecycle
            </h2>
            <p className="text-sm lg:text-base text-[#64748B] dark:text-slate-300">
              Every tool required to build, validate, preview, and publish multi-file static websites from a unified workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-panel rounded-2xl p-7">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-[#4169F5]">BROWSER IDE & LIVE PREVIEW</span>
                <Code2 className="w-5 h-5 text-[#4169F5]" />
              </div>
              <h3 className="text-xl font-bold text-[#172033] dark:text-white mb-2">
                Multi-File Online Code Editor with Autosave Recovery
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed mb-6">
                Edit HTML, CSS, and JavaScript directly in your browser with line numbers, file explorer management (create, rename, delete, upload assets), unsaved change indicators, local autosave recovery, and an instant sandboxed preview pane.
              </p>
              <div className="p-4 rounded-xl bg-[#0B0F19] text-slate-200 font-mono text-xs leading-relaxed overflow-x-auto">
                <div className="text-slate-400 mb-1">index.html · styles.css · app.js</div>
                <div>&lt;!DOCTYPE html&gt;</div>
                <div>&lt;html lang="en"&gt;</div>
                <div>  &lt;link rel="stylesheet" href="styles.css" /&gt;</div>
                <div>  &lt;script src="app.js" defer&gt;&lt;/script&gt;</div>
                <div>&lt;/html&gt;</div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-[#4169F5]">ARCHIVE SECURITY</span>
                  <FileArchive className="w-5 h-5 text-[#4169F5]" />
                </div>
                <h3 className="text-xl font-bold text-[#172033] dark:text-white mb-2">
                  Hardened ZIP & HTML Uploader
                </h3>
                <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                  Archives are inspected before extraction. We block path traversal sequences (<code>../</code>), reject PHP/shell scripts, enforce file-count and uncompressed byte caps, and verify your <code>index.html</code> entry file.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400">
                Allowed: .html · .css · .js · .svg · .json · .txt · .md
              </div>
            </div>
          </div>
        </section>

        {/* How It Works / Hosting Workflow Preview */}
        <section id="workflow" className="max-w-[1200px] mx-auto px-6 py-14">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl lg:text-3xl font-bold font-display text-[#172033] dark:text-white tracking-tight mb-3">
              02. Three-Step Publishing Workflow
            </h2>
            <p className="text-sm lg:text-base text-[#64748B] dark:text-slate-300">
              From draft creation to live public hosting in under sixty seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel rounded-2xl p-6">
              <div className="font-mono text-xs font-semibold text-[#4169F5] mb-2">STEP 01</div>
              <h3 className="text-lg font-bold text-[#172033] dark:text-white mb-2">
                Create or Upload Project
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                Start with Blank HTML5, Portfolio, SaaS Landing, or Link-in-Bio templates—or upload an existing HTML file or ZIP bundle.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6">
              <div className="font-mono text-xs font-semibold text-[#4169F5] mb-2">STEP 02</div>
              <h3 className="text-lg font-bold text-[#172033] dark:text-white mb-2">
                Choose Website Address
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                Pick your unique slug before publishing. Our domain checker normalizes characters, blocks reserved system routes, and confirms availability.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6">
              <div className="font-mono text-xs font-semibold text-[#4169F5] mb-2">STEP 03</div>
              <h3 className="text-lg font-bold text-[#172033] dark:text-white mb-2">
                Confirm & Publish Live
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                Coins are deducted atomically once your snapshot deploys. Your site is immediately live at <code>/sites/&lt;slug&gt;</code> and your configured hostname.
              </p>
            </div>
          </div>
        </section>

        {/* Coin Economy Breakdown */}
        <section id="coin-economy" className="max-w-[1200px] mx-auto px-6 py-14">
          <div className="glass-panel rounded-2xl p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#4169F5] mb-2">
                  <Coins className="w-4 h-4" /> ADMINISTRATOR-GOVERNED LEDGER
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold font-display text-[#172033] dark:text-white tracking-tight mb-3">
                  03. Transparent Coin Economy
                </h2>
                <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed mb-6">
                  Every balance adjustment is recorded as an immutable transaction entry in the database ledger. Clients can never manipulate their own balance, and failed deployments automatically refund charges once.
                </p>
                <button
                  onClick={() => (isAuthenticated ? onEnterDashboard() : onOpenAuth('register'))}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4169F5] hover:bg-[#3156d8] rounded-xl transition-colors cursor-pointer"
                >
                  Claim +{settings.registrationBonusCoins} Welcome Coins
                </button>
              </div>

              <div className="lg:col-span-7">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400">
                        <th className="py-3 px-4 font-semibold">Operation / Event</th>
                        <th className="py-3 px-4 font-semibold">Ledger Type</th>
                        <th className="py-3 px-4 font-semibold text-right">Coin Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
                      <tr>
                        <td className="py-3 px-4 font-medium text-[#172033] dark:text-white">New Account Signup</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#64748B]">REGISTRATION_BONUS</td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#16A34A] text-right tabular-nums">
                          +{settings.registrationBonusCoins} Coins
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-[#172033] dark:text-white">Daily Wallet Claim (24h)</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#64748B]">DAILY_REWARD</td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#16A34A] text-right tabular-nums">
                          +{settings.dailyRewardCoins} Coins
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-[#172033] dark:text-white">Website Publication</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#64748B]">WEBSITE_PUBLISH</td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#172033] dark:text-slate-200 text-right tabular-nums">
                          -{settings.publishPriceCoins} Coins
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-[#172033] dark:text-white">Published Website Rename</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#64748B]">WEBSITE_RENAME</td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#172033] dark:text-slate-200 text-right tabular-nums">
                          -{settings.renamePriceCoins} Coins
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-[#172033] dark:text-white">Published Domain Change</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#64748B]">DOMAIN_CHANGE</td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#172033] dark:text-slate-200 text-right tabular-nums">
                          -{settings.domainChangePriceCoins} Coins
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-[#172033] dark:text-white">+50 MB Storage Quota Upgrade</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#64748B]">STORAGE_UPGRADE</td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#172033] dark:text-slate-200 text-right tabular-nums">
                          -{settings.storageUpgradePriceCoins} Coins
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Architecture */}
        <section id="security" className="max-w-[1200px] mx-auto px-6 py-14">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl lg:text-3xl font-bold font-display text-[#172033] dark:text-white tracking-tight mb-3">
              04. Security & Multi-Tenant Isolation
            </h2>
            <p className="text-sm lg:text-base text-[#64748B] dark:text-slate-300">
              Built with zero-trust database rules, strict tenant ownership boundaries, and honest infrastructure capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel rounded-2xl p-6">
              <ShieldCheck className="w-5 h-5 text-[#4169F5] mb-3" />
              <h3 className="text-base font-bold text-[#172033] dark:text-white mb-2">
                Tenant Ownership & Draft Privacy
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                Unpublished draft files are strictly scoped to your authenticated UID. One tenant can never read or modify another tenant&apos;s private draft files.
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-6">
              <Lock className="w-5 h-5 text-[#4169F5] mb-3" />
              <h3 className="text-base font-bold text-[#172033] dark:text-white mb-2">
                Isolated Content-Security-Policy
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                Published websites are served with <code>X-Content-Type-Options: nosniff</code> and restricted CSP headers. Server-side code execution (PHP, shell, Python) is never permitted.
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-6">
              <Terminal className="w-5 h-5 text-[#4169F5] mb-3" />
              <h3 className="text-base font-bold text-[#172033] dark:text-white mb-2">
                Vercel & Wildcard DNS Compatible
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                Supports direct public path routing (<code>/sites/:slug</code>) out of the box and custom wildcard domain resolution (<code>*.prachurjohost.com</code>) when DNS is pointed to your deployment.
              </p>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section id="faq" className="max-w-[1200px] mx-auto px-6 py-14">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold font-display text-[#172033] dark:text-white tracking-tight mb-3">
              05. Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3 max-w-3xl">
            {faqs.map((item, idx) => (
              <div key={idx} className="glass-panel rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left font-semibold text-sm lg:text-base text-[#172033] dark:text-white cursor-pointer"
                >
                  <span>{item.q}</span>
                  <HelpCircle className="w-4 h-4 text-[#4169F5] shrink-0 ml-4" />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 text-sm text-[#64748B] dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Quiet Footer with Developer Information, Terms, Privacy Policy, and Contact */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-10 px-6 mt-12">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs text-[#64748B] dark:text-slate-400">
          <div className="space-y-1">
            <div className="font-bold text-sm text-[#172033] dark:text-white font-display">
              {t(lang, 'brandName')} · prachurjohost.vercel.app
            </div>
            <div>{t(lang, 'developerCredit')}</div>
            <div>{t(lang, 'copyrightNotice')}</div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              onClick={() => setLegalModal('terms')}
              className="hover:text-[#4169F5] transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              onClick={() => setLegalModal('privacy')}
              className="hover:text-[#4169F5] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => {
                setContactSubmitted(false);
                setLegalModal('contact');
              }}
              className="hover:text-[#4169F5] transition-colors cursor-pointer"
            >
              Contact & Abuse Reporting
            </button>
          </div>
        </div>
      </footer>

      {/* Terms / Privacy / Contact Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl max-w-xl w-full p-6 lg:p-8 max-h-[85vh] overflow-y-auto">
            {legalModal === 'terms' && (
              <>
                <h3 className="text-xl font-bold text-[#172033] dark:text-white mb-3">
                  Terms of Service — Prachurjo Host
                </h3>
                <div className="space-y-3 text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                  <p>
                    <strong>1. Acceptable Static Content:</strong> Prachurjo Host provides multi-tenant static HTML, CSS, JavaScript, and SVG hosting. Uploading phishing pages, malware, copyright-infringing material, or server-side scripts is strictly prohibited.
                  </p>
                  <p>
                    <strong>2. Virtual Coin Economy:</strong> Platform coins are virtual utility credits managed by administrators for resource allocation (publishing, domain updates, storage upgrades). Coins have no cash value and are non-transferable outside the platform.
                  </p>
                  <p>
                    <strong>3. Resource Quotas & Availability:</strong> Storage quotas and file size limits are enforced per account. Administrators reserve the right to suspend websites that violate security policies.
                  </p>
                </div>
              </>
            )}

            {legalModal === 'privacy' && (
              <>
                <h3 className="text-xl font-bold text-[#172033] dark:text-white mb-3">
                  Privacy Policy — Prachurjo Host
                </h3>
                <div className="space-y-3 text-sm text-[#64748B] dark:text-slate-300 leading-relaxed">
                  <p>
                    <strong>1. Account Information:</strong> We store your authentication UID, verified email address, chosen username, and profile preferences solely to provide multi-tenant website hosting and wallet ledger integrity.
                  </p>
                  <p>
                    <strong>2. Draft vs. Published Visibility:</strong> Draft website files remain private to your account. When you explicitly publish a website, its published snapshot becomes publicly accessible via its configured address.
                  </p>
                  <p>
                    <strong>3. Audit Logging:</strong> Administrative actions and coin transactions are logged with timestamps to prevent abuse and ensure transparency.
                  </p>
                </div>
              </>
            )}

            {legalModal === 'contact' && (
              <>
                <h3 className="text-xl font-bold text-[#172033] dark:text-white mb-2">
                  Contact Developer & Abuse Reporting
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mb-4">
                  Developer: Prachurjo Sorkar Porosh · Platform: prachurjohost.vercel.app
                </p>
                {contactSubmitted ? (
                  <div className="p-4 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/30 text-sm text-[#16A34A]">
                    Thank you! Your message has been recorded for administrator review.
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (contactEmail.includes('@') && contactMsg.trim().length > 5) {
                        setContactSubmitted(true);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1">
                        Your Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200 mb-1">
                        Message or Reported Hostname
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={contactMsg}
                        onChange={(e) => setContactMsg(e.target.value)}
                        placeholder="Describe your inquiry or report a prohibited website hostname..."
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#4169F5] rounded-xl hover:bg-[#3156d8] cursor-pointer"
                    >
                      Submit Report
                    </button>
                  </form>
                )}
              </>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 text-xs font-semibold text-[#172033] dark:text-white bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
