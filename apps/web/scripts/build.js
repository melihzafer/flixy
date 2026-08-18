const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const log = (...args) => console.warn(...args);

const webDir = path.resolve(__dirname, '..');
const mobileDir = path.resolve(webDir, '../mobile');
const distDir = path.resolve(webDir, 'dist');
const publicDir = path.resolve(webDir, 'public');
const MAX_PRECACHE_BYTES = 10 * 1024 * 1024;
const SITE_URL = 'https://flixy.app';
const SOCIAL_IMAGE_URL = `${SITE_URL}/icon-1024.png`;

const ROUTE_METADATA = {
  '/': {
    title: 'Flixy — Swipe. Discover. Watch.',
    description:
      'Find what to watch tonight. Swipe through movies and shows curated for your taste, then jump straight into your streaming app.',
  },
  '/privacy': {
    title: 'Privacy Policy — Flixy',
    description:
      'Learn what information Flixy collects, how it is used, and the choices you have over your account and recommendations.',
  },
  '/terms': {
    title: 'Terms of Service — Flixy',
    description: 'Review the terms for using Flixy, the movie and TV recommendation app.',
  },
  '/welcome': {
    title: 'Welcome to Flixy',
    description: 'Start discovering movies and TV shows with Flixy, or sign in to continue.',
  },
  '/sign-in': {
    title: 'Sign in — Flixy',
    description:
      'Sign in to Flixy to keep your movie and TV recommendations, swipes, and watchlist in sync.',
  },
  '/sign-up': {
    title: 'Create your Flixy account',
    description:
      'Create a Flixy account to save preferences, build a watchlist, and get movie and TV recommendations.',
  },
  '/reset-password': {
    title: 'Reset your Flixy password',
    description: 'Set a new Flixy password and get back to discovering movies and TV shows.',
  },
  '/change-password': {
    title: 'Change your Flixy password',
    description: 'Update the password for your Flixy account.',
  },
  '/auth/callback': {
    title: 'Finishing sign-in — Flixy',
    description:
      'Flixy is completing your sign-in and preparing your movie and TV recommendations.',
  },
  '/cold-start': {
    title: 'Choose your taste — Flixy',
    description: 'Tell Flixy what you like so your recommendations feel more personal.',
  },
  '/genres': {
    title: 'Choose genres — Flixy',
    description: 'Select the genres you enjoy to tune your Flixy recommendations.',
  },
  '/notifications': {
    title: 'Notifications — Flixy',
    description:
      'Choose whether Flixy can send notifications about your watchlist and recommendations.',
  },
  '/region': {
    title: 'Choose your region — Flixy',
    description: 'Set your region so Flixy can show relevant streaming availability.',
  },
  '/services': {
    title: 'Choose streaming services — Flixy',
    description: 'Select the streaming services you use to refine your Flixy recommendations.',
  },
  '/deck': {
    title: 'Discover movies and shows — Flixy',
    description:
      'Swipe through personalized movie and TV recommendations and save what you want to watch.',
  },
  '/search': {
    title: 'Search movies and shows — Flixy',
    description: 'Search Flixy for movies and TV shows and find where to watch them.',
  },
  '/watchlist': {
    title: 'Your watchlist — Flixy',
    description: 'Keep the movies and TV shows you want to watch in one place with Flixy.',
  },
  '/watchlist-triage': {
    title: 'Triage your watchlist — Flixy',
    description: 'Quickly sort the movies and TV shows saved to your Flixy watchlist.',
  },
  '/trailers': {
    title: 'Movie and TV trailers — Flixy',
    description: 'Browse movie and TV trailers before deciding what to watch next.',
  },
  '/profile': {
    title: 'Your profile — Flixy',
    description: 'View your Flixy profile and recommendation preferences.',
  },
  '/edit-profile': {
    title: 'Edit your profile — Flixy',
    description: 'Update your profile details in Flixy.',
  },
  '/paywall': {
    title: 'Flixy Premium',
    description:
      'Review Flixy Premium features and choose the plan that fits your discovery habits.',
  },
  '/settings': {
    title: 'Settings — Flixy',
    description: 'Manage your Flixy account, preferences, notifications, and streaming services.',
  },
  '/settings-account': {
    title: 'Account settings — Flixy',
    description: 'Manage your Flixy account details and sign-in settings.',
  },
  '/settings-genres': {
    title: 'Genre preferences — Flixy',
    description: 'Manage the genres that shape your Flixy recommendations.',
  },
  '/settings-help': {
    title: 'Help — Flixy',
    description: 'Find help with your Flixy account and movie discovery experience.',
  },
  '/settings-language': {
    title: 'Language settings — Flixy',
    description: 'Choose the language used in your Flixy experience.',
  },
  '/settings-notifications': {
    title: 'Notification settings — Flixy',
    description: 'Manage notification preferences for your Flixy account.',
  },
  '/settings-privacy': {
    title: 'Privacy settings — Flixy',
    description: 'Review privacy options for your Flixy account and app data.',
  },
  '/settings-promo': {
    title: 'Promo settings — Flixy',
    description: 'Manage promotional settings for your Flixy account.',
  },
  '/settings-region': {
    title: 'Region settings — Flixy',
    description: 'Manage your region for relevant Flixy streaming availability.',
  },
  '/settings-services': {
    title: 'Streaming service settings — Flixy',
    description: 'Manage the streaming services used to refine your Flixy recommendations.',
  },
  '/title/[id]': {
    title: 'Movie or TV show details — Flixy',
    description: 'Explore movie and TV show details, availability, and more with Flixy.',
  },
  '/+not-found': {
    title: 'Page not found — Flixy',
    description: 'The Flixy page you requested could not be found.',
  },
  '/_sitemap': {
    title: 'Flixy route map',
    description: 'A route map for the Flixy web app.',
  },
};

