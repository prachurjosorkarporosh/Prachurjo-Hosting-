# Prachurjo Host — Multi-Tenant Static Website Hosting Platform

**Platform URL:** `prachurjohost.vercel.app`  
**Developer:** Prachurjo Sorkar Porosh  
**Copyright:** © 2026 Prachurjo Host. All rights reserved.

---

## 1. Architecture Overview

**Prachurjo Host** is a production-oriented, multi-tenant HTML/CSS/JavaScript static website hosting platform with an administrator-controlled virtual coin economy, a browser-based multi-file code editor, validated ZIP/HTML uploads, mandatory pre-publish domain selection, and role-based user and admin dashboards.

### Key Components
- **Frontend (`src/`)**: React 19 + TypeScript + Tailwind CSS v4 with light/dark Glassmorphism and instant English / বাংলা language switching.
- **Persistence & Authentication**: Firebase Authentication (Google Sign-In + Email/Password) and Cloud Firestore secured by zero-trust security rules (`firestore.rules`).
- **Multi-Tenant Edge Router (`server.ts`)**: Express server serving published tenant websites at `/sites/:slug` and resolving incoming `Host` headers (`*.prachurjohost.com` and verified custom domains) with isolated `Content-Security-Policy` and `X-Content-Type-Options: nosniff` headers.

---

## 2. Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Copy `.env.example` to `.env` if needed. Firebase configuration is loaded from `firebase-applet-config.json`.
3. **Start Development Server (Port 3000)**:
   ```bash
   npm run dev
   ```
4. **Lint & Validate Security Rules**:
   ```bash
   npm run lint
   npx eslint firestore.rules
   ```

---

## 3. Vercel & Custom Wildcard Domain Deployment

- **Platform Frontend & Serverless Routing**: Deploy the project to Vercel (`prachurjohost.vercel.app`).
- **Wildcard Subdomain Routing (`*.prachurjohost.com`)**:
  - Note: Vercel does not grant arbitrary sub-subdomains under `*.vercel.app`.
  - To enable `<slug>.prachurjohost.com`, add your owned root domain (`prachurjohost.com`) and wildcard domain (`*.prachurjohost.com`) in your Vercel Project Domains settings and point your DNS `A` / `CNAME` / Nameservers to Vercel.
  - Even without external DNS configuration, every published website is immediately accessible via `/sites/<slug>`.
