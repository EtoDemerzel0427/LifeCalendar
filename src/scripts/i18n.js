/** Tiny two-locale dictionary. Picked once from the browser language. */

const zh = {
  lang: 'zh-CN',
  skipToCalendar: '跳到日历',
  loading: '正在读取这一生…',
  loadError: '读不到 events.html。用本地服务器打开这个页面（比如 <code>python3 -m http.server</code>），别直接双击 index.html。',
  density: '格子大小',
  theme: '切换主题',
  themeAuto: '主题：跟随系统',
  themeLight: '主题：浅色',
  themeDark: '主题：深色',
  password: '解密口令',
  jumpToday: '回到今天',
  dayDetails: '当天详情',
  prevDay: '前一天',
  nextDay: '后一天',
  passwordTitle: '解密口令',
  passwordHint: '私密条目用 AES-256-GCM 加密（PBKDF2-SHA256，60 万轮）。口令只保存在本机浏览器里，不会上传。',
  passwordPlaceholder: '输入口令',
  passwordClear: '清除',
  cancel: '取消',
  save: '保存',
  searchPlaceholder: '搜索这些年的记录…',
  footerNote: '灵感来自',
  keyHints:
    '<kbd>t</kbd> 今天 · <kbd>/</kbd> 搜索 · <kbd>↑</kbd><kbd>↓</kbd> 前后一天 · <kbd>←</kbd><kbd>→</kbd> 前后一周 · <kbd>Esc</kbd> 关闭',
  ageUnit: '岁',
  statLived: '已度过',
  statLogged: '已记录',
  statLeft: '剩余',
  statProgress: '进度',
  unitDays: '天',
  today: '今天',
  ongoing: '至今',
  future: '还没到来',
  noRecord: '这一天没有记录',
  ageOn: (y, d) => `${y} 岁 ${d} 天`,
  dayNo: (n) => `第 ${n.toLocaleString('zh-CN')} 天`,
  matchCount: (i, n) => `${i} / ${n}`,
  noMatch: '无结果',
  encrypted: '🔒 加密内容',
  decryptError: '🔒 口令不对',
  passwordOn: '解密口令：已设置',
  passwordOff: '解密口令：未设置',
};

const en = {
  ...zh,
  lang: 'en',
  skipToCalendar: 'Skip to calendar',
  loading: 'Reading a life…',
  loadError:
    'Could not load events.html. Open this page through a local server (e.g. <code>python3 -m http.server</code>) rather than from the file system.',
  density: 'Cell size',
  theme: 'Toggle theme',
  themeAuto: 'Theme: system',
  themeLight: 'Theme: light',
  themeDark: 'Theme: dark',
  password: 'Decryption key',
  jumpToday: 'Jump to today',
  dayDetails: 'Day details',
  prevDay: 'Previous',
  nextDay: 'Next',
  passwordTitle: 'Decryption key',
  passwordHint: 'Private entries are AES-256-GCM encrypted (PBKDF2-SHA256, 600k rounds). The passphrase stays in this browser.',
  passwordPlaceholder: 'Enter key',
  passwordClear: 'Clear',
  cancel: 'Cancel',
  save: 'Save',
  searchPlaceholder: 'Search these years…',
  footerNote: 'Inspired by',
  keyHints:
    '<kbd>t</kbd> today · <kbd>/</kbd> search · <kbd>↑</kbd><kbd>↓</kbd> day · <kbd>←</kbd><kbd>→</kbd> week · <kbd>Esc</kbd> close',
  ageUnit: 'yrs',
  statLived: 'Lived',
  statLogged: 'Logged',
  statLeft: 'Left',
  statProgress: 'Elapsed',
  unitDays: 'days',
  today: 'Today',
  ongoing: 'now',
  future: 'Not yet',
  noRecord: 'Nothing recorded on this day',
  ageOn: (y, d) => `age ${y}, day ${d}`,
  dayNo: (n) => `day ${n.toLocaleString('en-US')}`,
  matchCount: (i, n) => `${i} / ${n}`,
  noMatch: 'no match',
  encrypted: '🔒 encrypted',
  decryptError: '🔒 wrong key',
  passwordOn: 'Decryption key: set',
  passwordOff: 'Decryption key: not set',
};

export const t = (navigator.language || 'en').toLowerCase().startsWith('zh') ? zh : en;

/** Fills in every element tagged with a `data-i18n*` attribute. */
export function applyI18n(scope = document) {
  document.documentElement.lang = t.lang;
  for (const el of scope.querySelectorAll('[data-i18n]')) {
    const value = t[el.dataset.i18n];
    if (value) el.innerHTML = value;
  }
  for (const el of scope.querySelectorAll('[data-i18n-label]')) {
    const value = t[el.dataset.i18nLabel];
    if (value) el.setAttribute('aria-label', value);
  }
  for (const el of scope.querySelectorAll('[data-i18n-placeholder]')) {
    const value = t[el.dataset.i18nPlaceholder];
    if (value) el.setAttribute('placeholder', value);
  }
}

const locale = t.lang === 'zh-CN' ? 'zh-CN' : 'en-US';

export const fmtFullDate = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' });
export const fmtWeekday = new Intl.DateTimeFormat(locale, { weekday: 'long' });
export const fmtMonth = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short' });
export const fmtNumber = new Intl.NumberFormat(locale);
