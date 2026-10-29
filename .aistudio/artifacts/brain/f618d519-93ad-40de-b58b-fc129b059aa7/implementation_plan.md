# Prachurjo Host — Multi-Tenant Website Hosting Platform

**Prachurjo Host** (`prachurjohost.vercel.app`, developed by Prachurjo Sorkar Porosh) is a production-grade, multi-tenant HTML/CSS/JS static website hosting and publishing platform featuring an administrator-controlled virtual coin economy, a browser-based code editor, secure file/ZIP uploads, pre-publish domain selection, and full role-based user and administrator consoles.

## User Review & Critical Decisions

> [!IMPORTANT]
> Review the confirmed architectural and product choices below before we proceed to implementation.

- **Confirmed Routing & Hosting Architecture**: Published websites will be accessible via direct public path URLs (`/sites/:slug` and `/sites/:slug/:filePath`) as well as an incoming `Host` / custom domain resolver that maps configured subdomains (`*.prachurjohost.com`) or verified custom domains directly to the published version of a tenant's website.
- **Confirmed Starter Templates**: Users creating a new website can choose from **Blank HTML5**, **Personal Portfolio**, **SaaS Landing Page**, and **Link-in-Bio** templates, or upload their own HTML/ZIP packages.
- **Confirmed Bilingual Experience**: The interface defaults to **English** with an instant top-bar language toggle to **বাংলা (Bengali)** that persists across sessions alongside light/dark theme preferences.
- **Database & Authentication Stack**: Powered by **Firebase Authentication** (supporting Google Sign-In and Email/Password authentication with role-based verification) and **Cloud Firestore** with hardened zero-trust security rules (`firestore.rules`) and atomic transactions for the coin ledger, website publishing, and redeem codes.

---

## 1. Overview & Core Concept

- **What It Does**: Enables developers, students, and creators to create, upload, edit, preview, and publish static HTML/CSS/JS websites under custom slugs and domains, funded by a transparent virtual coin ledger with daily rewards, promotional redeem codes, and administrative governance.
- **Target Audience / Persona**:
  - **Creators & Developers (`USER` role)**: Build static sites in the browser or upload ZIP bundles, manage files, configure subdomains/custom domains, claim daily coins, redeem promo codes, and publish versioned deployments.
  - **Platform Administrators (`ADMIN` role, bootstrapped for `prachurjosorkarporosh@gmail.com`)**: Monitor platform metrics, manage user statuses and coin balances with mandatory audit reasons, inspect and suspend websites, configure coin pricing rules, generate single or batch redeem codes, and review immutable audit logs.
