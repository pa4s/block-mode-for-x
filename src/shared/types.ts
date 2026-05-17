/**
 * Shared type definitions for Block Mode for X
 */

/** Application mode states */
export type AppMode = 'normal' | 'block' | 'review' | 'queue' | 'done';

/** Action type for queue processing */
export type ActionType = 'block' | 'mute';

/** Extracted X account information */
export interface XAccount {
  handle: string;
  displayName?: string;
  profileUrl: string;
  articleElement?: HTMLElement;
  selected: boolean;
}

/** Queue item for block/mute processing */
export interface QueueItem {
  handle: string;
  profileUrl: string;
  status: 'pending' | 'opened' | 'done' | 'skipped' | 'failed';
}

/** Overall application state */
export interface AppState {
  mode: AppMode;
  selectedHandles: Set<string>;
  currentIndex: number;
  accounts: Map<string, XAccount>;
  queue: QueueItem[];
  actionType?: ActionType;
  queueIndex: number;
}

/** Done report data */
export interface DoneReport {
  actionType: ActionType;
  processed: string[];
  skipped: string[];
  total: number;
}

/** Persisted queue state shared across X tabs/pages */
export interface PersistedQueueState {
  actionType: ActionType;
  queue: QueueItem[];
  queueIndex: number;
  active: boolean;
  automated?: boolean;
}

/** Historical summary for a completed background run */
export interface ActionHistoryEntry {
  id: string;
  actionType: ActionType;
  startedAt: number;
  finishedAt: number;
  total: number;
  processed: string[];
  failed: string[];
  skipped: string[];
}

/** Messages between content script and background */
export type ExtensionMessage =
  | { type: 'OPEN_PROFILE'; url: string; reuseCurrentTab?: boolean }
  | { type: 'AUTO_QUEUE_START'; actionType: ActionType; handles: string[] }
  | { type: 'AUTO_QUEUE_CANCEL' }
  | { type: 'QUEUE_STARTED'; actionType: ActionType; handles: string[] }
  | { type: 'QUEUE_NEXT' }
  | { type: 'QUEUE_STOP' }
  | { type: 'GET_STATE' }
  | { type: 'STATE_UPDATE'; state: Partial<AppState> };
