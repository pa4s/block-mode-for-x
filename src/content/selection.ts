/**
 * Selection Manager - handles account selection state and UI
 */
import { XAccount } from '../shared/types';
import { extractHandleFromArticle } from '../shared/handle-parser';
import { getVisibleArticles, getAllArticles, getHandleForArticle } from './dom-parser';
import { t } from '../shared/i18n';

export class SelectionManager {
  private selectedHandles = new Set<string>();
  private isActive = false;
  private injectedArticles = new WeakSet<HTMLElement>();
  private injectedArticleElements = new Set<HTMLElement>();
  private articleClickHandlers = new WeakMap<HTMLElement, (e: MouseEvent) => void>();
  private lastRangeAnchor: HTMLElement | null = null;
  private onChangeCallbacks: Array<() => void> = [];

  get selected(): Set<string> {
    return this.selectedHandles;
  }

  get selectedCount(): number {
    return this.selectedHandles.size;
  }

  onChange(cb: () => void) {
    this.onChangeCallbacks.push(cb);
  }

  private notify() {
    this.onChangeCallbacks.forEach((cb) => cb());
  }

  /**
   * Inject select buttons into all articles
   */
  injectSelectButtons() {
    this.isActive = true;
    const articles = getAllArticles();
    articles.forEach((article) => this.injectButton(article));
  }

  /**
   * Inject a select button into a single article
   */
  injectButton(article: HTMLElement) {
    if (!this.isActive) return;
    if (this.injectedArticles.has(article)) return;

    const handle = getHandleForArticle(article);
    if (!handle) return;

    this.injectedArticles.add(article);
    this.injectedArticleElements.add(article);

    // Ensure relative positioning
    if (!article.classList.contains('bmx-article-wrapper')) {
      article.classList.add('bmx-article-wrapper');
    }

    // Create select button
    const btn = document.createElement('button');
    btn.className = 'bmx-select-btn';
    btn.dataset.bmxHandle = handle;
    btn.title = t('select.title', { handle });

    // Set initial state
    if (this.selectedHandles.has(handle)) {
      btn.classList.add('bmx-select-btn--selected');
      article.classList.add('bmx-article-selected');
      article.dataset.bmxSelectedLabel = t('selected.badge');
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleArticleSelection(article, handle, e.shiftKey);
    });

    article.insertBefore(btn, article.firstChild);

    const articleClickHandler = (e: MouseEvent) => {
      if (!this.isActive) return;
      if (this.shouldIgnoreArticleClick(e)) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.handleArticleSelection(article, handle, e.shiftKey);
    };

