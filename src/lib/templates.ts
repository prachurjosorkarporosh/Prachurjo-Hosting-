import JSZip from 'jszip';
import { StarterTemplateId, StorageObject } from '../types';

export interface TemplateFileSeed {
  fileName: string;
  mimeType: string;
  content: string;
}

export interface StarterTemplateDefinition {
  id: StarterTemplateId;
  name: string;
  nameBn: string;
  category: string;
  description: string;
  files: TemplateFileSeed[];
}

export const RESERVED_PLATFORM_NAMES = new Set([
  'admin',
  'administrator',
  'api',
  'auth',
  'login',
  'logout',
  'register',
  'signup',
  'dashboard',
  'console',
  'www',
  'mail',
  'smtp',
  'imap',
  'pop',
  'ftp',
  'support',
  'help',
  'billing',
  'wallet',
  'status',
  'cdn',
  'assets',
  'static',
  'public',
  'private',
  'root',
  'system',
  'prachurjo',
  'prachurjohost',
  'vercel',
  'sites',
  'security',
  'terms',
  'privacy',
]);

export const FORBIDDEN_EXTENSIONS = new Set([
  '.php',
  '.phtml',
  '.php3',
  '.php4',
  '.php5',
  '.phps',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.pyc',
  '.pl',
  '.rb',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.jsp',
  '.jspx',
  '.asp',
  '.aspx',
  '.cgi',
  '.fcgi',
  '.env',
  '.htaccess',
  '.htpasswd',
  '.sql',
  '.sqlite',
]);

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validateWebsiteSlug(slug: string): { valid: boolean; error?: string } {
  const clean = slug.toLowerCase().trim();
  if (clean.length < 3) {
    return { valid: false, error: 'Website address slug must be at least 3 characters long.' };
  }
  if (clean.length > 48) {
    return { valid: false, error: 'Website address slug cannot exceed 48 characters.' };
  }
  if (!/^[a-z0-9-]+$/.test(clean)) {
    return { valid: false, error: 'Only lowercase letters (a-z), numbers (0-9), and hyphens (-) are permitted.' };
  }
  if (clean.startsWith('-') || clean.endsWith('-') || clean.includes('--')) {
    return { valid: false, error: 'Slug cannot start/end with a hyphen or contain consecutive hyphens.' };
  }
  if (RESERVED_PLATFORM_NAMES.has(clean)) {
    return { valid: false, error: `"${clean}" is a reserved platform route and cannot be claimed.` };
  }
  return { valid: true };
}

export function validateCustomDomainHostname(hostname: string): { valid: boolean; error?: string } {
  const clean = hostname.toLowerCase().trim();
  if (clean.length < 4 || clean.length > 160) {
    return { valid: false, error: 'Custom domain must be between 4 and 160 characters.' };
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean) || clean.includes('..') || clean.startsWith('.') || clean.startsWith('-')) {
    return { valid: false, error: 'Enter a valid fully-qualified domain name (e.g., studio.example.com).' };
  }
  if (clean.endsWith('.vercel.app')) {
    return {
      valid: false,
      error: 'Arbitrary subdomains under vercel.app are not permitted. Use *.prachurjohost.com or your own custom domain.',
    };
  }
  return { valid: true };
}

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx).toLowerCase();
}

export function validateSafeFilePath(rawPath: string): { valid: boolean; normalizedPath: string; error?: string } {
  const cleaned = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!cleaned) {
    return { valid: false, normalizedPath: '', error: 'Empty file name is not allowed.' };
  }
  if (cleaned.includes('..') || cleaned.includes('./') || cleaned.startsWith('/')) {
    return { valid: false, normalizedPath: cleaned, error: `Path traversal rejected in "${rawPath}".` };
  }
  const segments = cleaned.split('/');
  for (const seg of segments) {
    if (!seg || seg.startsWith('.') || !/^[a-zA-Z0-9._-]+$/.test(seg)) {
      return {
        valid: false,
        normalizedPath: cleaned,
        error: `Invalid or hidden path segment "${seg}". Use alphanumeric characters, dots, underscores, or hyphens.`,
      };
    }
  }
  const ext = getExtension(cleaned);
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      normalizedPath: cleaned,
      error: `Server-side or executable script "${cleaned}" (${ext}) is strictly prohibited.`,
    };
  }
  if (!ALLOWED_EXTENSIONS[ext]) {
    return {
      valid: false,
      normalizedPath: cleaned,
      error: `Unsupported file type "${ext}" in "${cleaned}". Allowed formats: HTML, CSS, JS, JSON, SVG, TXT, MD.`,
    };
  }
  return { valid: true, normalizedPath: cleaned };
}

