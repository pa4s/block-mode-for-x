/**
 * Toolbar - Right-side floating toolbar with all mode panels
 */
import { AppMode, ActionType, QueueItem, DoneReport, PersistedQueueState, ActionHistoryEntry } from '../shared/types';
import { SelectionManager } from './selection';
import { getLanguage, t } from '../shared/i18n';

/** SVG Icons */
const ICONS = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
  block: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M18 9l4 6"/><path d="M22 9l-4 6"/></svg>`,
  review: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8l2 2v14H6V6l2-2z"/><path d="M9 10h6"/><path d="M9 14h6"/><path d="M9 18h4"/></svg>`,
  import: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/><path d="M5 6h3"/><path d="M16 6h3"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>`,
};

const EXTENSION_ICON_URL = chrome.runtime.getURL('icons/icon48.png');
const HISTORY_STORAGE_KEY = 'bmxActionHistory';
type FloatingState = 'normal' | 'compact' | 'hidden';

export class Toolbar {
  private container: HTMLDivElement;
  private mode: AppMode = 'normal';
  private floatingState: FloatingState = 'normal';
  private floatingCenterY: number | null = null;
  private suppressFloatingClickUntil = 0;
  private selection: SelectionManager;
  private actionType: ActionType = 'block';
  private queue: QueueItem[] = [];
  private queueIndex = 0;
  private doneReport: DoneReport | null = null;

  // Callbacks
  public onStartBlockMode?: () => void;
  public onExitBlockMode?: () => void;
  public onBlockSelected?: () => void;
  public onMuteSelected?: () => void;
  public onStartQueue?: (actionType: ActionType) => void;
  public onOpenProfile?: (url: string) => void;
  public onMarkDone?: () => void;
  public onSkip?: () => void;
  public onStopQueue?: () => void;

  constructor(selection: SelectionManager) {
    this.selection = selection;
    this.container = document.createElement('div');
    this.container.className = 'bmx-toolbar';
    document.body.appendChild(this.container);

    // Listen to selection changes
    this.selection.onChange(() => this.render());

    this.render();
  }

  getMode(): AppMode {
    return this.mode;
  }

  setMode(mode: AppMode) {
    this.mode = mode;
    if (mode !== 'normal') {
      this.floatingState = 'normal';
      this.container.classList.remove('bmx-toolbar--hidden');
    }
    this.render();
  }

  setQueue(queue: QueueItem[], actionType: ActionType) {
    this.queue = queue;
    this.queueIndex = 0;
    this.actionType = actionType;
    this.mode = 'queue';
    this.render();
  }

  restoreQueue(state: PersistedQueueState) {
    this.queue = state.queue;
    this.queueIndex = Math.min(state.queueIndex, Math.max(state.queue.length - 1, 0));
    this.actionType = state.actionType;
    this.mode = 'queue';
    this.render();
  }

  getQueueState(): PersistedQueueState {
    return {
      actionType: this.actionType,
      queue: this.queue,
      queueIndex: this.queueIndex,
      active: this.mode === 'queue',
    };
  }

  advanceQueue(): boolean {
    this.queueIndex++;
    if (this.queueIndex >= this.queue.length) {
      this.finishQueue();
      return false;
    }
    this.render();
    return true;
  }

  skipQueueItem(): boolean {
    if (this.queueIndex < this.queue.length) {
      this.queue[this.queueIndex].status = 'skipped';
    }
    return this.advanceQueue();
  }

  markQueueDone(): boolean {
    if (this.queueIndex < this.queue.length) {
      this.queue[this.queueIndex].status = 'done';
    }
    return this.advanceQueue();
  }

  finishQueue() {
    const processed = this.queue.filter((q) => q.status === 'done').map((q) => q.handle);
    const skipped = this.queue.filter((q) => q.status === 'skipped' || q.status === 'pending' || q.status === 'failed').map((q) => q.handle);
    this.doneReport = {
      actionType: this.actionType,
      processed,
      skipped,
      total: this.queue.length,
    };
    this.mode = 'done';
    this.render();
  }

  getCurrentQueueItem(): QueueItem | null {
    if (this.queueIndex >= this.queue.length) return null;
    return this.queue[this.queueIndex];
  }

  destroy() {
    this.container.remove();
  }

  render() {
    switch (this.mode) {
      case 'normal':
        this.renderNormal();
        break;
      case 'block':
        this.renderBlockMode();
        break;
      case 'review':
        this.renderBlockMode(); // toolbar stays in block mode during review
        break;
      case 'queue':
        this.renderQueue();
        break;
      case 'done':
        this.renderDone();
        break;
    }
  }

  private renderNormal() {
    if (this.floatingState === 'hidden') {
      this.container.classList.add('bmx-toolbar--hidden');
      this.container.classList.remove('bmx-toolbar--compact');
      this.container.innerHTML = '';
      return;
    }

    this.container.classList.remove('bmx-toolbar--hidden');
    const count = this.selection.selectedCount;
    const enterLabel = t('aria.enterBlockMode');
    const isCompact = this.floatingState === 'compact';
    this.container.classList.toggle('bmx-toolbar--compact', isCompact);
    this.applyFloatingPosition();
    const hideLabel = isCompact ? t('aria.hideFloatingBall') : t('aria.shrinkFloatingBall');
    this.container.innerHTML = `
      <div class="bmx-floating-shell ${isCompact ? 'bmx-floating-shell--compact' : ''}">
        <button class="bmx-toolbar-collapsed" id="bmx-toggle" type="button" aria-label="${enterLabel}" title="${enterLabel}">
          <div class="bmx-toolbar-icon">
            <img class="bmx-toolbar-img" src="${EXTENSION_ICON_URL}" alt="" draggable="false">
          </div>
          ${count > 0 ? `<div class="bmx-badge">${count}</div>` : ''}
        </button>
        <span class="bmx-floating-hover-bridge" aria-hidden="true"></span>
        <button class="bmx-floating-hide" id="bmx-hide-floating" type="button" aria-label="${hideLabel}" title="${hideLabel}">&times;</button>
      </div>
    `;

    // One click enters Block Mode from the page icon.
    const toggle = this.container.querySelector('#bmx-toggle');
    toggle?.addEventListener('click', (event) => {
      if (Date.now() < this.suppressFloatingClickUntil) {
        event.preventDefault();
        return;
      }
      this.onStartBlockMode?.();
    });

    const shell = this.container.querySelector<HTMLElement>('.bmx-floating-shell');
    if (shell) this.bindFloatingDrag(shell);

    this.container.querySelector('#bmx-hide-floating')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.floatingState === 'compact') {
        this.floatingState = 'hidden';
        this.render();
        showToast(t('toast.floatingHidden'), 'success');
        return;
      }

      this.floatingState = 'compact';
      this.render();
      showToast(t('toast.floatingShrunk'), 'success');
    });
  }

  private applyFloatingPosition() {
    this.container.style.transform = 'translateY(-50%)';
    if (this.floatingCenterY === null) {
      this.container.style.top = '50%';
      return;
    }
    this.container.style.top = `${this.floatingCenterY}px`;
  }

  private bindFloatingDrag(shell: HTMLElement) {
    let startX = 0;
    let startY = 0;
    let startCenterY = 0;
    let minX = 0;
    let moved = false;
    let activePointerId = 0;
    let completed = false;
    let shouldCompact = false;

    const removeDragListeners = () => {
      shell.classList.remove('bmx-floating-shell--dragging');
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      window.removeEventListener('pointercancel', onPointerUp, { capture: true });
    };

    const compactFromDrag = () => {
      if (completed || this.floatingState === 'compact') return;
      completed = true;
      moved = true;
      this.suppressFloatingClickUntil = Date.now() + 350;
      removeDragListeners();
      this.floatingState = 'compact';
      this.render();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (completed || event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      event.preventDefault();
      event.stopPropagation();

      const radius = this.floatingState === 'compact' ? 16 : 24;
      this.floatingCenterY = Math.max(radius, Math.min(window.innerHeight - radius, startCenterY + dy));
      this.applyFloatingPosition();
      this.container.style.transform = `translate(${Math.min(0, dx)}px, -50%)`;

      minX = Math.min(minX, event.clientX);
      const leftTravel = startX - minX;
      const rightReturn = event.clientX - minX;
      if (leftTravel >= 12 && rightReturn >= 10) {
        shouldCompact = true;
        compactFromDrag();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (completed || event.pointerId !== activePointerId) return;
      completed = true;
      removeDragListeners();

      if (shouldCompact && this.floatingState !== 'compact') {
        this.floatingState = 'compact';
        this.render();
        return;
      }

      this.applyFloatingPosition();
      if (moved) this.suppressFloatingClickUntil = Date.now() + 350;
    };

    shell.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || (event.target as Element).closest('#bmx-hide-floating')) return;
      event.preventDefault();
      event.stopPropagation();

      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startCenterY = this.floatingCenterY ?? window.innerHeight / 2;
      minX = startX;
      moved = false;
      completed = false;
      shouldCompact = false;

      shell.classList.add('bmx-floating-shell--dragging');
      window.addEventListener('pointermove', onPointerMove, { passive: false, capture: true });
      window.addEventListener('pointerup', onPointerUp, { capture: true });
      window.addEventListener('pointercancel', onPointerUp, { capture: true });
    });
  }

  private renderBlockMode() {
    const count = this.selection.selectedCount;
    const hasSelection = count > 0;
    const visibleToggleLabel = this.selection.areAllVisibleSelected()
      ? t('action.deselectVisible')
      : t('action.selectVisible');
    this.container.innerHTML = `
      <div class="bmx-toolbar-expanded">
        <div class="bmx-panel-body">
          <div class="bmx-status">
            <div class="bmx-status-dot"></div>
            <span class="bmx-status-text">${hasSelection ? t('status.selectedAccounts') : t('status.selectAccounts')}</span>
            <span class="bmx-status-count" id="bmx-count">${count}</span>
          </div>

          <div class="bmx-action-grid" aria-label="Block Mode actions">
            <button class="bmx-option bmx-option--danger" id="bmx-block" ${hasSelection ? '' : 'disabled'}>
              <span class="bmx-option-icon">${ICONS.block}</span>
              <span class="bmx-option-label">${t('action.block')}</span>
              <span class="bmx-btn-shortcut">B</span>
            </button>
            <button class="bmx-option bmx-option--mute" id="bmx-mute" ${hasSelection ? '' : 'disabled'}>
              <span class="bmx-option-icon">${ICONS.mute}</span>
              <span class="bmx-option-label">${t('action.mute')}</span>
              <span class="bmx-btn-shortcut">M</span>
            </button>
            <button class="bmx-option" id="bmx-review" ${hasSelection ? '' : 'disabled'}>
              <span class="bmx-option-icon">${ICONS.review}</span>
              <span class="bmx-option-label">${t('action.review')}</span>
              <span class="bmx-btn-shortcut">R</span>
            </button>
            <button class="bmx-option" id="bmx-import">
              <span class="bmx-option-icon">${ICONS.import}</span>
              <span class="bmx-option-label">${t('action.import')}</span>
              <span class="bmx-btn-shortcut">I</span>
            </button>
          </div>

          <div class="bmx-btn-divider"></div>

          <button class="bmx-btn bmx-btn--ghost" id="bmx-select-visible">
            ${visibleToggleLabel}
            <span class="bmx-btn-shortcut">A</span>
          </button>
          <button class="bmx-btn bmx-btn--ghost" id="bmx-block-history" type="button">
            <span class="bmx-btn-icon">${ICONS.history}</span>
            <span>${t('action.history')}</span>
          </button>
          <button class="bmx-btn bmx-btn--ghost" id="bmx-clear" ${hasSelection ? '' : 'disabled'}>
            ${t('action.clear')}
          </button>
          <button class="bmx-btn bmx-btn--ghost" id="bmx-exit">
            ${t('action.exit')}
            <span class="bmx-btn-shortcut">Esc</span>
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#bmx-exit')?.addEventListener('click', () => this.onExitBlockMode?.());
    this.container.querySelector('#bmx-select-visible')?.addEventListener('click', () => {
      const result = this.selection.toggleVisibleSelection();
      showToast(
        result.selected
          ? t('toast.selectedVisible', { count: result.count })
          : t('toast.deselectedVisible', { count: result.count }),
        'success',
      );
    });
    this.container.querySelector('#bmx-clear')?.addEventListener('click', () => this.selection.clearAll());
    this.container.querySelector('#bmx-block-history')?.addEventListener('click', () => this.openHistoryDialog());

    this.container.querySelector('#bmx-block')?.addEventListener('click', () => {
      if (count > 0) { this.actionType = 'block'; this.onBlockSelected?.(); }
    });
    this.container.querySelector('#bmx-mute')?.addEventListener('click', () => {
      if (count > 0) { this.actionType = 'mute'; this.onMuteSelected?.(); }
    });
    this.container.querySelector('#bmx-review')?.addEventListener('click', () => {
      if (count > 0) this.onBlockSelected?.(); // opens review
    });
    this.container.querySelector('#bmx-import')?.addEventListener('click', () => this.openImportDialog());
  }

  openHistoryDialog() {
    document.querySelector('.bmx-history-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'bmx-history-overlay';
    overlay.innerHTML = `
      <div class="bmx-history-panel" role="dialog" aria-modal="true">
        <div class="bmx-history-header">
          <div>
            <div class="bmx-history-title">${t('history.title')}</div>
            <div class="bmx-history-desc">${t('history.description')}</div>
          </div>
          <button class="bmx-panel-close" id="bmx-history-close" type="button">&times;</button>
        </div>
        <div class="bmx-history-content" id="bmx-history-content">
          <div class="bmx-empty">${t('history.empty')}</div>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector('#bmx-history-close')?.addEventListener('click', close);
    document.body.appendChild(overlay);

    void this.renderHistory(overlay);
  }

  private async renderHistory(overlay: HTMLElement) {
    const result = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
    const history = Array.isArray(result[HISTORY_STORAGE_KEY])
      ? result[HISTORY_STORAGE_KEY] as ActionHistoryEntry[]
      : [];
    const actionHistory = history.filter((entry) => entry.processed.length > 0);
    const content = overlay.querySelector<HTMLElement>('#bmx-history-content');
    if (!content) return;

    content.textContent = '';
    const blockedHandles = this.getUniqueHistoryHandles(actionHistory, 'block');
    const mutedHandles = this.getUniqueHistoryHandles(actionHistory, 'mute');
    const allHandles = [...new Set([...blockedHandles, ...mutedHandles])];
    if (allHandles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bmx-empty';
      empty.textContent = t('history.empty');
      content.appendChild(empty);
      return;
    }

    const summary = document.createElement('div');
    summary.className = 'bmx-history-summary';
    const summaryText = document.createElement('span');
    summaryText.textContent = t('history.summary', {
      blocked: blockedHandles.length,
      muted: mutedHandles.length,
    });
    const copyButton = document.createElement('button');
    copyButton.className = 'bmx-history-copy';
    copyButton.type = 'button';
    copyButton.textContent = t('action.copyHistoryAccounts');
    copyButton.disabled = allHandles.length === 0;
    copyButton.addEventListener('click', async () => {
      await this.copyText(allHandles.map((handle) => `@${handle}`).join('\n'));
      copyButton.textContent = t('history.copyDone');
      copyButton.classList.add('bmx-history-copy--done');
      window.setTimeout(() => {
        copyButton.textContent = t('action.copyHistoryAccounts');
        copyButton.classList.remove('bmx-history-copy--done');
      }, 1200);
    });
    summary.append(summaryText, copyButton);
    content.appendChild(summary);

    const list = document.createElement('div');
    list.className = 'bmx-history-list';
    content.appendChild(list);

    actionHistory.forEach((entry) => {
      const isBlock = entry.actionType === 'block';
      const item = document.createElement('div');
      item.className = `bmx-history-item bmx-history-item--${entry.actionType}`;

      const top = document.createElement('div');
      top.className = 'bmx-history-item-top';

      const meta = document.createElement('div');
      meta.className = 'bmx-history-meta';

      const badge = document.createElement('span');
      badge.className = `bmx-history-action bmx-history-action--${entry.actionType}`;
      badge.textContent = isBlock ? t('action.block') : t('action.mute');

      const time = document.createElement('div');
      time.className = 'bmx-history-time';
      time.textContent = t('history.completedAt', { time: this.formatHistoryTime(entry.finishedAt) });
      meta.append(badge, time);

      const stats = document.createElement('div');
      stats.className = 'bmx-history-stats';
      stats.textContent = t('history.runStats', {
        done: entry.processed.length,
        failed: entry.failed.length,
        skipped: entry.skipped.length,
        total: entry.total,
      });

      top.append(meta, stats);
      item.appendChild(top);

      const handles = document.createElement('div');
      handles.className = 'bmx-history-handles';
      entry.processed.forEach((handle) => {
        const chip = document.createElement('a');
        chip.className = `bmx-history-handle bmx-history-handle--${entry.actionType}`;
        chip.href = `https://x.com/${encodeURIComponent(handle)}`;
        chip.target = '_blank';
        chip.rel = 'noreferrer';
        chip.textContent = `@${handle}`;
        handles.appendChild(chip);
      });
      item.appendChild(handles);
      list.appendChild(item);
    });
  }

  private getUniqueHistoryHandles(history: ActionHistoryEntry[], actionType: ActionType): string[] {
    return [...new Set(
      history
        .filter((entry) => entry.actionType === actionType)
        .flatMap((entry) => entry.processed),
    )];
  }

  private async copyText(text: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  private formatHistoryTime(timestamp: number): string {
    const locale = getLanguage() === 'zh' ? 'zh-CN' : 'en';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  openImportDialog() {
    document.querySelector('.bmx-import-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'bmx-import-overlay';
    overlay.innerHTML = `
      <div class="bmx-import-panel" role="dialog" aria-modal="true">
        <div class="bmx-import-header">
          <div>
            <div class="bmx-import-title">${t('import.title')}</div>
            <div class="bmx-import-desc">${t('import.description')}</div>
          </div>
          <button class="bmx-panel-close" id="bmx-import-close" type="button">&times;</button>
        </div>
        <textarea class="bmx-import-textarea" id="bmx-import-textarea"></textarea>
        <div class="bmx-import-footer">
          <button class="bmx-btn bmx-btn--ghost" id="bmx-import-cancel" type="button">${t('action.cancel')}</button>
          <button class="bmx-btn bmx-btn--primary" id="bmx-import-confirm" type="button">${t('import.confirm')}</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    const textarea = overlay.querySelector<HTMLTextAreaElement>('#bmx-import-textarea');
    if (textarea) {
      textarea.placeholder = t('import.placeholder');
    }

    const submit = () => {
      const result = this.selection.importHandles(textarea?.value ?? '');
      if (result.parsed === 0) {
        showToast(t('toast.importNoValidHandles'), 'error');
        textarea?.focus();
        return;
      }

      showToast(t('toast.importedHandles', {
        added: result.added,
        parsed: result.parsed,
        total: result.selectedTotal,
      }), 'success');
      close();
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector('#bmx-import-close')?.addEventListener('click', close);
    overlay.querySelector('#bmx-import-cancel')?.addEventListener('click', close);
    overlay.querySelector('#bmx-import-confirm')?.addEventListener('click', submit);

    document.body.appendChild(overlay);
    textarea?.focus();
  }

  private renderQueue() {
    const item = this.getCurrentQueueItem();
    const total = this.queue.length;
    const current = this.queueIndex + 1;
    const completed = this.queue.filter((q) => q.status === 'done' || q.status === 'skipped' || q.status === 'failed').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    const isBlock = this.actionType === 'block';
    const label = isBlock ? t('queue.autoBlock') : t('queue.autoMute');
    const barClass = isBlock ? 'bmx-progress-bar--block' : 'bmx-progress-bar--mute';
    const statusLabel = item?.status === 'failed'
      ? t('queue.lastFailed')
      : item?.status === 'opened'
        ? t('queue.running')
        : t('queue.processed', { completed, total });

    this.container.innerHTML = `
      <div class="bmx-toolbar-expanded">
        <div class="bmx-panel-header">
          <span class="bmx-panel-title" style="color:${isBlock ? 'var(--bmx-red)' : 'var(--bmx-orange)'}">${label}</span>
        </div>
        <div class="bmx-panel-body">
          <div class="bmx-queue-counter">${current} / ${total}</div>
          <div class="bmx-progress">
            <div class="bmx-progress-bar ${barClass}" style="width:${progress}%"></div>
          </div>
          <div class="bmx-queue-status">${statusLabel}</div>
          ${item ? `<div class="bmx-queue-current">@${item.handle}</div>` : ''}

          <button class="bmx-btn bmx-btn--primary" id="bmx-open">
            <span>↗</span> ${t('action.openCurrent')}
            <span class="bmx-btn-shortcut">O</span>
          </button>
          <div class="bmx-btn-divider"></div>
          <button class="bmx-btn bmx-btn--ghost" id="bmx-stop">
            ${t('action.stop')}
            <span class="bmx-btn-shortcut">Esc</span>
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#bmx-open')?.addEventListener('click', () => {
      if (item) this.onOpenProfile?.(item.profileUrl);
    });
    this.container.querySelector('#bmx-stop')?.addEventListener('click', () => this.onStopQueue?.());
  }

  private renderDone() {
    const report = this.doneReport;
    if (!report) return;

    this.container.innerHTML = `
      <div class="bmx-toolbar-expanded">
        <div class="bmx-panel-header">
          <span class="bmx-panel-title" style="color:var(--bmx-green)">${t('done.title')}</span>
        </div>
        <div class="bmx-panel-body">
          <div class="bmx-done-icon">${ICONS.check}</div>
          <div class="bmx-done-stats">
            <div class="bmx-done-stat">
              <div class="bmx-done-stat-value">${report.processed.length}</div>
              <div class="bmx-done-stat-label">${t('done.processed')}</div>
            </div>
            <div class="bmx-done-stat">
              <div class="bmx-done-stat-value">${report.skipped.length}</div>
              <div class="bmx-done-stat-label">${t('done.skipped')}</div>
            </div>
          </div>

          <button class="bmx-btn" id="bmx-copy-report">
            <span>📄</span> ${t('action.copyReport')}
          </button>
          <button class="bmx-btn bmx-btn--ghost" id="bmx-exit-done">
            ${t('done.exitBlockMode')}
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#bmx-copy-report')?.addEventListener('click', async () => {
      const lines = [
        t('report.action', { action: report.actionType === 'block' ? t('action.block') : t('action.mute') }),
        t('report.processed'),
        ...report.processed.map((h) => `@${h}`),
        t('report.skipped'),
        ...report.skipped.map((h) => `@${h}`),
      ];
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast(t('toast.reportCopied'), 'success');
    });

    this.container.querySelector('#bmx-exit-done')?.addEventListener('click', () => {
      this.onExitBlockMode?.();
    });
  }
}

/**
 * Review Panel (drawer)
 */
export class ReviewPanel {
  private overlay: HTMLDivElement | null = null;
  private panel: HTMLDivElement | null = null;

  show(
    handles: string[],
    actionType: ActionType,
    onRemove: (handle: string) => void,
    onConfirm: () => void,
    onCancel: () => void,
    onCopy: () => void,
  ) {
    this.close();

    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'bmx-review-overlay';
    this.overlay.addEventListener('click', () => onCancel());
    document.body.appendChild(this.overlay);

    // Panel
    this.panel = document.createElement('div');
    this.panel.className = 'bmx-review-panel';

    const isBlock = actionType === 'block';
    const actionLabel = isBlock ? t('action.autoBlock') : t('action.autoMute');
    const actionClass = isBlock ? 'bmx-btn--danger' : 'bmx-btn--mute';
    const reviewTitle = isBlock ? t('review.blockTitle') : t('review.muteTitle');

    this.panel.innerHTML = `
      <div class="bmx-review-header">
        <span class="bmx-review-title">${reviewTitle}</span>
        <button class="bmx-panel-close" id="bmx-review-close">&times;</button>
      </div>
      <div class="bmx-review-count">${t('review.count', { count: handles.length })}</div>
      <div class="bmx-review-list" id="bmx-review-list"></div>
      <div class="bmx-review-footer">
        <button class="bmx-btn" id="bmx-review-copy"><span>📄</span> ${t('action.copyHandles')}</button>
        <div class="bmx-review-footer-row">
          <button class="bmx-btn bmx-btn--ghost" id="bmx-review-cancel">${t('action.cancel')}</button>
          <button class="bmx-btn ${actionClass}" id="bmx-review-confirm">${actionLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);

    // Render list
    const list = this.panel.querySelector('#bmx-review-list')!;
    handles.forEach((handle) => {
      const item = document.createElement('div');
      item.className = 'bmx-review-item';
      item.innerHTML = `
        <span class="bmx-review-handle">@${handle}</span>
        <button class="bmx-review-remove" data-handle="${handle}">${t('action.remove')}</button>
      `;
      item.querySelector('.bmx-review-remove')?.addEventListener('click', () => {
        onRemove(handle);
        item.remove();
        // Update count
        const countEl = this.panel?.querySelector('.bmx-review-count');
        const remaining = this.panel?.querySelectorAll('.bmx-review-item').length ?? 0;
        if (countEl) countEl.textContent = t('review.count', { count: remaining });
      });
      list.appendChild(item);
    });

    // Bind events
    this.panel.querySelector('#bmx-review-close')?.addEventListener('click', () => onCancel());
    this.panel.querySelector('#bmx-review-cancel')?.addEventListener('click', () => onCancel());
    this.panel.querySelector('#bmx-review-confirm')?.addEventListener('click', () => onConfirm());
    this.panel.querySelector('#bmx-review-copy')?.addEventListener('click', () => onCopy());
  }

  close() {
    this.overlay?.remove();
    this.panel?.remove();
    this.overlay = null;
    this.panel = null;
  }

  isOpen(): boolean {
    return this.panel !== null;
  }
}

