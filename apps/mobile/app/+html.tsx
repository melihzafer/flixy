import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function HTML({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* PWA elements */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0A0A0B" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Service Worker Registration */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: SW registration script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('[Flixy] Service Worker registered:', reg.scope))
                    .catch(err => console.error('[Flixy] Service Worker registration failed:', err));
                });
              }
            `,
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
