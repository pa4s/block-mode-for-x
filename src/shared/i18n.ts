type Language = 'en' | 'zh';

type MessageKey =
  | 'action.block'
  | 'action.mute'
  | 'action.review'
  | 'action.copy'
  | 'action.import'
  | 'action.history'
  | 'action.copyHistoryAccounts'
  | 'action.clear'
  | 'action.exit'
  | 'action.stop'
  | 'action.cancel'
  | 'action.remove'
  | 'action.openCurrent'
  | 'action.copyHandles'
  | 'action.copyReport'
  | 'action.autoBlock'
  | 'action.autoMute'
  | 'action.selectVisible'
  | 'action.deselectVisible'
  | 'aria.enterBlockMode'
  | 'aria.exitBlockMode'
  | 'aria.shrinkFloatingBall'
  | 'aria.hideFloatingBall'
  | 'blockMode.title'
  | 'status.selectedAccounts'
  | 'status.selectAccounts'
  | 'queue.autoBlock'
  | 'queue.autoMute'
  | 'queue.lastFailed'
  | 'queue.running'
  | 'queue.processed'
  | 'done.title'
  | 'done.processed'
  | 'done.skipped'
  | 'done.exitBlockMode'
  | 'report.action'
  | 'report.processed'
  | 'report.skipped'
  | 'review.blockTitle'
  | 'review.muteTitle'
  | 'review.count'
  | 'import.title'
  | 'import.description'
  | 'import.placeholder'
  | 'import.confirm'
  | 'history.title'
  | 'history.description'
  | 'history.empty'
  | 'history.summary'
  | 'history.runStats'
  | 'history.completedAt'
  | 'history.copyDone'
  | 'selected.badge'
  | 'select.title'
  | 'toast.noAccounts'
  | 'toast.copiedHandles'
  | 'toast.reportCopied'
  | 'toast.importedHandles'
  | 'toast.importNoValidHandles'
  | 'toast.floatingShrunk'
  | 'toast.floatingHidden'
  | 'toast.blockModeActivated'
  | 'toast.selectedVisible'
  | 'toast.deselectedVisible'
  | 'toast.queueStartFailed'
  | 'toast.missingHeaders'
  | 'toast.blockQueueRunning'
  | 'toast.muteQueueRunning'
  | 'toast.stopQueueFailed'
  | 'help.title'
  | 'help.selection'
  | 'help.actions'
  | 'help.queue'
  | 'help.general'
  | 'help.rangeSelect'
  | 'help.selectVisible'
  | 'help.deselectVisible'
  | 'help.blockSelected'
  | 'help.muteSelected'
  | 'help.reviewList'
  | 'help.copyHandles'
  | 'help.importAccounts'
  | 'help.openProfile'
  | 'help.markDone'
  | 'help.skip'
  | 'help.exit'
  | 'help.thisHelp';

type MessageParams = Record<string, string | number>;

