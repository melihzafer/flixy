import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import type { Title } from '@flixy/shared';

/**
 * Central share plumbing. Every share surface (title detail, trailers feed,
 * watchlist) goes through here so links and copy stay consistent:
 *
 * - The primary link is Flixy's own web title page (opens the PWA), not a
 *   third-party TMDB/YouTube page — shares should market Flixy.
 * - The trailer stays available as a secondary link inside the message.
 * - Android ignores `Share.share({ url })`, so the message always embeds the
 *   links; iOS additionally gets the url for rich previews.
 */

export const WEB_APP_ORIGIN = 'https://flixy-web.vercel.app';

export function titleWebUrl(titleId: string): string {
  return `${WEB_APP_ORIGIN}/title/${titleId}`;
}

export function trailerUrl(title: Pick<Title, 'trailerKey'>): string | null {
  return title.trailerKey ? `https://www.youtube.com/watch?v=${title.trailerKey}` : null;
}

export type TitleShareLinks = {
  webUrl: string;
  trailerUrl: string | null;
};

export function titleShareLinks(title: Pick<Title, 'id' | 'trailerKey'>): TitleShareLinks {
  return {
    webUrl: titleWebUrl(title.id),
    trailerUrl: trailerUrl(title),
  };
}

export function buildShareMessage(
  displayTitle: string,
  year: string | number | null | undefined,
  links: TitleShareLinks,
): string {
  const lines = [
    `Flixy pick: ${displayTitle}${year ? ` (${year})` : ''}`,
    links.webUrl,
    links.trailerUrl ? `Trailer: ${links.trailerUrl}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

/**
 * Open the native share sheet. On web, RN's Share maps to `navigator.share`,
 * which is missing on desktop browsers — fall back to copying the message so
 * the button always does something useful.
 */
export async function shareTitleMessage(input: {
  title: string;
  message: string;
  url: string;
}): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && 'share' in nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title: input.title, text: input.message, url: input.url });
        return 'shared';
      } catch (error) {
        // AbortError = user closed the OS share sheet; anything else falls
        // through to the clipboard path.
        if ((error as Error | null)?.name === 'AbortError') return 'dismissed';
      }
    }
    return (await copyText(input.message)) ? 'copied' : 'failed';
  }

  try {
    await Share.share({
      title: input.title,
      message: input.message,
      // iOS-only; Android reads the message.
      url: input.url,
    });
    return 'shared';
  } catch {
    return 'dismissed';
  }
}
