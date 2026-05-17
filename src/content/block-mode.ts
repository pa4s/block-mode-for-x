/**
 * Block Mode Controller - orchestrates all content script modules
 */
import { ActionType, QueueItem, PersistedQueueState } from '../shared/types';
import { SelectionManager } from './selection';
import { Toolbar, ReviewPanel, showToast, showHelpOverlay } from './toolbar';
import { observeNewArticles } from './dom-parser';
import { initShortcuts } from './shortcuts';
import { t } from '../shared/i18n';

const QUEUE_STORAGE_KEY = 'bmxActiveQueue';

export class BlockModeController {
  private selection: SelectionManager;
  private toolbar: Toolbar;
  private review: ReviewPanel;
  private observer: MutationObserver | null = null;
  private cleanupShortcuts: (() => void) | null = null;
  private queueStorageListener: Parameters<typeof chrome.storage.onChanged.addListener>[0];

  constructor() {
    this.selection = new SelectionManager();
    this.toolbar = new Toolbar(this.selection);
    this.review = new ReviewPanel();
    this.queueStorageListener = (changes, areaName) => {
      if (areaName !== 'local' || !changes[QUEUE_STORAGE_KEY]) return;
      this.applyStoredQueueState(changes[QUEUE_STORAGE_KEY].newValue as PersistedQueueState | undefined);
    };

    this.setupToolbarCallbacks();
    this.setupShortcuts();
    chrome.storage.onChanged.addListener(this.queueStorageListener);
    void this.restoreQueueState();
  }

  private setupToolbarCallbacks() {
    this.toolbar.onStartBlockMode = () => this.enterBlockMode();
    this.toolbar.onExitBlockMode = () => this.exitBlockMode();

    this.toolbar.onBlockSelected = () => {
      if (this.selection.selectedCount === 0) {
        showToast(t('toast.noAccounts'), 'error');
        return;
      }
      this.showReview('block');
    };

    this.toolbar.onMuteSelected = () => {
      if (this.selection.selectedCount === 0) {
        showToast(t('toast.noAccounts'), 'error');
        return;
      }
      this.showReview('mute');
    };

    this.toolbar.onOpenProfile = (url: string) => {
      this.openProfile(url, true);
    };

    this.toolbar.onMarkDone = async () => {
      const hasNext = this.toolbar.markQueueDone();
      await this.syncQueueAfterAdvance(hasNext);
    };

    this.toolbar.onSkip = async () => {
      const hasNext = this.toolbar.skipQueueItem();
      await this.syncQueueAfterAdvance(hasNext);
    };

    this.toolbar.onStopQueue = () => {
      this.cancelAutoQueue();
    };
  }

  private setupShortcuts() {
    this.cleanupShortcuts = initShortcuts({
      getMode: () => this.toolbar.getMode(),
      isReviewOpen: () => this.review.isOpen(),
      selectVisible: () => {
        const result = this.selection.toggleVisibleSelection();
        showToast(
          result.selected
            ? t('toast.selectedVisible', { count: result.count })
            : t('toast.deselectedVisible', { count: result.count }),
          'success',
        );
      },
      deselectVisible: () => {
        const count = this.selection.deselectVisible();
        showToast(t('toast.deselectedVisible', { count }), 'success');
      },
      blockSelected: () => {
        if (this.selection.selectedCount > 0) this.showReview('block');
      },
      muteSelected: () => {
        if (this.selection.selectedCount > 0) this.showReview('mute');
      },
      reviewList: () => {
        if (this.selection.selectedCount > 0) this.showReview('block');
      },
      importHandles: () => this.toolbar.openImportDialog(),
      exit: () => this.exitBlockMode(),
      showHelp: () => showHelpOverlay(),
      openProfile: () => {
        const item = this.toolbar.getCurrentQueueItem();
        if (item) this.openProfile(item.profileUrl, true);
      },
      markDone: async () => {
        const hasNext = this.toolbar.markQueueDone();
        await this.syncQueueAfterAdvance(hasNext);
      },
      skip: async () => {
        const hasNext = this.toolbar.skipQueueItem();
        await this.syncQueueAfterAdvance(hasNext);
      },
      stopQueue: () => {
        this.cancelAutoQueue();
      },
    });
  }

