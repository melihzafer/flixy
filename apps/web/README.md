# @flixy/web

Static landing page for **flixy.app**, deployed on Vercel.

## Pages

- `index.html` — hero with App Store / Play Store badges
- `privacy.html` — privacy policy
- `terms.html` — terms of service

## Local preview

Open `apps/web/index.html` in a browser, or:

```bash
npx serve apps/web
```

## Deploy

1. Create a Vercel project pointing at this repo.
2. Set **Root Directory** to `apps/web`.
3. **Framework preset:** Other (static).
4. **Build command:** _(leave empty)_
5. **Output directory:** `.`

Vercel headers / redirects are configured via `vercel.json`.

## Why static, not Next.js?

See `docs/DECISIONS.md` DEC-019. Short version: a static landing page costs
nothing to host, has zero build time, and ships today. The moment we need a
dynamic feature (waitlist form, blog, locale routing) we will upgrade in a
single PR; nothing on this page locks us in.
