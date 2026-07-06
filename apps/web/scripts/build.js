const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const log = (...args) => console.warn(...args);

const webDir = path.resolve(__dirname, '..');
const mobileDir = path.resolve(webDir, '../mobile');
const distDir = path.resolve(webDir, 'dist');
const publicDir = path.resolve(webDir, 'public');
const MAX_PRECACHE_BYTES = 10 * 1024 * 1024;

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
            .then(reg => console.log('[Flixy] Service Worker registered:', reg.scope))
            .catch(err => console.error('[Flixy] Service Worker registration failed:', err));
        });
      }
    </script>
  `;

  for (const htmlFile of htmlFiles) {
    let content = fs.readFileSync(htmlFile, 'utf8');

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