/**
 * Show toast notification
 */
export function showToast(message: string, type: 'success' | 'error' = 'success') {
  // Remove existing toasts
  document.querySelectorAll('.bmx-toast').forEach((el) => el.remove());

  const toast = document.createElement('div');
  toast.className = `bmx-toast bmx-toast--${type}`;
  toast.textContent = type === 'success' ? `✓ ${message}` : `✕ ${message}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'bmx-toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/**
 * Show shortcut help overlay
 */
export function showHelpOverlay() {
  const existing = document.querySelector('.bmx-help-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'bmx-help-overlay';
  overlay.innerHTML = `
    <div class="bmx-help-panel">
      <div class="bmx-help-title">${t('help.title')}</div>
      <div class="bmx-help-grid">
        <div class="bmx-help-section">${t('help.selection')}</div>
        <span class="bmx-help-key">Shift+Click</span><span class="bmx-help-action">${t('help.rangeSelect')}</span>
        <span class="bmx-help-key">A</span><span class="bmx-help-action">${t('help.selectVisible')}</span>
        <span class="bmx-help-key">Shift+A</span><span class="bmx-help-action">${t('help.deselectVisible')}</span>

        <div class="bmx-help-section">${t('help.actions')}</div>
        <span class="bmx-help-key">B</span><span class="bmx-help-action">${t('help.blockSelected')}</span>
        <span class="bmx-help-key">M</span><span class="bmx-help-action">${t('help.muteSelected')}</span>
        <span class="bmx-help-key">R</span><span class="bmx-help-action">${t('help.reviewList')}</span>
        <span class="bmx-help-key">I</span><span class="bmx-help-action">${t('help.importAccounts')}</span>

        <div class="bmx-help-section">${t('help.queue')}</div>
        <span class="bmx-help-key">O</span><span class="bmx-help-action">${t('help.openProfile')}</span>
        <span class="bmx-help-key">N</span><span class="bmx-help-action">${t('help.markDone')}</span>
        <span class="bmx-help-key">S</span><span class="bmx-help-action">${t('help.skip')}</span>

        <div class="bmx-help-section">${t('help.general')}</div>
        <span class="bmx-help-key">Esc</span><span class="bmx-help-action">${t('help.exit')}</span>
        <span class="bmx-help-key">?</span><span class="bmx-help-action">${t('help.thisHelp')}</span>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}
