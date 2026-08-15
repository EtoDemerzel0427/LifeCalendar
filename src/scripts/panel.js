/**
 * The day detail view: a popover next to the cell when there is a mouse,
 * a bottom sheet when there is not. One component, two presentations.
 */
import { $, highlight } from './utils.js';
import { fmtFullDate, fmtWeekday, t } from './i18n.js';

const SHEET = matchMedia('(pointer: coarse), (max-width: 700px)');
const EDGE = 10;

export function createPanel({ model, onNavigate, onClose }) {
  const panel = $('#panel');
  const scrim = $('#panel-scrim');
  const dateEl = $('#panel-date');
  const metaEl = $('#panel-meta');
  const chipsEl = $('#panel-chips');
  const bodyEl = $('#panel-body');
  const prevBtn = $('#panel-prev');
  const nextBtn = $('#panel-next');

  let index = -1;
  let pinned = false;
  let query = '';

  bodyEl.dataset.empty = t.noRecord;

  /* ---------- rendering ---------- */

  function swatch(color) {
    const span = document.createElement('span');
    span.className = 'chip__swatch';
    span.style.background = color;
    return span;
  }

  function hueColor(hue) {
    return (
      `hsl(${hue} calc(var(--cell-sat0) + var(--swatch-i) * var(--cell-satk))` +
      ' calc(var(--cell-l0) - var(--swatch-i) * var(--cell-k)))'
    );
  }

  function render() {
    const day = model.dayAt(index);

    dateEl.textContent = fmtFullDate.format(day.date);
    const meta = [fmtWeekday.format(day.date), t.ageOn(day.age.years, day.age.days), t.dayNo(index + 1)];
    if (day.isToday) meta.unshift(t.today);
    else if (day.isFuture) meta.unshift(t.future);
    metaEl.innerHTML = meta.join('<span class="dot">·</span>');

    chipsEl.replaceChildren();
    bodyEl.replaceChildren();

    for (const entry of day.entries) {
      if (entry.kind === 'period') {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.append(swatch(entry.color ?? hueColor(entry.hue ?? day.hue)), entry.text);
        chipsEl.append(chip);
      } else {
        const block = document.createElement('div');
        block.className = entry.kind === 'span' ? 'entry entry--span' : 'entry';
        block.innerHTML = entry.html;
        if (entry.color) block.style.borderLeftColor = entry.color;
        bodyEl.append(block);
      }
    }

    if (query) highlight(bodyEl, query);

    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= model.totalDays - 1;
  }

  /* ---------- placement ---------- */

  function position(anchor) {
    if (SHEET.matches) {
      panel.style.removeProperty('top');
      panel.style.removeProperty('left');
      return;
    }
    if (!anchor) {
      // No cell to point at (its year is not rendered): centre it instead.
      const box = panel.getBoundingClientRect();
      panel.style.left = `${scrollX + (innerWidth - box.width) / 2}px`;
      panel.style.top = `${scrollY + (innerHeight - box.height) / 2}px`;
      return;
    }
    // Measure first, then place: the panel is absolutely positioned in page
    // coordinates so it stays glued to the grid while scrolling.
    panel.style.top = '0px';
    panel.style.left = '0px';
    const box = panel.getBoundingClientRect();
    const cell = anchor.getBoundingClientRect();

    let left = cell.right + 12;
    if (left + box.width > innerWidth - EDGE) left = cell.left - box.width - 12;
    left = Math.max(EDGE, Math.min(left, innerWidth - box.width - EDGE));

    let top = cell.top - 10;
    top = Math.max(EDGE, Math.min(top, innerHeight - box.height - EDGE));

    panel.style.left = `${left + scrollX}px`;
    panel.style.top = `${top + scrollY}px`;
  }

  /* ---------- api ---------- */

  function show(nextIndex, anchor, pin) {
    index = nextIndex;
    pinned = pin;
    panel.hidden = false;
    render();
    position(anchor);
    scrim.hidden = !(pin && SHEET.matches);
    document.body.classList.toggle('panel-open', pin);
  }

  function preview(nextIndex, anchor) {
    if (!pinned) show(nextIndex, anchor, false);
  }

  function endPreview() {
    if (!pinned) close();
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    scrim.hidden = true;
    pinned = false;
    index = -1;
    document.body.classList.remove('panel-open');
    onClose?.();
  }

  function move(delta) {
    const next = index + delta;
    if (next < 0 || next >= model.totalDays) return;
    onNavigate?.(next);
  }

  prevBtn.addEventListener('click', () => move(-1));
  nextBtn.addEventListener('click', () => move(1));
  $('#panel-close').addEventListener('click', close);
  scrim.addEventListener('click', close);

  return {
    show,
    preview,
    endPreview,
    close,
    move,
    isOpen: () => !panel.hidden,
    isPinned: () => pinned,
    getIndex: () => index,
    setQuery: (value) => {
      query = value;
      if (!panel.hidden) render();
    },
  };
}
