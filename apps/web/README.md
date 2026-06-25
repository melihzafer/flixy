# @flixy/web

Progressive Web App (PWA) + static legal pages for **flixy.app**, deployed on Vercel.

It automatically builds and bundles the core swipe-based experience from `apps/mobile` for the web, injecting service-worker caching, metadata, and deep links to work as a standalone 1:1 match of the mobile experience.

## Features

- **PWA Service Worker:** Caches all app assets, CSS, JS, and Google Fonts for fully offline loading.
- **Offline Tolerance:** Matches the mobile app's database/state seams using AsyncStorage.
- **1:1 Code Sharing:** Bundles the exact same features and layouts from `apps/mobile` via React Native Web.
- **Dynamic Routing Fallbacks:** Set up on Vercel (`vercel.json`) to direct clean routes and dynamic segments (like `/title/:id`) to client-side routers.

## Build and Run

To run a production-like preview of the PWA locally:

```bash
# Build the PWA and service worker manifest
pnpm build:web

# Preview the built app locally on http://localhost:3000
pnpm --filter @flixy/web preview
```

To run the web app in hot-reloading development mode:

```bash
pnpm --filter @flixy/web dev
```

## Production Deployment on Vercel

1. Point your Vercel project at this repository.
2. Set **Root Directory** to `apps/web`.
3. Set **Framework Preset** to `Other` (or static).
4. Set **Build Command** to `pnpm build` (which runs `node scripts/build.js`).
5. Set **Output Directory** to `dist`.

Vercel headers, redirects, and client-side SPA routing rewrites are configured via `vercel.json`.

## Monorepo Ignored Build Step (Important)

By default, Vercel might cancel builds if it detects no changes were made directly in `apps/web`. Since the PWA compiles source files from `apps/mobile` and `packages/shared`, you must configure Vercel to build when these dependencies change.

In your **Vercel Project Settings** → **Git** → **Ignored Build Step**:
1. Select **Custom Command**.
2. Enter the following command:
   ```bash
   git diff --quiet HEAD^ HEAD -- ../mobile ../../packages/shared .
   ```
   *(This tells Vercel to trigger a build whenever changes occur in the mobile app, shared package, or web folder).*
