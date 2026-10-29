import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PublishedFile {
  fileName: string;
  mimeType: string;
  content: string;
  sizeBytes: number;
}

interface PublishedSiteBundle {
  websiteId: string;
  name: string;
  slug: string;
  primaryHostname: string;
  customHostnames: string[];
  entryFile: string;
  status: 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED' | 'DRAFT';
  ownerUsername: string;
  versionNumber: number;
  publishedAt: string;
  files: Record<string, PublishedFile>;
}

// In-memory edge cache synced with Firestore published sites for ultra-fast multi-tenant routing
const publishedSitesBySlug = new Map<string, PublishedSiteBundle>();
const hostnameToSlug = new Map<string, string>();

// Seed an initial live demo site on the edge router so visitors can test /sites/prachurjo-demo immediately
const seedDemoSite: PublishedSiteBundle = {
  websiteId: 'demo-showcase-site',
  name: 'Prachurjo Studio Showcase',
  slug: 'prachurjo-demo',
  primaryHostname: 'prachurjo-demo.prachurjohost.com',
  customHostnames: ['demo.prachurjohost.com'],
  entryFile: 'index.html',
  status: 'PUBLISHED',
  ownerUsername: 'prachurjo',
  versionNumber: 1,
  publishedAt: new Date().toISOString(),
  files: {
    'index.html': {
      fileName: 'index.html',
      mimeType: 'text/html; charset=utf-8',
      sizeBytes: 1840,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prachurjo Studio — Hosted on Prachurjo Host</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="container">
    <header class="top">
      <span class="brand">Prachurjo Studio</span>
      <span class="meta">prachurjo-demo.prachurjohost.com · v1</span>
    </header>
    <section class="hero">
      <h1>Multi-Tenant Static Hosting, Verified Live.</h1>
      <p>This static HTML5, CSS3, and JavaScript website is served directly by the Prachurjo Host tenant router with isolated security headers.</p>
      <div class="actions">
        <button id="pingBtn" class="btn">Run Client Script Check</button>
        <span id="pingOutput" class="output">Ready for interaction</span>
      </div>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
    },
    'styles.css': {
      fileName: 'styles.css',
      mimeType: 'text/css; charset=utf-8',
      sizeBytes: 820,
      content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #F2F5FF; color: #172033; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
.container { max-width: 720px; width: 100%; background: rgba(255,255,255,0.85); border: 1px solid rgba(65,105,245,0.2); border-radius: 20px; padding: 2.5rem; box-shadow: 0 20px 50px rgba(23,32,51,0.06); }
.top { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(23,32,51,0.08); margin-bottom: 2rem; font-size: 0.875rem; }
.brand { font-weight: 700; color: #4169F5; }
.meta { color: #64748B; font-family: monospace; }
.hero h1 { font-size: 2.25rem; line-height: 1.2; margin-bottom: 1rem; letter-spacing: -0.02em; }
.hero p { color: #475569; line-height: 1.6; margin-bottom: 2rem; }
.actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.btn { background: #4169F5; color: #fff; border: none; padding: 0.75rem 1.25rem; border-radius: 10px; font-weight: 600; cursor: pointer; }
.btn:hover { background: #3154d6; }
.output { font-family: monospace; font-size: 0.85rem; color: #16A34A; }`,
    },
    'app.js': {
      fileName: 'app.js',
      mimeType: 'application/javascript; charset=utf-8',
      sizeBytes: 310,
      content: `document.getElementById('pingBtn')?.addEventListener('click', () => {
  const out = document.getElementById('pingOutput');
  if (out) {
    out.textContent = 'Static JS verified at ' + new Date().toLocaleTimeString();
  }
});`,
    },
  },
};

publishedSitesBySlug.set(seedDemoSite.slug, seedDemoSite);
hostnameToSlug.set(seedDemoSite.primaryHostname, seedDemoSite.slug);

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'www',
  'mail',
  'dashboard',
  'support',
  'help',
  'billing',
  'auth',
  'login',
  'register',
  'status',
  'cdn',
  'assets',
  'static',
  'root',
  'system',
  'prachurjohost',
  'vercel',
  'sites',
]);

function renderErrorPage(title: string, message: string, slugOrHost: string, statusCode: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${statusCode} — ${title} | Prachurjo Host</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #F2F5FF 0%, #EEF2FF 50%, #F5F3FF 100%);
      color: #172033;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 20px;
      padding: 2.5rem;
      box-shadow: 0 20px 45px rgba(23, 32, 51, 0.06);
    }
    .code {
      font-family: monospace;
      font-size: 0.85rem;
      color: #4169F5;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    p {
      color: #64748B;
      line-height: 1.6;
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
    }
    .host {
      font-family: monospace;
      background: rgba(65, 105, 245, 0.08);
      color: #172033;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
      word-break: break-all;
    }
    a {
      display: inline-block;
      text-decoration: none;
      background: #4169F5;
      color: #ffffff;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 0.65rem 1.25rem;
      border-radius: 10px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="code">HTTP ${statusCode} · PRACHURJO HOST EDGE ROUTER</div>
    <h1>${title}</h1>
    <div class="host">${slugOrHost}</div>
    <p>${message}</p>
    <a href="/">Return to Prachurjo Host</a>
  </div>
</body>
</html>`;
}

function inlineSiteAssets(site: PublishedSiteBundle, htmlContent: string): string {
  let processed = htmlContent;
  // Inline relative CSS files stored in the bundle so standalone and path views always resolve styles cleanly
  for (const [name, file] of Object.entries(site.files)) {
    if (name.endsWith('.css')) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const linkRegex = new RegExp(`<link[^>]+href=["'](?:\\./|/)?${escaped}["'][^>]*>`, 'gi');
      processed = processed.replace(linkRegex, `<style data-file="${name}">\n${file.content}\n</style>`);
    } else if (name.endsWith('.js')) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const scriptRegex = new RegExp(`<script[^>]+src=["'](?:\\./|/)?${escaped}["'][^>]*>\\s*</script>`, 'gi');
      processed = processed.replace(scriptRegex, `<script data-file="${name}">\n${file.content}\n</script>`);
    }
  }
  return processed;
}

function setIsolatedTenantHeaders(res: Response, mimeType: string) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' data: blob: https://fonts.googleapis.com https://fonts.gstatic.com; frame-ancestors 'self';"
  );
  res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Multi-Tenant Hostname Resolver Middleware:
  // Maps incoming requests for "<slug>.prachurjohost.com" or verified custom domains to the tenant's published site
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incomingHost = (req.headers['x-forwarded-host'] || req.headers.host || '')
      .toString()
      .split(':')[0]
      .toLowerCase()
      .trim();

    if (
      incomingHost &&
      !incomingHost.includes('localhost') &&
      !incomingHost.includes('127.0.0.1') &&
      !incomingHost.endsWith('.run.app') &&
      incomingHost !== 'prachurjohost.vercel.app' &&
      incomingHost !== 'prachurjohost.com' &&
      incomingHost !== 'www.prachurjohost.com'
    ) {
      let resolvedSlug = hostnameToSlug.get(incomingHost);
      if (!resolvedSlug && incomingHost.endsWith('.prachurjohost.com')) {
        resolvedSlug = incomingHost.replace(/\.prachurjohost\.com$/, '');
      }
      if (resolvedSlug && !req.path.startsWith('/api/') && !req.path.startsWith('/sites/')) {
        req.url = `/sites/${resolvedSlug}${req.path === '/' ? '' : req.path}`;
      }
    }
    next();
  });

  // Health & Edge Router status
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      platform: 'Prachurjo Host',
      hostedSitesCached: publishedSitesBySlug.size,
      timestamp: new Date().toISOString(),
    });
  });

  // Domain validation & availability check endpoint
  app.post('/api/domains/check', (req: Request, res: Response) => {
    const rawSlug = String(req.body?.slug || '').toLowerCase().trim();
    const currentWebsiteId = String(req.body?.websiteId || '');

    if (!rawSlug || rawSlug.length < 3 || rawSlug.length > 48) {
      return res.status(400).json({
        available: false,
        reason: 'Slug must be between 3 and 48 characters.',
      });
    }
    if (!/^[a-z0-9-]+$/.test(rawSlug) || rawSlug.startsWith('-') || rawSlug.endsWith('-') || rawSlug.includes('--')) {
      return res.status(400).json({
        available: false,
        reason: 'Use only lowercase letters, numbers, and single hyphens.',
      });
    }
    if (RESERVED_SLUGS.has(rawSlug)) {
      return res.json({
        available: false,
        reason: `"${rawSlug}" is a reserved platform identifier.`,
      });
    }

    const existing = publishedSitesBySlug.get(rawSlug);
    if (existing && existing.websiteId !== currentWebsiteId) {
      return res.json({
        available: false,
        reason: `${rawSlug}.prachurjohost.com is already claimed by another website.`,
      });
    }

    return res.json({
      available: true,
      normalizedSlug: rawSlug,
      hostname: `${rawSlug}.prachurjohost.com`,
      publicPath: `/sites/${rawSlug}`,
    });
  });

  // Sync published website bundle to the Express multi-tenant edge router
  app.post('/api/sites/sync', (req: Request, res: Response) => {
    try {
      const bundle = req.body as PublishedSiteBundle;
      if (!bundle || !bundle.slug || !bundle.websiteId) {
        return res.status(400).json({ error: 'Invalid site bundle payload' });
      }
      const normalizedSlug = bundle.slug.toLowerCase().trim();
      publishedSitesBySlug.set(normalizedSlug, bundle);
      if (bundle.primaryHostname) {
        hostnameToSlug.set(bundle.primaryHostname.toLowerCase().trim(), normalizedSlug);
      }
      if (Array.isArray(bundle.customHostnames)) {
        for (const host of bundle.customHostnames) {
          hostnameToSlug.set(String(host).toLowerCase().trim(), normalizedSlug);
        }
      }
      return res.json({
        synced: true,
        slug: normalizedSlug,
        publicUrl: `/sites/${normalizedSlug}`,
        primaryHostname: bundle.primaryHostname,
      });
    } catch (error) {
      console.error('Error syncing published site:', error);
      return res.status(500).json({ error: 'Failed to sync published site' });
    }
  });

  // Update site status (e.g. SUSPEND / UNPUBLISH / ARCHIVE) on edge router
  app.patch('/api/sites/:slug/status', (req: Request, res: Response) => {
    const slug = String(req.params.slug || '').toLowerCase().trim();
    const status = req.body?.status;
    const existing = publishedSitesBySlug.get(slug);
    if (existing && status) {
      existing.status = status;
      publishedSitesBySlug.set(slug, existing);
    }
    return res.json({ updated: true, slug, status });
  });

  // List cached public sites metadata
  app.get('/api/sites', (_req: Request, res: Response) => {
    const list = Array.from(publishedSitesBySlug.values()).map((s) => ({
      websiteId: s.websiteId,
      name: s.name,
      slug: s.slug,
      primaryHostname: s.primaryHostname,
      status: s.status,
      versionNumber: s.versionNumber,
      publishedAt: s.publishedAt,
      fileCount: Object.keys(s.files || {}).length,
    }));
    res.json({ sites: list });
  });

  // Multi-Tenant Public Static Website Serving: /sites/:slug and /sites/:slug/:filePath
  app.get('/sites/:slug', (req: Request, res: Response) => {
    const slug = String(req.params.slug || '').toLowerCase().trim();
    const site = publishedSitesBySlug.get(slug);

    if (!site) {
      res.status(404);
      setIsolatedTenantHeaders(res, 'text/html; charset=utf-8');
      return res.send(
        renderErrorPage(
          'Website Not Found',
          'No published website is currently active at this address. If you are the owner, publish your project from the Prachurjo Host dashboard.',
          `${slug}.prachurjohost.com`,
          404
        )
      );
    }

    if (site.status === 'SUSPENDED') {
      res.status(403);
      setIsolatedTenantHeaders(res, 'text/html; charset=utf-8');
      return res.send(
        renderErrorPage(
          'Website Suspended',
          'This website has been suspended by a platform administrator due to policy or account restrictions.',
          site.primaryHostname,
          403
        )
      );
    }

    if (site.status !== 'PUBLISHED') {
      res.status(404);
      setIsolatedTenantHeaders(res, 'text/html; charset=utf-8');
      return res.send(
        renderErrorPage(
          'Website Not Published',
          'This website is currently in draft or archived mode and is not publicly accessible.',
          site.primaryHostname,
          404
        )
      );
    }

    const entryName = site.entryFile || 'index.html';
    const entryFile = site.files[entryName] || site.files['index.html'] || Object.values(site.files)[0];

    if (!entryFile) {
      res.status(404);
      setIsolatedTenantHeaders(res, 'text/html; charset=utf-8');
      return res.send(
        renderErrorPage(
          'Entry File Missing',
          `The configured entry point (${entryName}) was not found in the published deployment bundle.`,
          site.primaryHostname,
          404
        )
      );
    }

    setIsolatedTenantHeaders(res, 'text/html; charset=utf-8');
    return res.send(inlineSiteAssets(site, entryFile.content));
  });

  app.get('/sites/:slug/*', (req: Request, res: Response) => {
    const slug = String(req.params.slug || '').toLowerCase().trim();
    const rawWildcard = (req.params as Record<string, string | undefined>)[0] || '';
    const requestedFile = String(rawWildcard).replace(/^\/+/, '');

    // Reject path traversal attempts
    if (requestedFile.includes('..') || requestedFile.startsWith('/')) {
      res.status(400);
      setIsolatedTenantHeaders(res, 'text/html; charset=utf-8');
      return res.send(renderErrorPage('Invalid File Path', 'Path traversal is strictly forbidden.', requestedFile, 400));
    }

    const site = publishedSitesBySlug.get(slug);
    if (!site || site.status !== 'PUBLISHED') {
      res.status(404);
      setIsolatedTenantHeaders(res, 'text/html; charset=utf-8');
      return res.send(
        renderErrorPage('Asset Not Found', 'The requested website or static asset is not available.', `${slug}/${requestedFile}`, 404)
      );
    }

    const fileObj = site.files[requestedFile];
    if (!fileObj) {
      // Check if custom 404.html exists in tenant bundle
      const custom404 = site.files['404.html'];
      res.status(404);
      setIsolatedTenantHeaders(res, 'text/html; charset=utf-8');
      if (custom404) {
        return res.send(inlineSiteAssets(site, custom404.content));
      }
      return res.send(
        renderErrorPage(
          '404 — File Not Found',
          `The file "${requestedFile}" does not exist in version v${site.versionNumber} of ${site.name}.`,
          `${site.primaryHostname}/${requestedFile}`,
          404
        )
      );
    }

    setIsolatedTenantHeaders(res, fileObj.mimeType || 'text/plain; charset=utf-8');
    if (fileObj.mimeType.includes('html')) {
      return res.send(inlineSiteAssets(site, fileObj.content));
    }
    return res.send(fileObj.content);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Prachurjo Host server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