export interface ZipExtractionResult {
  valid: boolean;
  files: TemplateFileSeed[];
  totalBytes: number;
  errors: string[];
  hasIndexHtml: boolean;
}

export async function validateAndExtractZipArchive(
  file: File,
  maxCompressedMb = 10,
  maxExtractedMb = 15,
  maxFileCount = 40
): Promise<ZipExtractionResult> {
  const errors: string[] = [];
  const maxCompressedBytes = maxCompressedMb * 1024 * 1024;
  const maxExtractedBytes = maxExtractedMb * 1024 * 1024;

  if (file.size > maxCompressedBytes) {
    return {
      valid: false,
      files: [],
      totalBytes: 0,
      errors: [`Archive size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the ${maxCompressedMb} MB limit.`],
      hasIndexHtml: false,
    };
  }

  let zip: JSZip;
  try {
    const buffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return {
      valid: false,
      files: [],
      totalBytes: 0,
      errors: ['Malformed or corrupted ZIP archive. Could not parse central directory.'],
      hasIndexHtml: false,
    };
  }

  const rawEntries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.includes('__MACOSX') && !entry.name.endsWith('.DS_Store'));

  if (rawEntries.length === 0) {
    return {
      valid: false,
      files: [],
      totalBytes: 0,
      errors: ['The uploaded ZIP archive contains no files.'],
      hasIndexHtml: false,
    };
  }

  if (rawEntries.length > maxFileCount) {
    return {
      valid: false,
      files: [],
      totalBytes: 0,
      errors: [`Archive contains ${rawEntries.length} files, exceeding the ${maxFileCount}-file security limit.`],
      hasIndexHtml: false,
    };
  }

  // Strip common single top-level folder prefix if all files share one
  const splitPaths = rawEntries.map((e) => e.name.replace(/\\/g, '/').replace(/^\/+/, ''));
  let commonRoot = '';
  if (splitPaths.every((p) => p.includes('/'))) {
    const firstRoot = splitPaths[0].split('/')[0] + '/';
    if (splitPaths.every((p) => p.startsWith(firstRoot))) {
      commonRoot = firstRoot;
    }
  }

  const extractedFiles: TemplateFileSeed[] = [];
  let totalBytes = 0;

  for (const entry of rawEntries) {
    if (entry.name.includes('..') || entry.name.startsWith('/')) {
      errors.push(`Path traversal attempt blocked: "${entry.name}"`);
      continue;
    }

    const relativePath = commonRoot && entry.name.startsWith(commonRoot) ? entry.name.slice(commonRoot.length) : entry.name;
    const pathValidation = validateSafeFilePath(relativePath);
    if (!pathValidation.valid) {
      errors.push(pathValidation.error || `Rejected file: ${relativePath}`);
      continue;
    }

    const content = await entry.async('string');
    const byteLength = new Blob([content]).size;
    totalBytes += byteLength;

    if (totalBytes > maxExtractedBytes) {
      return {
        valid: false,
        files: [],
        totalBytes,
        errors: [`Archive extraction aborted: uncompressed payload exceeds ${maxExtractedMb} MB limit (potential zip bomb).`],
        hasIndexHtml: false,
      };
    }

    if (byteLength > 450000) {
      errors.push(`File "${pathValidation.normalizedPath}" exceeds per-file 450 KB limit.`);
      continue;
    }

    const ext = getExtension(pathValidation.normalizedPath);
    extractedFiles.push({
      fileName: pathValidation.normalizedPath,
      mimeType: ALLOWED_EXTENSIONS[ext] || 'text/plain; charset=utf-8',
      content,
    });
  }

  const hasIndexHtml = extractedFiles.some((f) => f.fileName === 'index.html' || f.fileName.endsWith('.html'));
  if (!hasIndexHtml) {
    errors.push('Archive must include an index.html file (or at least one valid .html entry point).');
  }

  return {
    valid: errors.length === 0 && extractedFiles.length > 0 && hasIndexHtml,
    files: extractedFiles,
    totalBytes,
    errors,
    hasIndexHtml,
  };
}

