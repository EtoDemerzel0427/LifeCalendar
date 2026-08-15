/**
 * The data model: one entry per day of the projected lifetime.
 *
 * Hot per-day fields live in typed arrays (a century is ~37 000 days), while
 * the sparse extras — colours, emoji, the events themselves — live in a Map
 * keyed by day index. Rendering never touches the DOM to answer a question.
 */
import { CONFIG } from './config.js';
import { addDays, addYears, dayNumber, parseDate, weekdayIndex } from './utils.js';

export function buildModel(entries, { config = CONFIG, today = new Date() } = {}) {
  const birth = parseDate(config.birth);
  const death = addYears(birth, config.lifeExpectancy);
  const birthNo = dayNumber(birth);
  const totalDays = dayNumber(death) - birthNo;

  const credits = new Float32Array(totalDays);
  const hues = new Uint16Array(totalDays).fill(config.defaultHue);
  const details = new Map();
  const periods = [];

  const indexOf = (date) => dayNumber(date) - birthNo;
  const dateAt = (index) => addDays(birth, index);
  const detailAt = (index) => {
    let detail = details.get(index);
    if (!detail) {
      detail = { color: null, icon: null, emoji: '', logged: false, entries: [] };
      details.set(index, detail);
    }
    return detail;
  };

  const todayIndex = Math.min(totalDays - 1, Math.max(-1, indexOf(today)));

  for (const entry of entries) {
    const from = Math.max(0, indexOf(entry.start));
    // An entry with no end is still running: it reaches today and stops there,
    // because nobody has lived tomorrow yet.
    const to = Math.min(totalDays - 1, entry.end ? indexOf(entry.end) : todayIndex);
    if (to < from) continue;

    if (entry.kind === 'period') periods.push({ ...entry, from, to });

    for (let i = from; i <= to; i++) {
      credits[i] += entry.credit;
      if (entry.hue !== null) hues[i] = entry.hue;

      const detail = detailAt(i);
      detail.entries.push(entry);
      // Later events override earlier ones, as they always have.
      if (entry.color) detail.color = entry.color;
      if (entry.icon) detail.icon = entry.icon;
      if (entry.kind === 'day') {
        detail.logged = true;
        if (entry.emoji) detail.emoji = entry.emoji;
      }
    }
  }

  const years = [];
  for (let age = 0; age < config.lifeExpectancy; age += 1) {
    const start = addYears(birth, age);
    const from = indexOf(start);
    const to = Math.min(totalDays - 1, indexOf(addYears(birth, age + 1)) - 1);
    years.push({ age, from, to, start, end: dateAt(to), lead: weekdayIndex(start) });
  }

  let logged = 0;
  for (const detail of details.values()) if (detail.logged) logged += 1;

  const lived = todayIndex + 1;

  return {
    config,
    birth,
    death,
    totalDays,
    todayIndex,
    credits,
    hues,
    details,
    periods,
    years,
    stats: {
      lived,
      logged,
      left: Math.max(0, totalDays - lived),
      progress: lived / totalDays,
    },
    indexOf,
    dateAt,

    /** Everything the detail panel needs about one day. */
    dayAt(index) {
      const detail = details.get(index);
      return {
        index,
        date: dateAt(index),
        credit: credits[index],
        hue: hues[index],
        color: detail?.color ?? null,
        emoji: detail?.emoji ?? '',
        entries: detail?.entries ?? [],
        isToday: index === todayIndex,
        isFuture: index > todayIndex,
        age: ageOn(birth, dateAt(index)),
      };
    },

    /** Day indices whose logged text contains `query` (periods excluded). */
    search(query) {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];
      const hits = [];
      for (const [index, detail] of details) {
        const hit = detail.entries.some(
          (entry) => entry.kind !== 'period' && entry.text.toLowerCase().includes(needle),
        );
        if (hit) hits.push(index);
      }
      return hits.sort((a, b) => a - b);
    },
  };
}

/** Age at a date, as whole years plus the days since that birthday. */
export function ageOn(birth, date) {
  let years = date.getFullYear() - birth.getFullYear();
  const anniversary = addYears(birth, years);
  if (anniversary > date) {
    years -= 1;
  }
  const last = addYears(birth, years);
  return { years, days: dayNumber(date) - dayNumber(last) };
}