    article.addEventListener('click', articleClickHandler, true);
    this.articleClickHandlers.set(article, articleClickHandler);
  }

  /**
   * Add pasted handles or profile URLs to the current selection.
   */
  importHandles(input: string): { added: number; parsed: number; selectedTotal: number } {
    const handles = parseHandles(input);
    let added = 0;

    handles.forEach((handle) => {
      if (!this.selectedHandles.has(handle)) {
        this.selectedHandles.add(handle);
        this.updateArticleStates(handle);
        added++;
      }
    });

    if (added > 0) this.notify();

    return {
      added,
      parsed: handles.length,
      selectedTotal: this.selectedHandles.size,
    };
  }

  /**
   * Toggle selection of a handle
   */
  toggleHandle(handle: string) {
    if (this.selectedHandles.has(handle)) {
      this.selectedHandles.delete(handle);
    } else {
      this.selectedHandles.add(handle);
    }
    this.updateArticleStates(handle);
    this.notify();
  }

  /**
   * Toggle one article or select a range when Shift-clicking.
   */
  handleArticleSelection(article: HTMLElement, handle: string, isRangeSelection = false) {
    if (isRangeSelection && this.lastRangeAnchor && document.contains(this.lastRangeAnchor)) {
      const changed = this.selectRange(this.lastRangeAnchor, article);
      this.lastRangeAnchor = article;
      if (changed) this.notify();
      return;
    }

    this.toggleHandle(handle);
    this.lastRangeAnchor = article;
  }

  /**
   * Select a handle
   */
  selectHandle(handle: string) {
    if (!this.selectedHandles.has(handle)) {
      this.selectedHandles.add(handle);
      this.updateArticleStates(handle);
      this.notify();
    }
  }

  /**
   * Deselect a handle
   */
  deselectHandle(handle: string) {
    if (this.selectedHandles.has(handle)) {
      this.selectedHandles.delete(handle);
      this.updateArticleStates(handle);
      this.notify();
    }
  }

  /**
   * Remove a handle from selection (used by review panel)
   */
  removeHandle(handle: string) {
    this.deselectHandle(handle);
  }

  /**
   * Select all visible accounts
   */
  selectVisible(): number {
    const visibleArticles = getVisibleArticles();
    let changed = false;
    const handles = new Set<string>();
    for (const article of visibleArticles) {
      const handle = getHandleForArticle(article);
      if (handle && !this.selectedHandles.has(handle)) {
        this.selectedHandles.add(handle);
        this.updateArticleStates(handle);
        changed = true;
      }
      if (handle) handles.add(handle);
    }
    if (changed) this.notify();
    return handles.size;
  }

  /**
   * Deselect all visible accounts
   */
  deselectVisible(): number {
    const visibleArticles = getVisibleArticles();
    let changed = false;
    const handles = new Set<string>();
    for (const article of visibleArticles) {
      const handle = getHandleForArticle(article);
      if (handle && this.selectedHandles.has(handle)) {
        this.selectedHandles.delete(handle);
        this.updateArticleStates(handle);
        changed = true;
      }
      if (handle) handles.add(handle);
    }
    if (changed) this.notify();
    return handles.size;
  }

  /**
   * Select visible accounts, or deselect them when all visible accounts are already selected.
   */
  toggleVisibleSelection(): { selected: boolean; count: number } {
    const handles = this.getVisibleHandles();
    if (handles.length === 0) {
      return { selected: true, count: 0 };
    }

    const allSelected = handles.every((handle) => this.selectedHandles.has(handle));
    if (allSelected) {
      handles.forEach((handle) => {
        this.selectedHandles.delete(handle);
        this.updateArticleStates(handle);
      });
      this.notify();
      return { selected: false, count: handles.length };
    }

    handles.forEach((handle) => {
      this.selectedHandles.add(handle);
      this.updateArticleStates(handle);
    });
    this.notify();
    return { selected: true, count: handles.length };
  }

  areAllVisibleSelected(): boolean {
    const handles = this.getVisibleHandles();
    return handles.length > 0 && handles.every((handle) => this.selectedHandles.has(handle));
  }

  /**
   * Clear all selections
   */
  clearAll() {
    const handles = [...this.selectedHandles];
    this.selectedHandles.clear();
    handles.forEach((h) => this.updateArticleStates(h));
    this.lastRangeAnchor = null;
    this.notify();
  }

  /**
   * Get selected handles as array
   */
  getSelectedArray(): string[] {
    return [...this.selectedHandles];
  }

  /**
   * Copy handles to clipboard
   */
  async copyHandles(): Promise<number> {
    const handles = this.getSelectedArray().map((h) => `@${h}`);
    const text = handles.join('\n');
    await navigator.clipboard.writeText(text);
    return handles.length;
  }

  /**
   * Remove all injected buttons and styles
   */
  cleanup() {
    this.isActive = false;

    this.injectedArticleElements.forEach((article) => {
      const clickHandler = this.articleClickHandlers.get(article);
      if (clickHandler) {
        article.removeEventListener('click', clickHandler, true);
      }
      article.classList.remove('bmx-article-wrapper', 'bmx-article-selected');
      delete article.dataset.bmxSelectedLabel;
    });

    // Remove select buttons
    document.querySelectorAll('.bmx-select-btn').forEach((el) => el.remove());

    // Clean up any visible leftovers from articles that were re-rendered by X.
    document.querySelectorAll('.bmx-article-wrapper').forEach((el) => {
      const article = el as HTMLElement;
      const clickHandler = this.articleClickHandlers.get(article);
      if (clickHandler) {
        article.removeEventListener('click', clickHandler, true);
        this.articleClickHandlers.delete(article);
      }
      article.classList.remove('bmx-article-wrapper', 'bmx-article-selected');
      delete article.dataset.bmxSelectedLabel;
    });
    this.injectedArticles = new WeakSet();
    this.injectedArticleElements = new Set();
    this.articleClickHandlers = new WeakMap();
    this.lastRangeAnchor = null;
  }

  private shouldIgnoreArticleClick(e: MouseEvent): boolean {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) {
      return true;
    }

    const target = e.target;
    if (!(target instanceof Element)) return true;

    if (target.closest('.bmx-select-btn')) return true;

    return Boolean(target.closest([
      'a[href]',
      'button',
      'input',
      'textarea',
      'select',
      'label',
      'summary',
      'video',
      'audio',
      'img',
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[data-testid="card.wrapper"]',
      '[data-testid="tweetPhoto"]',
      '[data-testid="videoPlayer"]',
    ].join(',')));
  }

  private updateArticleStates(handle: string) {
    const isSelected = this.selectedHandles.has(handle);
    const buttons = document.querySelectorAll(`.bmx-select-btn[data-bmx-handle="${handle}"]`);

    buttons.forEach((btn) => {
      btn.classList.toggle('bmx-select-btn--selected', isSelected);

      // Find parent article
      const article = btn.closest('article');
      if (article) {
        article.classList.toggle('bmx-article-selected', isSelected);
        if (isSelected) {
          (article as HTMLElement).dataset.bmxSelectedLabel = t('selected.badge');
        } else {
          delete (article as HTMLElement).dataset.bmxSelectedLabel;
        }
      }
    });
  }

  private selectRange(fromArticle: HTMLElement, toArticle: HTMLElement): boolean {
    const articles = getAllArticles();
    const fromIndex = articles.indexOf(fromArticle);
    const toIndex = articles.indexOf(toArticle);
    if (fromIndex === -1 || toIndex === -1) return false;

    const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    let changed = false;
    for (const article of articles.slice(start, end + 1)) {
      const handle = getHandleForArticle(article);
      if (handle && !this.selectedHandles.has(handle)) {
        this.selectedHandles.add(handle);
        this.updateArticleStates(handle);
        changed = true;
      }
    }
    return changed;
  }

  private getVisibleHandles(): string[] {
    const handles = new Set<string>();
    getVisibleArticles().forEach((article) => {
      const handle = getHandleForArticle(article);
      if (handle) handles.add(handle);
    });
    return [...handles];
  }
}

