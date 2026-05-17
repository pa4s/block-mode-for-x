/**
 * Handle parser utility
 */
import { SYSTEM_PATHS, HANDLE_REGEX } from './constants';

/**
 * Parse a handle from a profile URL path
 * @param path - URL path like "/username" or "https://x.com/username"
 * @returns cleaned handle string or null if invalid
 */
export function parseHandle(path: string): string | null {
  try {
    let cleanPath = path;

    // If it's a full URL, extract the pathname
    if (cleanPath.startsWith('http')) {
      const url = new URL(cleanPath);
      cleanPath = url.pathname;
    }

    // Remove leading slash and get first segment
    const segments = cleanPath.replace(/^\//, '').split('/');
    const handle = segments[0]?.toLowerCase();

    if (!handle) return null;

    // Filter out system paths
    if (SYSTEM_PATHS.has(handle)) return null;

    // Validate handle format
    if (!HANDLE_REGEX.test(handle)) return null;

    return handle;
  } catch {
    return null;
  }
}

/**
 * Extract handles from an article element
 */
export function extractHandleFromArticle(article: HTMLElement): { handle: string; displayName: string; profileUrl: string } | null {
  // Find profile links within the article
  const links = article.querySelectorAll('a[href]');

  for (const link of links) {
    const href = (link as HTMLAnchorElement).href;

    // Only look at x.com or twitter.com links
    if (!href.match(/https?:\/\/(x\.com|twitter\.com)\//)) continue;

    const handle = parseHandle(href);
    if (!handle) continue;

    // Check that this is a profile link (single path segment)
    try {
      const url = new URL(href);
      const pathSegments = url.pathname.replace(/^\//, '').split('/').filter(Boolean);
      if (pathSegments.length !== 1) continue;
    } catch {
      continue;
    }

    // Get display name from nearby elements
    const displayName = extractDisplayName(article, handle);

    return {
      handle,
      displayName,
      profileUrl: `https://x.com/${handle}`,
    };
  }

  return null;
}

/**
 * Try to extract display name from the article
 */
function extractDisplayName(article: HTMLElement, handle: string): string {
  // Try to find display name from user name spans
  const spans = article.querySelectorAll('span');
  for (const span of spans) {
    const text = span.textContent?.trim();
    if (text && !text.startsWith('@') && text !== handle && text.length > 0 && text.length < 50) {
      // Skip common UI text
      if (['·', '…', 'Show', 'more', 'Replying to'].includes(text)) continue;
      return text;
    }
  }
  return handle;
}