const INDEXABLE_ROUTES = new Set(['/', '/privacy', '/terms']);

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    log(`Cleaning directory: ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const childItemName of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function getAllFiles(dir, fileList = []) {
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function copyExpoFontAssets() {
  const expoAssetRoot = path.resolve(distDir, 'assets', '__node_modules');
  if (!fs.existsSync(expoAssetRoot)) return new Map();

  const fontDir = path.resolve(distDir, 'fonts');
  fs.mkdirSync(fontDir, { recursive: true });
  const fontAssets = new Map();
  const fontFiles = getAllFiles(expoAssetRoot).filter((file) =>
    /\.(?:ttf|otf|woff2?)$/i.test(file),
  );

  for (const sourceFile of fontFiles) {
    const fileName = path.basename(sourceFile);
    const targetFile = path.join(fontDir, fileName);
    const sourceUrl = `/assets/${path.relative(path.resolve(distDir, 'assets'), sourceFile).replace(/\\/g, '/')}`;
    fs.copyFileSync(sourceFile, targetFile);
    fontAssets.set(sourceUrl, `/fonts/${fileName}`);
  }

  return fontAssets;
}

function rewriteExpoFontUrls(content, fontAssets) {
  let rewrittenContent = content;
  for (const [sourceUrl, targetUrl] of fontAssets) {
    rewrittenContent = rewrittenContent.replaceAll(sourceUrl, targetUrl);
  }
  return rewrittenContent;
}

function routeFromHtmlFile(htmlFile) {
  const relativePath = path.relative(distDir, htmlFile).replace(/\\/g, '/');
  const segments = relativePath.split('/');
  const fileName = segments.pop() || '';
  const routeSegments = segments.filter((segment) => !/^\([^/]+\)$/.test(segment));
  const routeFileName = fileName.replace(/\.html$/i, '');

  if (routeFileName === 'index') {
    return routeSegments.length > 0 ? `/${routeSegments.join('/')}` : '/';
  }

  return `/${[...routeSegments, routeFileName].join('/')}`;
}

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

function routeMetadata(route) {
  if (ROUTE_METADATA[route]) return ROUTE_METADATA[route];

  const label = route
    .replace(/^\/+/, '')
    .replace(/\[id\]/g, 'title details')
    .replace(/[\/_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();

  return {
    title: `${label || 'Flixy'} — Flixy`,
    description: `Explore ${label || 'Flixy'} in the Flixy movie and TV discovery app.`,
  };
}

function injectSeoMetadata(content, htmlFile) {
  const route = routeFromHtmlFile(htmlFile);
  const metadata = routeMetadata(route);
  const canonicalUrl = `${SITE_URL}${route === '/' ? '/' : route}`;
  const robots = INDEXABLE_ROUTES.has(route) ? 'index, follow' : 'noindex, follow';

  const normalizedContent = content
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi, '')
    .replace(
      /<meta\b[^>]*(?:\b(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'])[^>]*\/?>\s*/gi,
      '',
    )
    .replace(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*\/?>\s*/gi, '');

  const seoTags = [
    `    <title>${escapeHtml(metadata.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `    <meta name="robots" content="${robots}" />`,
    `    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `    <meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    '    <meta property="og:type" content="website" />',
    `    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `    <meta property="og:image" content="${SOCIAL_IMAGE_URL}" />`,
    '    <meta property="og:image:alt" content="Flixy movie and TV discovery" />',
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
    `    <meta name="twitter:image" content="${SOCIAL_IMAGE_URL}" />`,
    '    <meta name="twitter:image:alt" content="Flixy movie and TV discovery" />',
  ].join('\n');

  if (normalizedContent.includes('</head>')) {
    return normalizedContent.replace('</head>', `${seoTags}\n  </head>`);
  }

  return `${seoTags}\n${normalizedContent}`;
}

function build() {
  log('--- Starting Flixy PWA Build Process ---');

  // 1. Clean output directory
  cleanDir(distDir);

  // 2. Build mobile app for web
  log('Building mobile app for web...');
  execSync('pnpm --filter @flixy/mobile exec expo export --platform web', {
    cwd: path.resolve(webDir, '../..'),
    stdio: 'inherit',
  });

  // 3. Copy mobile web build outputs to web/dist
  log('Copying mobile build to web/dist...');
  copyRecursiveSync(path.resolve(mobileDir, 'dist'), distDir);

  // 4. Copy public assets (PWA manifest, icons) to web/dist
  log('Copying PWA public assets...');
  copyRecursiveSync(publicDir, distDir);

  // 5. Copy static legal pages to web/dist (overwriting app versions if needed)
  log('Copying static pages (privacy, terms, css)...');
  fs.copyFileSync(path.resolve(webDir, 'privacy.html'), path.resolve(distDir, 'privacy.html'));
  fs.copyFileSync(path.resolve(webDir, 'terms.html'), path.resolve(distDir, 'terms.html'));
  fs.copyFileSync(path.resolve(webDir, 'styles.css'), path.resolve(distDir, 'styles.css'));

  // Expo's web export references fonts below a `.pnpm` path. Those files are
  // present in the bundle but dot-directories are not reliably served by web
  // hosts, so expose a clean public URL for every generated font asset.
  const fontAssets = copyExpoFontAssets();

  // 6. Gather all files in dist to generate precache list
  log('Generating service worker precache list...');
  const files = getAllFiles(distDir);
  const relativeAssets = files
    .map((file) => {
      const relPath = path.relative(distDir, file).replace(/\\/g, '/');
      return `/${relPath}`;
    })
    .filter((asset) => {
      // Navigation uses network-first with /index.html as its offline shell, so
      // generated route HTML is redundant in the install cache.
      return (
        !asset.endsWith('sw.js') &&
        !asset.endsWith('.map') &&
        !asset.endsWith('.html') &&
        !asset.endsWith('vercel.json') &&
        asset !== '/index.html'
      );
    });

  // Include core paths explicitly
  const precacheAssets = [
    ...new Set([
      '/',
      '/index.html',
      '/manifest.json',
      '/manifest.webmanifest',
      '/favicon.ico',
      '/apple-touch-icon.png',
      '/privacy.html',
      '/terms.html',
      ...relativeAssets,
    ]),
  ];
  const precacheBytes = precacheAssets.reduce((total, asset) => {
    const relativePath = asset === '/' ? 'index.html' : asset.slice(1);
    const assetPath = path.resolve(distDir, relativePath);
    return total + (fs.existsSync(assetPath) ? fs.statSync(assetPath).size : 0);
  }, 0);
  if (precacheBytes > MAX_PRECACHE_BYTES) {
    throw new Error(
      `PWA precache is ${(precacheBytes / 1024 / 1024).toFixed(2)} MiB; limit is ${
        MAX_PRECACHE_BYTES / 1024 / 1024
      } MiB.`,
    );
  }
  log(
    `PWA precache: ${precacheAssets.length} entries, ${(precacheBytes / 1024 / 1024).toFixed(2)} MiB`,
  );

  // 7. Write the Service Worker
  log('Writing sw.js...');
  const swCode = `
const CACHE_NAME = 'flixy-cache-v${Date.now()}';
const ASSETS = ${JSON.stringify(precacheAssets, null, 2)};

self.addEventListener('install', (event) => {
  // Take over immediately on the next load. Without skipWaiting a new SW
  // stays in "waiting" until EVERY window/tab of the app is fully closed —
  // installed PWAs often linger for days, so users kept running the previous
  // deploy's bundle no matter how many times they reopened the app.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell');
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // HTML / navigation requests: Network-first, fallback to /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          console.log('[Service Worker] Serving offline index.html fallback for', url.pathname);
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Other assets: Cache-first, fallback to network with dynamic caching
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache only public static assets. Never cache authenticated API
        // responses: Cache Storage keys do not vary by Authorization header,
        // which could expose one user's data to another session.
        if (
          response.status === 200 &&
          (url.origin === self.location.origin || url.hostname === 'image.tmdb.org')
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
`;
  fs.writeFileSync(path.resolve(distDir, 'sw.js'), swCode);

  // 8. Inject PWA manifest links & SW registration script into HTML files
  log('Injecting PWA links & script into HTML files...');
  const htmlFiles = files.filter((f) => f.endsWith('.html'));

  const pwaMetaTags = `
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="#0A0A0B" />
  `;

  const swRegisterScript = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then(reg => {
              console.log('[Flixy] Service Worker registered:', reg.scope);
              // Proactively look for a newer deploy on every open, not only
              // when the browser feels like revalidating sw.js.
              reg.update().catch(() => undefined);
            })
            .catch(err => console.error('[Flixy] Service Worker registration failed:', err));

          // When a new SW takes control (skipWaiting + clients.claim), the
          // page is still running the previous bundle — reload once so the
          // user actually gets the update they just downloaded. Guarded so
          // the very first install (no prior controller) never reloads and
          // repeated controllerchange events can't loop.
          const hadController = !!navigator.serviceWorker.controller;
          let refreshed = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!hadController || refreshed) return;
            refreshed = true;
            window.location.reload();
          });
        });
      }
    </script>
  `;

  for (const htmlFile of htmlFiles) {
    let content = fs.readFileSync(htmlFile, 'utf8');

    content = rewriteExpoFontUrls(content, fontAssets);

    // Add route-aware SEO metadata after Expo export, which leaves the title
    // empty in the static shell. Route groups are normalized so duplicate
    // exports share one clean canonical URL.
    content = injectSeoMetadata(content, htmlFile);

    // Inject manifest/theme tags into head
    if (content.includes('</head>') && !content.includes('manifest.json')) {
      content = content.replace('</head>', `${pwaMetaTags}</head>`);
    }

    // Inject SW registration script before body ends
    if (content.includes('</body>') && !content.includes('serviceWorker.register')) {
      content = content.replace('</body>', `${swRegisterScript}</body>`);
    } else if (!content.includes('serviceWorker.register')) {
      content += swRegisterScript;
    }

    fs.writeFileSync(htmlFile, content, 'utf8');
  }

  log('--- Flixy PWA Build Completed Successfully! ---');
}

build();