function parseHandles(input: string): string[] {
  const handles = new Set<string>();
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?=[/?#\s,，;；、.)\]]|$)/gi;
  const mentionRegex = /(^|[^\w])@([A-Za-z0-9_]{1,15})(?![\w])/g;

  for (const match of input.matchAll(urlRegex)) {
    addHandle(handles, match[1]);
  }

  for (const match of input.matchAll(mentionRegex)) {
    addHandle(handles, match[2]);
  }

  const looseText = input
    .replace(urlRegex, ' ')
    .replace(mentionRegex, ' ')
    .replace(/[，、；;,\n\r\t]+/g, ' ');

  looseText.split(/\s+/).forEach((token) => {
    const handle = token
      .replace(/^@/, '')
      .replace(/^[^A-Za-z0-9_]+|[^A-Za-z0-9_]+$/g, '');
    addHandle(handles, handle);
  });

  return [...handles];
}

function addHandle(handles: Set<string>, handle: string | undefined) {
  if (!handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return;

  const normalized = handle.toLowerCase();
  if (RESERVED_X_PATHS.has(normalized)) return;
  handles.add(normalized);
}

const RESERVED_X_PATHS = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'settings',
  'search',
  'compose',
  'intent',
  'share',
  'i',
  'hashtag',
]);
