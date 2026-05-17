/**
 * Background Service Worker
 * Runs background block/mute queues through X's own web endpoints.
 */
import { ActionHistoryEntry, ActionType, PersistedQueueState, QueueItem } from '../shared/types';

const QUEUE_STORAGE_KEY = 'bmxActiveQueue';
const HISTORY_STORAGE_KEY = 'bmxActionHistory';
const X_HEADERS_STORAGE_KEY = 'bmxXRequestHeaders';
const X_HOME_URL = 'https://x.com/home';
const USER_BY_SCREEN_NAME = 'UserByScreenName';
const ACTION_DELAY_MS = 2600;

type StoredHeaders = Record<string, string>;

type GraphQLOperationArgs = {
  queryId: string;
  flags: Record<string, boolean | number | string>;
  fieldToggles?: Record<string, boolean>;
};

let currentRunId = 0;
let cancelRequested = false;
let userByScreenNameArgsPromise: Promise<GraphQLOperationArgs | null> | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_PROFILE') {
    if (message.reuseCurrentTab && sender.tab?.id) {
      chrome.tabs.update(sender.tab.id, {
        url: message.url,
        active: true,
      });
    } else {
      chrome.tabs.create({
        url: message.url,
        active: true,
      });
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'AUTO_QUEUE_START') {
    void startAutoQueue(message.actionType, message.handles).then(sendResponse);
    return true;
  }

  if (message.type === 'AUTO_QUEUE_CANCEL') {
    cancelRequested = true;
    void stopQueue();
    sendResponse({ success: true });
    return true;
  }

  return false;
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!details.requestHeaders || !details.url.includes('/i/api/')) return;

    const headers = normalizeHeaders(details.requestHeaders);
    if (!headers.authorization || !headers['x-csrf-token']) return;

    void chrome.storage.local.set({
      [X_HEADERS_STORAGE_KEY]: pickUsefulHeaders(headers),
    });
  },
  {
    urls: [
      'https://x.com/i/api/*',
      'https://twitter.com/i/api/*',
    ],
  },
  ['requestHeaders', 'extraHeaders'],
);

async function startAutoQueue(actionType: ActionType, handles: string[]) {
  const headers = await getStoredHeaders();
  if (!headers) {
    return {
      success: false,
      errorCode: 'missingHeaders',
    };
  }

  currentRunId++;
  cancelRequested = false;
  void processQueue(currentRunId, actionType, handles);
  return { success: true };
}

async function processQueue(runId: number, actionType: ActionType, handles: string[]) {
  const startedAt = Date.now();
  const queue: QueueItem[] = handles.map((handle) => ({
    handle,
    profileUrl: `https://x.com/${handle}`,
    status: 'pending',
  }));

  await saveQueue({ actionType, queue, queueIndex: 0, active: true, automated: true });

  for (let index = 0; index < queue.length; index++) {
    if (cancelRequested || runId !== currentRunId) break;

    queue[index].status = 'opened';
    await saveQueue({ actionType, queue, queueIndex: index, active: true, automated: true });

    try {
      const userId = await getUserIdByHandle(queue[index].handle);
      await runInternalAccountAction(actionType, userId);
      queue[index].status = 'done';
    } catch (error) {
      console.warn('[Block Mode for X] Internal action failed', queue[index].handle, error);
      queue[index].status = 'failed';
    }

    await saveQueue({ actionType, queue, queueIndex: index, active: true, automated: true });
    await sleep(ACTION_DELAY_MS);
  }

  if (cancelRequested || runId !== currentRunId) {
    queue.forEach((item) => {
      if (item.status === 'pending' || item.status === 'opened') item.status = 'skipped';
    });
  }

  await saveQueue({
    actionType,
    queue,
    queueIndex: Math.min(queue.length - 1, Math.max(queue.findIndex((item) => item.status !== 'done'), 0)),
    active: false,
    automated: true,
  });
  await saveHistoryEntry(actionType, queue, startedAt);
}

