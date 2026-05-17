/**
 * Shortcuts - Keyboard shortcut handler for Block Mode
 */
import { AppMode } from '../shared/types';

type ShortcutHandler = {
  getMode: () => AppMode;
  isReviewOpen: () => boolean;
  selectVisible: () => void;
  deselectVisible: () => void;
  blockSelected: () => void;
  muteSelected: () => void;
  reviewList: () => void;
  importHandles: () => void;
  exit: () => void;
  showHelp: () => void;
  // Queue shortcuts
  openProfile: () => void;
  markDone: () => void;
  skip: () => void;
  stopQueue: () => void;
};

export function initShortcuts(handler: ShortcutHandler): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    // Don't capture when typing in inputs
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.getAttribute('role') === 'textbox'
    ) {
      return;
    }

    const mode = handler.getMode();

    // Close help overlay on Escape
    if (e.key === 'Escape') {
      const importOverlay = document.querySelector('.bmx-import-overlay');
      if (importOverlay) {
        importOverlay.remove();
        e.preventDefault();
        return;
      }

      const historyOverlay = document.querySelector('.bmx-history-overlay');
      if (historyOverlay) {
        historyOverlay.remove();
        e.preventDefault();
        return;
      }

      const helpOverlay = document.querySelector('.bmx-help-overlay');
      if (helpOverlay) {
        helpOverlay.remove();
        e.preventDefault();
        return;
      }

      // Esc exits the Block Mode flow even when the review drawer is open.
      if (handler.isReviewOpen()) {
        handler.exit();
        e.preventDefault();
        return;
      }
    }

    // Block mode shortcuts
    if (mode === 'block') {
      switch (e.key) {
        case 'a':
          if (e.shiftKey) {
            e.preventDefault();
            handler.deselectVisible();
          } else {
            e.preventDefault();
            handler.selectVisible();
          }
          break;
        case 'A':
          e.preventDefault();
          handler.deselectVisible();
          break;
        case 'b':
          if (!e.altKey) {
            e.preventDefault();
            handler.blockSelected();
          }
          break;
        case 'm':
          e.preventDefault();
          handler.muteSelected();
          break;
        case 'r':
          e.preventDefault();
          handler.reviewList();
          break;
        case 'i':
          e.preventDefault();
          handler.importHandles();
          break;
        case 'Escape':
          e.preventDefault();
          handler.exit();
          break;
        case '?':
          e.preventDefault();
          handler.showHelp();
          break;
      }
      return;
    }

    // Queue mode shortcuts
    if (mode === 'queue') {
      switch (e.key) {
        case 'o':
          e.preventDefault();
          handler.openProfile();
          break;
        case 'n':
          e.preventDefault();
          handler.markDone();
          break;
        case 's':
          e.preventDefault();
          handler.skip();
          break;
        case 'Escape':
          e.preventDefault();
          handler.stopQueue();
          break;
      }
      return;
    }

    // Done mode - Esc exits
    if (mode === 'done' && e.key === 'Escape') {
      e.preventDefault();
      handler.exit();
      return;
    }
  };

  document.addEventListener('keydown', onKeyDown, true);

  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
  };
}