export function compileSandboxedPreviewHtml(files: StorageObject[] | TemplateFileSeed[], entryFileName = 'index.html'): string {
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(f.fileName, f.content);
  }

  const entryHtml =
    fileMap.get(entryFileName) ||
    fileMap.get('index.html') ||
    files.find((f) => f.fileName.endsWith('.html'))?.content ||
    '<!DOCTYPE html><html><body><p>No HTML entry file found.</p></body></html>';

  let compiled = entryHtml;
  for (const [name, content] of fileMap.entries()) {
    if (name.endsWith('.css')) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const linkRegex = new RegExp(`<link[^>]+href=["'](?:\\./|/)?${escaped}["'][^>]*>`, 'gi');
      compiled = compiled.replace(linkRegex, `<style data-source="${name}">\n${content}\n</style>`);
    } else if (name.endsWith('.js')) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const scriptRegex = new RegExp(`<script[^>]+src=["'](?:\\./|/)?${escaped}["'][^>]*>\\s*</script>`, 'gi');
      compiled = compiled.replace(scriptRegex, `<script data-source="${name}">\n${content}\n</script>`);
    }
  }
  return compiled;
}

export const STARTER_TEMPLATES: StarterTemplateDefinition[] = [
  {
    id: 'blank',
    name: 'Blank HTML5 Starter',
    nameBn: 'ব্ল্যাঙ্ক HTML5 স্টার্টার',
    category: 'Minimal Foundation',
    description: 'Clean, standards-compliant HTML5, CSS3, and JavaScript boilerplate ready for custom architecture.',
    files: [
      {
        fileName: 'index.html',
        mimeType: 'text/html; charset=utf-8',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Website — Hosted on Prachurjo Host</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="shell">
    <div class="card">
      <p class="kicker">Prachurjo Host · Static Deployment</p>
      <h1>Hello, World.</h1>
      <p class="lead">Edit <code>index.html</code>, <code>styles.css</code>, and <code>app.js</code> in the Online Editor to customize your website before publishing.</p>
      <button id="actionBtn">Test Interactive Script</button>
      <p id="statusMsg" class="status"></p>
    </div>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        fileName: 'styles.css',
        mimeType: 'text/css; charset=utf-8',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #F2F5FF;
  color: #172033;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
}
.card {
  max-width: 560px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(65, 105, 245, 0.2);
  border-radius: 18px;
  padding: 2.5rem;
  box-shadow: 0 20px 40px rgba(23, 32, 51, 0.06);
}
.kicker {
  font-size: 0.8rem;
  font-weight: 600;
  color: #4169F5;
  margin-bottom: 0.5rem;
}
h1 {
  font-size: 2.25rem;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
}
.lead {
  color: #64748B;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}
code {
  background: rgba(65, 105, 245, 0.08);
  padding: 0.15rem 0.4rem;
  border-radius: 5px;
  font-size: 0.9em;
}
button {
  background: #4169F5;
  color: #ffffff;
  border: none;
  padding: 0.7rem 1.25rem;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
button:hover {
  background: #3156d8;
}
.status {
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #16A34A;
  font-family: monospace;
}`,
      },
      {
        fileName: 'app.js',
        mimeType: 'application/javascript; charset=utf-8',
        content: `const btn = document.getElementById('actionBtn');
const msg = document.getElementById('statusMsg');

if (btn && msg) {
  btn.addEventListener('click', () => {
    msg.textContent = 'Client runtime active · ' + new Date().toLocaleTimeString();
  });
}`,
      },
    ],
  },
  {
    id: 'portfolio',
    name: 'Personal Portfolio',
    nameBn: 'পার্সোনাল পোর্টফোলিও',
    category: 'Creative & Developer',
    description: 'Editorial portfolio layout with project showcase grid, technical skill breakdown, and contact section.',
    files: [
      {
        fileName: 'index.html',
        mimeType: 'text/html; charset=utf-8',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Developer Portfolio — Hosted on Prachurjo Host</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="nav">
    <div class="brand">Arif Rahman</div>
    <nav class="links">
      <a href="#work">Selected Work</a>
      <a href="#stack">Capabilities</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <main class="container">
    <section class="hero">
      <p class="meta">Full-Stack Engineer · Dhaka, Bangladesh</p>
      <h1>Designing resilient web systems and high-clarity interfaces.</h1>
      <p class="subtitle">Focused on distributed systems, accessible design systems, and fast static architectures.</p>
    </section>

    <section id="work" class="grid">
      <article class="project">
        <span class="num">01 · FinTech Ledger</span>
        <h2>Real-Time Settlement Console</h2>
        <p>Sub-second transaction reconciliation engine handling 40,000 daily merchant settlements.</p>
      </article>
      <article class="project">
        <span class="num">02 · Cloud Tooling</span>
        <h2>Static Edge Deployer</h2>
        <p>Zero-configuration static asset bundler with automated checksum verification.</p>
      </article>
    </section>

    <footer id="contact" class="footer">
      <p>Available for select architectural consulting · <span id="yearLabel">2026</span></p>
    </footer>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        fileName: 'styles.css',
        mimeType: 'text/css; charset=utf-8',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #F8FAFC; color: #0F172A; line-height: 1.6; }
.nav { max-width: 960px; margin: 0 auto; padding: 1.75rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; }
.brand { font-weight: 700; font-size: 1.1rem; }
.links { display: flex; gap: 1.5rem; }
.links a { color: #475569; text-decoration: none; font-size: 0.9rem; font-weight: 500; }
.links a:hover { color: #4169F5; }
.container { max-width: 960px; margin: 0 auto; padding: 4rem 1.5rem; }
.meta { color: #4169F5; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.75rem; }
.hero h1 { font-size: clamp(2rem, 4vw, 3.25rem); line-height: 1.15; letter-spacing: -0.03em; margin-bottom: 1rem; max-width: 720px; }
.subtitle { color: #64748B; font-size: 1.1rem; max-width: 600px; margin-bottom: 3.5rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 4rem; }
.project { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 2rem; }
.num { font-family: monospace; font-size: 0.8rem; color: #64748B; display: block; margin-bottom: 0.5rem; }
.project h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
.project p { color: #475569; font-size: 0.95rem; }
.footer { padding-top: 2rem; border-top: 1px solid #E2E8F0; color: #64748B; font-size: 0.875rem; }`,
      },
      {
        fileName: 'app.js',
        mimeType: 'application/javascript; charset=utf-8',
        content: `const yearEl = document.getElementById('yearLabel');
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}`,
      },
    ],
  },
  {
    id: 'saas',
    name: 'SaaS Product Landing',
    nameBn: 'SaaS প্রোডাক্ট ল্যান্ডিং পেজ',
    category: 'Product & Startup',
    description: 'Conversion-focused software launch page with interactive pricing calculator and metric proof strip.',
    files: [
      {
        fileName: 'index.html',
        mimeType: 'text/html; charset=utf-8',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PulseMetrics — Cloud Telemetry</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <span class="logo">PulseMetrics</span>
    <a href="#pricing" class="cta-sm">View Plans</a>
  </header>
  <main class="wrap">
    <section class="hero">
      <h1>Observe every edge request with zero configuration overhead.</h1>
      <p>Built for engineering teams that demand deterministic latency reporting and instant anomaly alerts.</p>
    </section>
    <section id="pricing" class="calculator">
      <h2>Estimate Monthly Volume</h2>
      <input id="reqSlider" type="range" min="10" max="500" value="100" />
      <p class="calc-out"><span id="reqCount">100</span>k requests / mo — <strong>$<span id="priceOut">29</span>/mo</strong></p>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        fileName: 'styles.css',
        mimeType: 'text/css; charset=utf-8',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #0B0F19; color: #F8FAFC; min-height: 100vh; }
.topbar { max-width: 920px; margin: 0 auto; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
.logo { font-weight: 700; color: #60A5FA; }
.cta-sm { background: #4169F5; color: #fff; text-decoration: none; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; }
.wrap { max-width: 920px; margin: 0 auto; padding: 4rem 1.5rem; }
.hero h1 { font-size: clamp(2rem, 4vw, 3rem); margin-bottom: 1rem; line-height: 1.15; }
.hero p { color: #94A3B8; font-size: 1.1rem; max-width: 600px; margin-bottom: 3rem; }
.calculator { background: rgba(30,41,59,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2rem; max-width: 520px; }
.calculator h2 { font-size: 1.2rem; margin-bottom: 1rem; }
input[type=range] { width: 100%; margin-bottom: 1rem; }
.calc-out { font-family: monospace; color: #E2E8F0; font-size: 1rem; }`,
      },
      {
        fileName: 'app.js',
        mimeType: 'application/javascript; charset=utf-8',
        content: `const slider = document.getElementById('reqSlider');
const reqCount = document.getElementById('reqCount');
const priceOut = document.getElementById('priceOut');

if (slider && reqCount && priceOut) {
  slider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    reqCount.textContent = String(val);
    priceOut.textContent = String(Math.round(val * 0.29));
  });
}`,
      },
    ],
  },
  {
    id: 'linkbio',
    name: 'Creator Link-in-Bio Hub',
    nameBn: 'ক্রিয়েটর লিংক-ইন-বায়ো',
    category: 'Social & Creator',
    description: 'Clean glassmorphic profile card with verified social links, newsletter prompt, and portfolio shortcuts.',
    files: [
      {
        fileName: 'index.html',
        mimeType: 'text/html; charset=utf-8',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Creator Links — Prachurjo Host</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="hub">
    <div class="avatar">PS</div>
    <h1>Prachurjo Studio</h1>
    <p class="bio">Building modern web tools, open-source UI kits, and cloud hosting platforms.</p>
    <div class="links">
      <a href="https://prachurjohost.vercel.app" target="_blank" rel="noopener">Launch Website on Prachurjo Host</a>
      <a href="#projects">Read Technical Architecture Notes</a>
      <a href="#newsletter" id="copyEmailBtn">Copy Studio Contact Email</a>
    </div>
    <p id="copiedToast" class="toast"></p>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        fileName: 'styles.css',
        mimeType: 'text/css; charset=utf-8',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: linear-gradient(135deg, #F2F5FF 0%, #EDE9FE 100%); color: #172033; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; }
.hub { max-width: 420px; width: 100%; background: rgba(255,255,255,0.8); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.9); border-radius: 24px; padding: 2.25rem 1.75rem; text-align: center; box-shadow: 0 20px 40px rgba(23,32,51,0.06); }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: #4169F5; color: #fff; font-weight: 700; display: grid; place-items: center; margin: 0 auto 1rem; font-size: 1.25rem; }
h1 { font-size: 1.35rem; margin-bottom: 0.4rem; }
.bio { color: #64748B; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem; }
.links { display: flex; flex-direction: column; gap: 0.75rem; }
.links a { display: block; padding: 0.85rem 1rem; background: #fff; border: 1px solid rgba(65,105,245,0.18); border-radius: 12px; color: #172033; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: transform 0.15s ease; }
.links a:hover { transform: translateY(-2px); border-color: #4169F5; color: #4169F5; }
.toast { margin-top: 1rem; font-size: 0.8rem; color: #16A34A; font-family: monospace; min-height: 1.2em; }`,
      },
      {
        fileName: 'app.js',
        mimeType: 'application/javascript; charset=utf-8',
        content: `const btn = document.getElementById('copyEmailBtn');
const toast = document.getElementById('copiedToast');
if (btn && toast) {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toast.textContent = 'Contact: support@prachurjohost.com';
  });
}`,
      },
    ],
  },
];