const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  en: {
    'action.block': 'Block',
    'action.mute': 'Mute',
    'action.review': 'Review',
    'action.copy': 'Copy',
    'action.import': 'Import',
    'action.history': 'History',
    'action.copyHistoryAccounts': 'Copy Accounts',
    'action.clear': 'Clear',
    'action.exit': 'Exit',
    'action.stop': 'Stop',
    'action.cancel': 'Cancel',
    'action.remove': 'Remove',
    'action.openCurrent': 'Open Current',
    'action.copyHandles': 'Copy Handles',
    'action.copyReport': 'Copy Report',
    'action.autoBlock': 'Auto Block in Background',
    'action.autoMute': 'Auto Mute in Background',
    'action.selectVisible': 'Select on screen',
    'action.deselectVisible': 'Deselect on screen',
    'aria.enterBlockMode': 'Enter Batch Mode',
    'aria.exitBlockMode': 'Exit Batch Mode',
    'aria.shrinkFloatingBall': 'Shrink floating button',
    'aria.hideFloatingBall': 'Hide floating button',
    'blockMode.title': 'Batch Mode',
    'status.selectedAccounts': 'Selected accounts',
    'status.selectAccounts': 'Select accounts',
    'queue.autoBlock': 'Auto Block Queue',
    'queue.autoMute': 'Auto Mute Queue',
    'queue.lastFailed': 'Last item failed, continuing',
    'queue.running': 'Running in background',
    'queue.processed': 'Processed {completed} of {total}',
    'done.title': 'Finished',
    'done.processed': 'Processed',
    'done.skipped': 'Skipped',
    'done.exitBlockMode': 'Exit Batch Mode',
    'report.action': 'Action: {action}',
    'report.processed': 'Processed:',
    'report.skipped': 'Skipped:',
    'review.blockTitle': 'Review Block Queue',
    'review.muteTitle': 'Review Mute Queue',
    'review.count': '{count} accounts selected',
    'import.title': 'Import accounts',
    'import.description': 'Paste handles or X profile links, one per line or separated by spaces.',
    'import.placeholder': '@jack\nx.com/elonmusk\nusername_123',
    'import.confirm': 'Import',
    'history.title': 'History',
    'history.description': 'Successful block and mute runs are saved locally.',
    'history.empty': 'No block or mute history yet.',
    'history.summary': '{blocked} blocked · {muted} muted',
    'history.runStats': '{done} done · {failed} failed · {skipped} skipped · {total} total',
    'history.completedAt': 'Completed {time}',
    'history.copyDone': 'Copied',
    'selected.badge': 'Selected',
    'select.title': 'Select @{handle}',
    'toast.noAccounts': 'No accounts selected',
    'toast.copiedHandles': 'Copied {count} handles',
    'toast.reportCopied': 'Report copied',
    'toast.importedHandles': 'Imported {added} new accounts, recognized {parsed}, selected {total} total',
    'toast.importNoValidHandles': 'No valid X accounts found',
    'toast.floatingShrunk': 'Floating button shrunk',
    'toast.floatingHidden': 'Floating button hidden. Reload the page to show it again.',
    'toast.blockModeActivated': 'Block Mode activated',
    'toast.selectedVisible': 'Selected {count} accounts on screen',
    'toast.deselectedVisible': 'Deselected {count} accounts on screen',
    'toast.queueStartFailed': 'Could not start background queue',
    'toast.missingHeaders': 'Open or reload x.com once, then try again',
    'toast.blockQueueRunning': 'Block queue running in background',
    'toast.muteQueueRunning': 'Mute queue running in background',
    'toast.stopQueueFailed': 'Could not stop background queue',
    'help.title': 'Keyboard Shortcuts',
    'help.selection': 'Selection',
    'help.actions': 'Actions',
    'help.queue': 'Queue',
    'help.general': 'General',
    'help.rangeSelect': 'Range select',
    'help.selectVisible': 'Select accounts on screen',
    'help.deselectVisible': 'Deselect accounts on screen',
    'help.blockSelected': 'Block selected',
    'help.muteSelected': 'Mute selected',
    'help.reviewList': 'Review list',
    'help.copyHandles': 'Copy handles',
    'help.importAccounts': 'Import accounts',
    'help.openProfile': 'Open profile',
    'help.markDone': 'Mark done / Next',
    'help.skip': 'Skip',
    'help.exit': 'Exit',
    'help.thisHelp': 'This help',
  },
  zh: {
    'action.block': '屏蔽',
    'action.mute': '静音',
    'action.review': '检查',
    'action.copy': '复制',
    'action.import': '导入',
    'action.history': '历史记录',
    'action.copyHistoryAccounts': '复制账号',
    'action.clear': '清空',
    'action.exit': '退出',
    'action.stop': '停止',
    'action.cancel': '取消',
    'action.remove': '移除',
    'action.openCurrent': '打开当前',
    'action.copyHandles': '复制账号',
    'action.copyReport': '复制报告',
    'action.autoBlock': '后台自动屏蔽',
    'action.autoMute': '后台自动静音',
    'action.selectVisible': '选择当前屏幕',
    'action.deselectVisible': '取消当前屏幕',
    'aria.enterBlockMode': '进入批量处理',
    'aria.exitBlockMode': '退出批量处理',
    'aria.shrinkFloatingBall': '缩小悬浮球',
    'aria.hideFloatingBall': '隐藏悬浮球',
    'blockMode.title': '批量处理',
    'status.selectedAccounts': '已选账号',
    'status.selectAccounts': '选择账号',
    'queue.autoBlock': '后台屏蔽队列',
    'queue.autoMute': '后台静音队列',
    'queue.lastFailed': '上一项失败，继续处理中',
    'queue.running': '正在后台处理',
    'queue.processed': '已处理 {completed} / {total}',
    'done.title': '已完成',
    'done.processed': '完成',
    'done.skipped': '跳过',
    'done.exitBlockMode': '退出批量处理',
    'report.action': '操作：{action}',
    'report.processed': '已完成：',
    'report.skipped': '已跳过：',
    'review.blockTitle': '检查屏蔽队列',
    'review.muteTitle': '检查静音队列',
    'review.count': '已选择 {count} 个账号',
    'import.title': '批量导入账号',
    'import.description': '粘贴 @账号、X 主页链接或用户名，支持换行、空格和逗号分隔。',
    'import.placeholder': '@jack\nx.com/elonmusk\nusername_123',
    'import.confirm': '导入',
    'history.title': '历史记录',
    'history.description': '后台成功屏蔽和静音过的账号会保存在本地。',
    'history.empty': '还没有屏蔽或静音历史。',
    'history.summary': '已屏蔽 {blocked} · 已静音 {muted}',
    'history.runStats': '完成 {done} · 失败 {failed} · 跳过 {skipped} · 总计 {total}',
    'history.completedAt': '{time} 完成',
    'history.copyDone': '已复制',
    'selected.badge': '已选择',
    'select.title': '选择 @{handle}',
    'toast.noAccounts': '还没有选择账号',
    'toast.copiedHandles': '已复制 {count} 个账号',
    'toast.reportCopied': '报告已复制',
    'toast.importedHandles': '已导入 {added} 个新账号，识别 {parsed} 个，当前共 {total} 个',
    'toast.importNoValidHandles': '没有识别到有效 X 账号',
    'toast.floatingShrunk': '悬浮球已缩小',
    'toast.floatingHidden': '悬浮球已隐藏，刷新页面后会重新显示',
    'toast.blockModeActivated': '屏蔽模式已开启',
    'toast.selectedVisible': '已选择当前屏幕 {count} 个账号',
    'toast.deselectedVisible': '已取消当前屏幕 {count} 个账号',
    'toast.queueStartFailed': '无法启动后台队列',
    'toast.missingHeaders': '请先打开或刷新一次 x.com，然后重试',
    'toast.blockQueueRunning': '屏蔽队列正在后台运行',
    'toast.muteQueueRunning': '静音队列正在后台运行',
    'toast.stopQueueFailed': '无法停止后台队列',
    'help.title': '快捷键',
    'help.selection': '选择',
    'help.actions': '操作',
    'help.queue': '队列',
    'help.general': '通用',
    'help.rangeSelect': '区间选择',
    'help.selectVisible': '选择当前屏幕账号',
    'help.deselectVisible': '取消当前屏幕账号',
    'help.blockSelected': '屏蔽已选',
    'help.muteSelected': '静音已选',
    'help.reviewList': '检查列表',
    'help.copyHandles': '复制账号',
    'help.importAccounts': '导入账号',
    'help.openProfile': '打开主页',
    'help.markDone': '标记完成 / 下一条',
    'help.skip': '跳过',
    'help.exit': '退出',
    'help.thisHelp': '查看帮助',
  },
};

export function getLanguage(): Language {
  const language = chrome.i18n?.getUILanguage?.() || navigator.language || 'en';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function t(key: MessageKey, params: MessageParams = {}): string {
  const template = MESSAGES[getLanguage()][key] ?? MESSAGES.en[key] ?? key;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
    template,
  );
}