- **Key Value**: Combines an intuitive deployment workflow and live multi-file web IDE with strict multi-tenant isolation, archive validation, and an atomic transaction-backed coin economy.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Public Discovery & Legal Transparency**: Visitors explore the landing page featuring a hero showcase, transparent free vs. coin-based hosting capabilities, interactive workflow preview, coin economy breakdown, security architecture, FAQ, Terms of Service, Privacy Policy, and developer attribution (*Prachurjo Sorkar Porosh*).
  2. **Authentication & Role Routing**: Unified login/registration screen supporting **Google Sign-In** and email/password accounts, username uniqueness checks, password reset, and automatic routing to either the **User Dashboard** (`USER`) or **Admin Console** (`ADMIN`) based on server/database-verified roles.
  3. **Website Creation, Upload & Online IDE**: Users create a project from the 4 starter templates or upload `.html` / `.zip` archives (validated for path traversal, size limits, file count limits, allowed static MIME types, and `index.html` entry point). The built-in Online Editor provides tabbed HTML/CSS/JS editing with line numbers, file explorer (create/rename/delete/upload asset), unsaved-changes tracking, autosave recovery, and a live sandboxed preview pane.
  4. **Mandatory Domain Selection & Atomic Publishing**: Before publishing, users open the Publishing & Domain Modal to set website metadata, normalize and check hostname availability (`slug.prachurjohost.com` or custom domain with DNS TXT verification token), select the entry file, and review the coin cost summary. Confirming publication atomically deducts coins, records an immutable ledger entry with an idempotency key, creates a published snapshot version, and makes the live site immediately accessible at `/sites/:slug`. If deployment fails, the hostname reservation is released and coins are refunded once.
  5. **Coin Wallet & Redeem Codes**: Users track current balance, total earned, and total spent, claim server-enforced 24-hour daily rewards, and redeem promotional codes with atomic usage verification.
  6. **Administrator Governance**: Admins view platform-wide telemetry, search/filter users and websites, credit/debit user wallets with mandatory audit logging, dynamically update coin pricing (registration bonus, publish cost, rename cost, domain change cost, daily reward, storage upgrades), batch-generate redeem codes, and manage platform settings.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Premium Light Glassmorphism with optional persisted Dark Mode, crafted for high-density SaaS legibility and zero visual clutter.
  - *Color Palette & Mood*:
    - Light Canvas: Soft Cool Alabaster (`#F2F5FF`) with frosted glass panels (`rgba(255, 255, 255, 0.72)`), subtle crisp borders (`rgba(255, 255, 255, 0.8)`), Primary Cobalt Blue (`#4169F5`), Soft Lavender accent (`#A78BFA`), Deep Slate text (`#172033`), Muted Slate secondary text (`#64748B`), Semantic Emerald (`#16A34A`), Amber (`#D97706`), and Crimson (`#DC2626`).
    - Dark Canvas: Deep Obsidian Slate (`#0B0F19`) with translucent dark glass surfaces (`rgba(30, 41, 59, 0.70)`) and subtle hairline borders (`rgba(255, 255, 255, 0.08)`).
  - *Typography & Hierarchy*:
    - Display & Navigation: `Plus Jakarta Sans` (`600`/`700`, tight tracking, balanced headlines).
    - Body & UI Controls: `DM Sans` (`400`/`500`) for clean bilingual rendering alongside Bengali script (`Noto Sans Bengali` fallback).
    - Code Editor, Metrics & Ledger Numerals: `JetBrains Mono` with strict `tabular-nums` alignment for all coin balances, storage byte counters, timestamps, and deployment versions.
  - *Component Styling & Layout*:
    - Public Marketing Top Bar follows the strict 3-zone contract: single-line brand wordmark (`Prachurjo Host`), 4–5 single-line navigation links, and primary action button.
    - Dashboard Workspace uses a fixed/collapsible `260px` sidebar on desktop (slide-out drawer + compact header on mobile), contextual top header with search, language switch (`EN | বাংলা`), theme toggle, notification bell with unread counter, and profile menu.
    - Single-elevation card discipline with unboxed metadata separators (`·`) and high-density tabular lists.

