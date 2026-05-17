/**
 * Shared constants for Block Mode for X
 */

/** System paths to filter out when parsing handles */
export const SYSTEM_PATHS = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'i',
  'settings',
  'compose',
  'search',
  'login',
  'logout',
  'tos',
  'privacy',
  'signup',
  'account',
  'help',
  'about',
  'download',
  'jobs',
  'hashtag',
  'lists',
  'bookmarks',
  'communities',
  'premium',
  'verified',
]);

/** Valid handle pattern: 1-15 chars, letters/numbers/underscores */
export const HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;

/** CSS class prefix to avoid conflicts */
export const CLASS_PREFIX = 'bmx-';

/** CSS classes used by the extension */
export const CLASSES = {
  toolbar: `${CLASS_PREFIX}toolbar`,
  toolbarCollapsed: `${CLASS_PREFIX}toolbar-collapsed`,
  toolbarExpanded: `${CLASS_PREFIX}toolbar-expanded`,
  selectBtn: `${CLASS_PREFIX}select-btn`,
  selectBtnSelected: `${CLASS_PREFIX}select-btn--selected`,
  articleHighlight: `${CLASS_PREFIX}article-highlight`,
  articleSelected: `${CLASS_PREFIX}article-selected`,
  reviewPanel: `${CLASS_PREFIX}review-panel`,
  reviewOverlay: `${CLASS_PREFIX}review-overlay`,
  toast: `${CLASS_PREFIX}toast`,
  badge: `${CLASS_PREFIX}badge`,
} as const;

/** Shortcut key bindings */
export const SHORTCUTS = {
  TOGGLE_MODE: { key: 'b', alt: true },
  NEXT: { key: 'j' },
  PREV: { key: 'k' },
  SELECT: { key: 'x' },
  SELECT_NEXT: { key: ' ' },
  SELECT_VISIBLE: { key: 'a' },
  DESELECT_VISIBLE: { key: 'A', shift: true },
  BLOCK: { key: 'b' },
  MUTE: { key: 'm' },
  REVIEW: { key: 'r' },
  COPY: { key: 'c' },
  EXIT: { key: 'Escape' },
  HELP: { key: '?' },
  // Queue shortcuts
  OPEN_PROFILE: { key: 'o' },
  MARK_DONE: { key: 'n' },
  SKIP: { key: 's' },
} as const;
