/**
 * DOM Parser - Scans X page for articles and extracts account info
 */
import { XAccount } from '../shared/types';
import { extractHandleFromArticle } from '../shared/handle-parser';

/**
 * Scan all visible article elements on the page
 */
export function scanArticles(): Map<string, XAccount> {
  const accounts = new Map<string, XAccount>();
  const articles = document.querySelectorAll('article');

  for (const article of articles) {
    const result = extractHandleFromArticle(article as HTMLElement);
    if (!result) continue;

    const existing = accounts.get(result.handle);
    if (!existing) {
      accounts.set(result.handle, {
        handle: result.handle,
        displayName: result.displayName,
        profileUrl: result.profileUrl,
        articleElement: article as HTMLElement,
        selected: false,
      });
    }
  }

  return accounts;
}

/**
 * Get all article elements on the page
 */
export function getAllArticles(): HTMLElement[] {
  return Array.from(document.querySelectorAll('article'));
}

/**
 * Get articles currently visible in viewport
 */
export function getVisibleArticles(): HTMLElement[] {
  const articles = getAllArticles();
  return articles.filter((article) => {
    const rect = article.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.height > 0
    );
  });
}

/**
 * Get the handle for a specific article element
 */
export function getHandleForArticle(article: HTMLElement): string | null {
  const result = extractHandleFromArticle(article);
  return result?.handle ?? null;
}

/**
 * Setup MutationObserver to watch for new articles
 */
export function observeNewArticles(callback: (articles: HTMLElement[]) => void): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    const newArticles: HTMLElement[] = [];

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.tagName === 'ARTICLE') {
            newArticles.push(node);
          }
          const nested = node.querySelectorAll('article');
          for (const a of nested) {
            newArticles.push(a as HTMLElement);
          }
        }
      }
    }

    if (newArticles.length > 0) {
      callback(newArticles);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
