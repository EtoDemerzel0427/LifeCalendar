/** Wiring: load the data, build the model, hand it to the views. */
import { CONFIG, STORAGE } from './config.js';
import { applyI18n, t } from './i18n.js';
import { fetchEventsDocument, parseEvents } from './events.js';
import { buildModel } from './model.js';
import { createCalendar } from './calendar.js';
import { createPanel } from './panel.js';
import { createSearch } from './search.js';
import { renderLegend, renderStats } from './stats.js';
import { initTheme } from './theme.js';
import { getPassword, setPassword } from './crypto.js';
import { $, isoKey, parseDate } from './utils.js';

history.scrollRestoration = 'manual';

applyI18n();
initTheme($('#theme-btn'));
initTopbar();
initPasswordDialog();
$('#motto').textContent = CONFIG.motto;

start();

async function start() {
  let doc;
  try {
    doc = await fetchEventsDocument();
  } catch (error) {
    console.error(error);
    const placeholder = $('#placeholder');
    placeholder.className = 'placeholder placeholder--error';
    placeholder.innerHTML = t.loadError;
    return;
  }

  const { entries } = await parseEvents(doc, getPassword());
  const model = buildModel(entries);

  const panel = createPanel({
    model,
    onNavigate: (index) => openDay(index, { follow: true }),
  });

  const calendar = createCalendar({
    root: $('#calendar'),
    model,
    onSelect: (index, el) => openDay(index, { anchor: el }),
    onHover: (index, el) => panel.preview(index, el),
    onHoverEnd: () => panel.endPreview(),
  });

  calendar.mount();
  renderStats(model);
  renderLegend(model, (index) => jumpTo(index));

  const search = createSearch({
    model,
    onJump: (index) => jumpTo(index, { open: true }),
    onQuery: (query, hits) => {
      calendar.setMatches(new Set(hits));
      panel.setQuery(query);
    },
  });

  initDensity(calendar, model);

  $('#today-btn').addEventListener('click', () => jumpTo(model.todayIndex));

  /* ---------- day interactions ---------- */

  function openDay(index, { anchor, follow = false } = {}) {
    calendar.select(index);
    let el = anchor ?? calendar.cellOf(index);
    if (follow && (!el || !inView(el))) {
      calendar.scrollToIndex(index, { behavior: 'auto' });
      el = calendar.cellOf(index);
    }
    panel.show(index, el, true);
    history.replaceState(null, '', `#${isoKey(model.dateAt(index))}`);
  }

  function jumpTo(index, { open = false } = {}) {
    calendar.scrollToIndex(index, { behavior: 'auto', ping: true });
    if (open) openDay(index);
    else calendar.select(index);
  }

  /* ---------- keyboard ---------- */

  const STEPS = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1, PageUp: -364, PageDown: 364 };

  addEventListener('keydown', (event) => {
    const focused = event.target;
    const typing =
      focused instanceof HTMLElement && (focused.matches('input, textarea') || focused.isContentEditable);
    if (event.key === 'Escape') {
      if (typing) focused.blur();
      else panel.close();
      return;
    }
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === '/') {
      event.preventDefault();
      search.focus();
      return;
    }
    if (event.key === 't') {
      // Keyboard entry point into the grid: land on today, then use arrows.
      jumpTo(model.todayIndex, { open: true });
      return;
    }
    if (!panel.isPinned()) return;

    const step = STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = Math.min(model.totalDays - 1, Math.max(0, panel.getIndex() + step));
    openDay(next, { follow: true });
  });

  /* ---------- entry point on the page ---------- */

  // Wait for stylesheets and fonts: cell size — and therefore every reserved
  // year height — is measured from them, and the opening scroll depends on it.
  if (document.readyState !== 'complete') {
    await new Promise((resolve) => addEventListener('load', resolve, { once: true }));
  }
  calendar.layout();

  const linked = parseDate(location.hash.slice(1));
  const startIndex = linked ? clampIndex(model, model.indexOf(linked)) : model.todayIndex;
  calendar.scrollToIndex(startIndex, { behavior: 'auto' });
  if (linked) openDay(startIndex);
}

/* ---------- helpers ---------- */

function clampIndex(model, index) {
  return Math.min(model.totalDays - 1, Math.max(0, index));
}

function inView(el) {
  const rect = el.getBoundingClientRect();
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0;
  return rect.top >= top + 8 && rect.bottom <= innerHeight - 8;
}

function initTopbar() {
  const topbar = $('.topbar');
  const input = $('#search-input');

  const measure = () =>
    document.documentElement.style.setProperty('--topbar-h', `${Math.round(topbar.offsetHeight)}px`);
  new ResizeObserver(measure).observe(topbar);
  measure();

  const update = () => {
    topbar.classList.toggle('is-stuck', scrollY > 4);
    topbar.classList.toggle('is-compact', scrollY > 72);
  };
  addEventListener('scroll', update, { passive: true });

  const keepSearch = () => topbar.classList.toggle('has-search', document.activeElement === input || !!input.value);
  input.addEventListener('focus', keepSearch);
  input.addEventListener('blur', keepSearch);
  input.addEventListener('input', keepSearch);
  update();
}

function initDensity(calendar, model) {
  const buttons = [...document.querySelectorAll('[data-density]')];
  const stored = localStorage.getItem(STORAGE.density);
  const remembered = stored === null ? Number.NaN : Number(stored);
  // Phones start one step larger: fit-to-width cells are ~6px there.
  const initial =
    Number.isInteger(remembered) && remembered >= 0 && remembered < buttons.length
      ? remembered
      : innerWidth < 700
        ? 1
        : 0;

  const apply = (value, { keepPlace = false } = {}) => {
    const anchor = keepPlace ? centerIndex(model) : -1;
    calendar.setDensity(value);
    for (const button of buttons) button.setAttribute('aria-pressed', String(Number(button.dataset.density) === value));
    localStorage.setItem(STORAGE.density, String(value));
    if (anchor >= 0) calendar.scrollToIndex(anchor, { behavior: 'auto' });
  };

  for (const button of buttons) {
    button.addEventListener('click', () => apply(Number(button.dataset.density), { keepPlace: true }));
  }
  apply(initial);
}

function centerIndex(model) {
  const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const day = el?.closest?.('.day');
  if (day) return Number(day.dataset.i);
  const body = el?.closest?.('.year__body');
  if (body) return model.years[Number(body.dataset.age)].from;
  return model.todayIndex;
}

function initPasswordDialog() {
  const dialog = $('#pw-dialog');
  const input = $('#pw-input');
  const lock = $('#lock-btn');

  const reflect = () => {
    const has = Boolean(getPassword());
    lock.setAttribute('aria-pressed', String(has));
    lock.title = has ? t.passwordOn : t.passwordOff;
  };

  lock.addEventListener('click', () => {
    input.value = getPassword() ?? '';
    dialog.showModal();
    input.focus();
  });

  $('#pw-cancel').addEventListener('click', () => dialog.close());
  $('#pw-clear').addEventListener('click', () => {
    setPassword(null);
    location.reload();
  });
  $('#pw-form').addEventListener('submit', () => {
    setPassword(input.value.trim() || null);
    location.reload();
  });

  reflect();
}