- **Interactive Feedback & Motion**:
  - Fast `150ms` compositor transitions (`transform`, `opacity`), skeleton loading placeholders for tables/cards, explicit empty states with primary CTAs, upload progress bars with file-by-file security validation feedback, and in-app notification toasts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual Persistence & Hosting Architecture (Express Backend + Firestore + Sandboxed Site Router)**
  - *Chosen Approach*: Combine client/server Firebase Authentication & Firestore persistence with an Express backend (`server.ts`) that serves published tenant websites under `/sites/:slug/*` and resolves incoming custom `Host` headers (`*.prachurjohost.com`) with strict Content-Security-Policy (CSP) and `X-Content-Type-Options: nosniff` headers.
  - *Why*: Guarantees that published websites are genuinely accessible via real HTTP routes and isolated from the dashboard's authentication context, while keeping all user accounts, website versions, files, coin transactions, and audit logs durable across sessions.
  - *Alternatives Considered*: Pure client-side Blob URLs (rejected because published URLs wouldn't work across tabs or external visitors) or writing to ephemeral local disk only (rejected because serverless containers lose local files on restart; storing versioned static files in database-backed storage objects ensures 100% persistence).

- **Decision 2: Atomic Ledger & Idempotent Publishing Workflow**
  - *Chosen Approach*: Every coin balance change (`REGISTRATION_BONUS`, `DAILY_REWARD`, `WEBSITE_PUBLISH`, `WEBSITE_RENAME`, `DOMAIN_CHANGE`, `STORAGE_UPGRADE`, `REDEEM_REWARD`, `ADMIN_CREDIT`, `ADMIN_DEBIT`, `REFUND`) executes inside an atomic transaction that verifies current balance $\ge$ cost, checks idempotency keys, updates `coin_wallets`, appends an immutable `coin_transactions` record, and creates an in-app notification.
  - *Why*: Prevents negative balances, double-charging on rapid clicks, or race conditions when claiming daily rewards and redeeming promotional codes.

- **Decision 3: Client + Server Archive & Content Validation**
  - *Chosen Approach*: Inspect uploaded ZIP archives and individual files for path traversal (`../`), prohibited server-side extensions (`.php`, `.sh`, `.py`, `.exe`, `.bat`), file count limits ($\le 50$ files per site), size quotas, and mandatory HTML entry points before storing randomized object keys.
  - *Why*: Protects the platform against zip bombs, path traversal vulnerabilities, and unauthorized script execution.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                        PRACHURJO HOST — CLIENT & SERVER                            │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  ┌──────────────────────┐   ┌──────────────────────────┐   ┌────────────────────┐  │
│  │   Public Website     │   │      User Dashboard      │   │   Admin Console    │  │
│  │  • Hero & Features   │   │  • Overview & Activity   │   │  • System Overview │  │
│  │  • Workflow Preview  │   │  • My Websites & Create  │   │  • User & Wallet   │  │
│  │  • Coin & Security   │   │  • ZIP / HTML Uploader   │   │    Management      │  │
│  │  • FAQ, Terms,       │   │  • Online Code Editor    │   │  • Website Review  │  │
│  │    Privacy Policy    │   │  • Domain & Publish Flow │   │  • Coin Pricing    │  │
│  │  • Unified Auth      │   │  • Coin Wallet & Redeem  │   │  • Batch Redeem    │  │
│  │    (Google + Email)  │   │  • Storage, Profile,     │   │    Code Generator  │  │
│  └──────────┬───────────┘   │    Notifications & Help  │   │  • Audit Logs &    │  │
│             │               └────────────┬─────────────┘   │    Platform Config │  │
│             └────────────────────────────┼─────────────────┴─────────┬──────────┘  │
│                                          │                           │             │
│                                          ▼                           ▼             │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │             State, Auth & Transaction Service Layer (Bilingual EN/BN)        │  │
│  │  • Firebase Auth (Google Popup + Email/Password + Admin Role Verification)   │  │
│  │  • Atomic Firestore Transactions (Wallet Ledger, Publish, Domain, Redeem)    │  │
│  │  • ZIP Unpacker & Security Validator (JSZip + MIME/Path Traversal Guard)     │  │
│  └───────────────────────────────────────┬──────────────────────────────────────┘  │
│                                          │                                         │
│                                          ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │         Cloud Firestore Database & Express Multi-Tenant Site Router          │  │
│  │  • Collections: users, websites, domains, website_versions, storage_objects, │  │
│  │    coin_wallets, coin_transactions, redeem_codes, redeem_redemptions,        │  │
│  │    notifications, activity_logs, admin_audit_logs, platform_settings         │  │
│  │  • Public Site Router: GET /sites/:slug/* & Host Header Subdomain Resolver   │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Entities

1. **`users`**: `uid`, `username` (unique, normalized), `email`, `displayName`, `photoURL`, `role` (`USER` | `ADMIN`), `status` (`ACTIVE` | `SUSPENDED`), `storageQuotaBytes`, `storageUsedBytes`, `twoFactorEnabled`, `createdAt`, `updatedAt`.
2. **`websites`**: `id`, `userId`, `ownerUsername`, `name`, `slug` (unique), `description`, `visibility` (`PUBLIC` | `UNLISTED`), `entryFile` (default `index.html`), `status` (`DRAFT` | `QUEUED` | `PUBLISHING` | `PUBLISHED` | `FAILED` | `SUSPENDED` | `ARCHIVED`), `primaryHostname`, `storageBytes`, `publishedVersionId`, `currentVersionNumber`, `createdAt`, `updatedAt`.
3. **`domains`**: `id`, `websiteId`, `userId`, `hostname` (unique, normalized lowercase), `domainType` (`SUBDOMAIN` | `CUSTOM`), `verificationStatus` (`VERIFIED` | `PENDING` | `FAILED`), `verificationToken`, `isPrimary`, `createdAt`.
4. **`website_versions`**: `id`, `websiteId`, `userId`, `versionNumber`, `storagePrefix`, `deploymentStatus` (`PUBLISHED` | `SUPERSEDED` | `FAILED`), `fileCount`, `totalBytes`, `createdAt`.
5. **`storage_objects`**: `id`, `userId`, `websiteId`, `versionId` (`draft` or published version ID), `objectKey`, `fileName`, `mimeType`, `sizeBytes`, `content` (validated static source/asset content), `createdAt`, `updatedAt`.
6. **`coin_wallets`**: `userId`, `balance` (integer $\ge 0$), `totalEarned`, `totalSpent`, `lastDailyRewardAt`, `updatedAt`.
7. **`coin_transactions`**: `id`, `userId`, `amount` (signed integer), `balanceAfter`, `transactionType`, `referenceId`, `idempotencyKey`, `description`, `createdAt`.
8. **`redeem_codes` & `redeem_redemptions`**: Stores promotional code definitions (`code`, `codeHash`, `coinAmount`, `maxRedemptions`, `perUserLimit`, `currentRedemptions`, `expiresAt`, `isActive`) and per-user redemption receipts.
9. **`notifications` & `activity_logs`**: Real-time user alerts (unread counter, mark-as-read) and chronological user activity feed.
10. **`admin_audit_logs` & `platform_settings`**: Immutable record of administrator operations (with mandatory reason and target metadata) and dynamic platform-wide coin pricing and quota rules.

### Interactive Component & State Mapping

- **Dashboard Navigation**: Switching between the 15 user dashboard sections (`Overview`, `My Websites`, `Create Website`, `Upload Website`, `Online Editor`, `Domains`, `File Manager`, `Coin Wallet`, `Redeem Codes`, `Storage`, `Notifications`, `Activity History`, `Profile`, `Settings`, `Help & Support`) and the 10 admin console views updates the active workspace view cleanly without page reloads.
- **Online Editor & File Manager**: Selecting a website loads its `storage_objects` into the multi-file editor; modifying code marks the file dirty, triggers debounced autosave to local recovery + draft storage, and updates the live sandboxed preview iframe (`srcDoc` with relative asset resolution).
- **Pre-Publish Domain & Cost Gate**: Typing a desired slug or custom hostname runs real-time regex normalization, reserved-word filtering (`admin`, `api`, `www`, `mail`, `dashboard`, `support`), and Firestore uniqueness checks, displaying exact coin costs fetched from `platform_settings` before enabling the atomic **Confirm Publish** transaction.
- **Public Multi-Tenant Serving**: Visiting `/sites/:slug` (or clicking "Open Live Website") resolves the website's active `publishedVersionId`, verifies the website status is `PUBLISHED` and owner is `ACTIVE`, and renders the published `entryFile` and linked CSS/JS/SVG assets with isolated security headers, or serves a branded custom 404/Suspended screen if unavailable.