async function runInternalAccountAction(actionType: ActionType, userId: string) {
  const endpoint = actionType === 'block'
    ? 'https://x.com/i/api/1.1/blocks/create.json'
    : 'https://x.com/i/api/1.1/mutes/users/create.json';

  const headers = await makeXHeaders('application/x-www-form-urlencoded');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: `user_id=${encodeURIComponent(userId)}`,
    credentials: 'include',
    referrer: X_HOME_URL,
    referrerPolicy: 'strict-origin-when-cross-origin',
  });

  if (!response.ok) {
    throw new Error(`${actionType} failed: ${response.status} ${response.statusText}`);
  }
}

async function getUserIdByHandle(handle: string): Promise<string> {
  const args = await getUserByScreenNameArgs();
  if (!args) throw new Error('Could not resolve UserByScreenName GraphQL metadata');

  const url = new URL(`https://x.com/i/api/graphql/${args.queryId}/${USER_BY_SCREEN_NAME}`);
  url.searchParams.set('variables', JSON.stringify({ screen_name: handle }));
  url.searchParams.set('features', JSON.stringify(args.flags));
  if (args.fieldToggles) {
    url.searchParams.set('fieldToggles', JSON.stringify(args.fieldToggles));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await makeXHeaders('application/json'),
    credentials: 'include',
    referrer: `https://x.com/${handle}`,
    referrerPolicy: 'strict-origin-when-cross-origin',
  });

  if (!response.ok) {
    throw new Error(`Could not resolve @${handle}: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const id = findUserId(json, handle);
  if (!id) throw new Error(`Could not find numeric id for @${handle}`);
  return id;
}

async function getUserByScreenNameArgs(): Promise<GraphQLOperationArgs | null> {
  userByScreenNameArgsPromise ??= extractUserByScreenNameArgs();
  return userByScreenNameArgsPromise;
}

async function extractUserByScreenNameArgs(): Promise<GraphQLOperationArgs | null> {
  const home = await fetch(X_HOME_URL, { credentials: 'include' }).then((response) => response.text());
  const mainScriptUrl = home.match(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[^"']+\.js/)?.[0];
  if (!mainScriptUrl) return null;

  const [script, allFlags] = await Promise.all([
    fetch(mainScriptUrl).then((response) => response.text()),
    Promise.resolve(extractAllFeatureFlags(home)),
  ]);

  const operation = extractGraphQLOperation(script, USER_BY_SCREEN_NAME);
  if (!operation) return null;

  return {
    queryId: operation.queryId,
    flags: operation.featureSwitches.reduce((flags, key) => ({
      ...flags,
      [key]: allFlags[key] ?? false,
    }), {} as Record<string, boolean | number | string>),
    fieldToggles: operation.fieldToggles.length > 0
      ? operation.fieldToggles.reduce((toggles, key) => ({ ...toggles, [key]: true }), {} as Record<string, boolean>)
      : undefined,
  };
}

function extractGraphQLOperation(script: string, operationName: string): {
  queryId: string;
  featureSwitches: string[];
  fieldToggles: string[];
} | null {
  const regex = /{queryId:"([^"]+)",operationName:"([^"]+)",operationType:"([^"]+)",metadata:{featureSwitches:\[(.*?)\],fieldToggles:\[(.*?)\]}}/g;
  for (const match of script.matchAll(regex)) {
    if (match[2] !== operationName) continue;
    return {
      queryId: match[1],
      featureSwitches: splitStringArray(match[4]),
      fieldToggles: splitStringArray(match[5]),
    };
  }
  return null;
}

function extractAllFeatureFlags(homeHtml: string): Record<string, boolean | number | string> {
  const regex = /"([^"]+)":\s*{\s*"value"\s*:\s*([^,}]+)\s*}/g;
  const flags: Record<string, boolean | number | string> = {};
  for (const match of homeHtml.matchAll(regex)) {
    const rawValue = match[2];
    if (rawValue === 'true') {
      flags[match[1]] = true;
    } else if (rawValue === 'false') {
      flags[match[1]] = false;
    } else if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      flags[match[1]] = rawValue.slice(1, -1);
    } else {
      flags[match[1]] = Number(rawValue);
    }
  }
  return flags;
}

function splitStringArray(value: string): string[] {
  if (!value.trim()) return [];
  return value.split(',').map((item) => item.replace(/"/g, '').trim()).filter(Boolean);
}

function findUserId(json: unknown, handle: string): string | null {
  const wanted = handle.toLowerCase();

  function visit(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    const screenName = getNestedString(record, ['core', 'screen_name'])
      ?? getNestedString(record, ['legacy', 'screen_name'])
      ?? stringValue(record.screen_name);
    const restId = stringValue(record.rest_id);

    if (restId && screenName?.toLowerCase() === wanted) {
      return restId;
    }

    for (const child of Object.values(record)) {
      const found = visit(child);
      if (found) return found;
    }

    return null;
  }

  return visit(json);
}

function getNestedString(record: Record<string, unknown>, path: string[]): string | null {
  let value: unknown = record;
  for (const segment of path) {
    if (!value || typeof value !== 'object') return null;
    value = (value as Record<string, unknown>)[segment];
  }
  return stringValue(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function stopQueue() {
  const state = await getQueue();
  if (!state) return;

  const queue = state.queue.map((item) => {
    if (item.status === 'pending' || item.status === 'opened') {
      return { ...item, status: 'skipped' as const };
    }
    return item;
  });

  await saveQueue({ ...state, queue, active: false });
}

async function makeXHeaders(contentType: string): Promise<Headers> {
  const stored = await getStoredHeaders();
  if (!stored) throw new Error('Missing captured X auth headers');

  const headers = new Headers({
    accept: '*/*',
    'content-type': contentType,
    authorization: stored.authorization,
    'x-csrf-token': stored['x-csrf-token'],
    'x-twitter-active-user': stored['x-twitter-active-user'] ?? 'yes',
    'x-twitter-auth-type': stored['x-twitter-auth-type'] ?? 'OAuth2Session',
    'x-twitter-client-language': stored['x-twitter-client-language'] ?? 'en',
  });

  for (const key of ['x-client-uuid', 'x-client-transaction-id']) {
    if (stored[key]) headers.set(key, stored[key]);
  }

  return headers;
}

function normalizeHeaders(headers: chrome.webRequest.HttpHeader[]): StoredHeaders {
  return headers.reduce((acc, header) => {
    if (header.name && header.value) {
      acc[header.name.toLowerCase()] = header.value;
    }
    return acc;
  }, {} as StoredHeaders);
}

function pickUsefulHeaders(headers: StoredHeaders): StoredHeaders {
  const allowList = [
    'authorization',
    'x-csrf-token',
    'x-twitter-active-user',
    'x-twitter-auth-type',
    'x-twitter-client-language',
    'x-client-uuid',
    'x-client-transaction-id',
  ];

  return allowList.reduce((acc, key) => {
    if (headers[key]) acc[key] = headers[key];
    return acc;
  }, {} as StoredHeaders);
}

async function getStoredHeaders(): Promise<StoredHeaders | null> {
  const result = await chrome.storage.local.get(X_HEADERS_STORAGE_KEY);
  const headers = result[X_HEADERS_STORAGE_KEY] as StoredHeaders | undefined;
  return headers?.authorization && headers['x-csrf-token'] ? headers : null;
}

async function getQueue(): Promise<PersistedQueueState | null> {
  const result = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
  return (result[QUEUE_STORAGE_KEY] as PersistedQueueState | undefined) ?? null;
}

async function saveQueue(state: PersistedQueueState) {
  await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: state });
}

async function saveHistoryEntry(actionType: ActionType, queue: QueueItem[], startedAt: number) {
  const finishedAt = Date.now();
  const entry: ActionHistoryEntry = {
    id: `${finishedAt}-${Math.random().toString(36).slice(2, 8)}`,
    actionType,
    startedAt,
    finishedAt,
    total: queue.length,
    processed: queue.filter((item) => item.status === 'done').map((item) => item.handle),
    failed: queue.filter((item) => item.status === 'failed').map((item) => item.handle),
    skipped: queue.filter((item) => item.status === 'skipped' || item.status === 'pending' || item.status === 'opened').map((item) => item.handle),
  };

  const result = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
  const history = Array.isArray(result[HISTORY_STORAGE_KEY])
    ? result[HISTORY_STORAGE_KEY] as ActionHistoryEntry[]
    : [];

  await chrome.storage.local.set({
    [HISTORY_STORAGE_KEY]: [entry, ...history].slice(0, 100),
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Block Mode for X] Extension installed');
  }
});