  enterBlockMode() {
    this.toolbar.setMode('block');
    document.body.classList.add('bmx-mode-active');

    // Inject select buttons into existing articles
    this.selection.injectSelectButtons();

    // Watch for new articles (infinite scroll)
    this.observer = observeNewArticles((newArticles) => {
      newArticles.forEach((article) => this.selection.injectButton(article));
    });

    showToast(t('toast.blockModeActivated'), 'success');
  }

  exitBlockMode() {
    document.querySelector('.bmx-import-overlay')?.remove();
    document.querySelector('.bmx-history-overlay')?.remove();
    this.review.close();
    this.selection.cleanup();
    this.selection.clearAll();
    this.observer?.disconnect();
    this.observer = null;
    document.body.classList.remove('bmx-mode-active');
    this.toolbar.setMode('normal');
    void this.clearQueueState();
  }

  private showReview(actionType: ActionType) {
    const handles = this.selection.getSelectedArray();
    if (handles.length === 0) {
      showToast(t('toast.noAccounts'), 'error');
      return;
    }

    this.toolbar.setMode('review');
    this.review.show(
      handles,
      actionType,
      // onRemove
      (handle) => {
        this.selection.removeHandle(handle);
      },
      // onConfirm
      () => {
        this.review.close();
        void this.startQueue(actionType);
      },
      // onCancel
      () => {
        this.review.close();
        this.toolbar.setMode('block');
      },
      // onCopy
      async () => {
        const n = await this.selection.copyHandles();
        showToast(t('toast.copiedHandles', { count: n }), 'success');
      },
    );
  }

  private async startQueue(actionType: ActionType) {
    const handles = this.selection.getSelectedArray();
    const queue: QueueItem[] = handles.map((handle) => ({
      handle,
      profileUrl: `https://x.com/${handle}`,
      status: 'pending' as const,
    }));

    this.toolbar.setQueue(queue, actionType);
    await this.saveQueueState(true);

    chrome.runtime.sendMessage({ type: 'AUTO_QUEUE_START', actionType, handles }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        showToast(response?.errorCode === 'missingHeaders' ? t('toast.missingHeaders') : t('toast.queueStartFailed'), 'error');
      } else {
        showToast(actionType === 'block' ? t('toast.blockQueueRunning') : t('toast.muteQueueRunning'), 'success');
      }
    });
  }

  private applyStoredQueueState(state: PersistedQueueState | undefined) {
    if (!state?.automated || state.queue.length === 0) return;

    this.toolbar.restoreQueue(state);
    document.body.classList.add('bmx-mode-active');

    if (!state.active) {
      this.toolbar.finishQueue();
    }
  }

  private async restoreQueueState() {
    const state = await this.getStoredQueueState();
    this.applyStoredQueueState(state ?? undefined);
  }

  private async syncQueueAfterAdvance(hasNext: boolean) {
    if (!hasNext) {
      await this.clearQueueState();
      return;
    }

    await this.saveQueueState();
    const item = this.toolbar.getCurrentQueueItem();
    if (item) {
      this.openProfile(item.profileUrl, true);
    }
  }

  private openProfile(url: string, reuseCurrentTab: boolean) {
    chrome.runtime.sendMessage({ type: 'OPEN_PROFILE', url, reuseCurrentTab });
  }

  private cancelAutoQueue() {
    chrome.runtime.sendMessage({ type: 'AUTO_QUEUE_CANCEL' }, () => {
      if (chrome.runtime.lastError) {
        showToast(t('toast.stopQueueFailed'), 'error');
      }
    });
  }

  private async getStoredQueueState(): Promise<PersistedQueueState | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(QUEUE_STORAGE_KEY, (result) => {
        resolve((result[QUEUE_STORAGE_KEY] as PersistedQueueState | undefined) ?? null);
      });
    });
  }

  private async saveQueueState(automated = false) {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({
        [QUEUE_STORAGE_KEY]: {
          ...this.toolbar.getQueueState(),
          automated,
        },
      }, () => resolve());
    });
  }

  private async clearQueueState() {
    return new Promise<void>((resolve) => {
      chrome.storage.local.remove(QUEUE_STORAGE_KEY, () => resolve());
    });
  }

  destroy() {
    this.cleanupShortcuts?.();
    chrome.storage.onChanged.removeListener(this.queueStorageListener);
    this.observer?.disconnect();
    this.selection.cleanup();
    document.querySelector('.bmx-import-overlay')?.remove();
    document.querySelector('.bmx-history-overlay')?.remove();
    this.review.close();
    this.toolbar.destroy();
    document.body.classList.remove('bmx-mode-active');
  }
}
