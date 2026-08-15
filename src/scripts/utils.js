/** Date math, emoji detection and a couple of DOM helpers. */

const MS_PER_DAY = 86_400_000;

/**
 * Days are addressed by a UTC-based ordinal so that daylight-saving shifts
 * can never move a day into its neighbour's box.
 */
export function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/** Accepts `YYYY-MM-DD` and the `M/D/YYYY` form used by events.html. */
export function parseDate(input) {
  if (input instanceof Date) return input;
  const text = String(input).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addYears(date, years) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

/** Monday = 0 … Sunday = 6, which is how the grid rows are ordered. */
export function weekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export function isoKey(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ---------- emoji ---------- */

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/**
 * First emoji in a string, as a whole grapheme (so skin tones and ZWJ
 * sequences survive). Replaces the 200-line regex the old version carried.
 */
export function firstEmoji(text) {
  if (!text || !PICTOGRAPHIC.test(text)) return '';
  if (segmenter) {
    for (const { segment } of segmenter.segment(text)) {
      if (PICTOGRAPHIC.test(segment)) return segment;
    }
    return '';
  }
  const match = text.match(
    /\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic})*/u,
  );
  return match ? match[0] : '';
}

/* ---------- misc ---------- */

export function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export const $ = (selector, scope = document) => scope.querySelector(selector);

/** Wraps every occurrence of `query` in <mark>, without touching markup. */
export function highlight(container, query) {
  if (!query) return;
  const needle = query.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const targets = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue.toLowerCase().includes(needle)) targets.push(walker.currentNode);
  }
  for (const node of targets) {
    const fragment = document.createDocumentFragment();
    const text = node.nodeValue;
    let from = 0;
    let at = text.toLowerCase().indexOf(needle);
    while (at !== -1) {
      fragment.append(text.slice(from, at));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(at, at + needle.length);
      fragment.append(mark);
      from = at + needle.length;
      at = text.toLowerCase().indexOf(needle, from);
    }
    fragment.append(text.slice(from));
    node.replaceWith(fragment);
  }
}
