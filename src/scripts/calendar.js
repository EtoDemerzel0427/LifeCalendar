/**
 * Renders the grid.
 *
 * Layout: one section per year of life. Within a year, days run down a column
 * (Mon…Sun) and columns run forward in time — 53 columns for a year. On narrow
 * screens the 53 columns are split into 2 or 4 stripes so the grid always fits
 * the viewport instead of shrinking into dust; that is the `density` setting.
 *
 * A century of days is ~37 000 cells, so year bodies are only materialised
 * while they are near the viewport. Their height is reserved in CSS, which
 * keeps the scrollbar and any scroll target honest.
 */
import { clamp } from './utils.js';
import { fmtMonth, t } from './i18n.js';

const COLUMNS = 53;
const STRIPES = [1, 2, 4];
const EMOJI_MIN_CELL = 13;

export function createCalendar({ root, model, onSelect, onHover, onHoverEnd }) {
  const bodies = [];
  const nearViewport = new Set();
  let density = 0;
  let selected = -1;
  let matches = new Set();
  let hovered = -1;

  const canHover = matchMedia('(hover: hover)');

  const observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        if (record.isIntersecting) {
          nearViewport.add(record.target);
          fill(record.target);
        } else {
          nearViewport.delete(record.target);
          clear(record.target);
        }
      }
    },
    { rootMargin: '80% 0px' },
  );

  /* ---------- building ---------- */

  function mount() {
    const fragment = document.createDocumentFragment();
    for (const year of model.years) {
      const section = document.createElement('section');
      section.className = year.age % 10 === 0 ? 'year year--decade' : 'year';
      section.id = `age-${year.age}`;

      const head = document.createElement('header');
      head.className = 'year__head';
      head.innerHTML =
        `<span class="year__age">${year.age}<small>${t.ageUnit}</small></span>` +
        `<span class="year__range">${fmtMonth.format(year.start)} – ${fmtMonth.format(year.end)}</span>`;

      const body = document.createElement('div');
      body.className = 'year__body';
      body.dataset.age = String(year.age);

      section.append(head, body);
      fragment.append(section);
      bodies.push(body);
    }
    root.replaceChildren(fragment);
    root.removeAttribute('aria-busy');
    layout();
    for (const body of bodies) observer.observe(body);
  }

  function fill(body) {
    if (body.dataset.filled) return;
    const year = model.years[Number(body.dataset.age)];
    const perStripe = Math.ceil(COLUMNS / STRIPES[density]);
    const slots = year.lead + (year.to - year.from + 1);
    const fragment = document.createDocumentFragment();

    for (let stripe = 0; stripe * perStripe * 7 < slots; stripe += 1) {
      const first = stripe * perStripe * 7;
      const last = Math.min(slots, first + perStripe * 7);
      const grid = document.createElement('div');
      grid.className = 'year__grid';
      grid.style.setProperty('--cols', String(perStripe));
      for (let slot = first; slot < last; slot += 1) {
        grid.append(slot < year.lead ? padCell() : dayCell(year.from + slot - year.lead));
      }
      fragment.append(grid);
    }

    body.replaceChildren(fragment);
    body.dataset.filled = '1';
  }

  function clear(body) {
    if (!body.dataset.filled) return;
    body.replaceChildren();
    delete body.dataset.filled;
  }

  function padCell() {
    const pad = document.createElement('i');
    pad.className = 'pad';
    return pad;
  }

  function dayCell(index) {
    const el = document.createElement('i');
    const detail = model.details.get(index);
    const credit = Math.min(100, model.credits[index]);
    let className = 'day';
    let style = `--h:${model.hues[index]};--c:${credit.toFixed(1)}`;

    if (detail?.logged) className += ' is-logged';
    if (index === model.todayIndex) className += ' is-today';
    else if (index > model.todayIndex) className += ' is-future';
    else if (credit === 0 && !detail?.color) className += ' is-empty';
    if (index === selected) className += ' is-selected';
    if (matches.has(index)) className += ' is-match';

    if (detail) {
      if (detail.color) {
        style += `;background:${detail.color}`;
        className += ' has-color';
      }
      if (detail.icon) style += `;background-image:url("${detail.icon}");background-size:100% 100%`;
      if (detail.emoji) {
        className += ' day--emoji';
        el.textContent = detail.emoji;
      }
    }

    el.className = className;
    el.style.cssText = style;
    el.dataset.i = String(index);
    return el;
  }

  /* ---------- sizing ---------- */

  function layout() {
    const style = getComputedStyle(root);
    const width = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const columns = Math.ceil(COLUMNS / STRIPES[density]);
    const gap = clamp(Math.round((width / columns) * 0.2) / 2, 1, 3);
    const cell = Math.max(3, (width - (columns - 1) * gap) / columns);

    root.style.setProperty('--cell', `${cell.toFixed(2)}px`);
    root.style.setProperty('--cell-gap', `${gap}px`);
    root.style.setProperty('--segments', String(STRIPES[density]));
    root.dataset.emoji = cell >= EMOJI_MIN_CELL ? 'on' : 'off';
  }

  function setDensity(next) {
    if (next === density || !STRIPES[next]) return;
    density = next;
    layout();
    for (const body of bodies) clear(body);
    for (const body of nearViewport) fill(body);
  }

  /* ---------- state ---------- */

  const cellOf = (index) => root.querySelector(`.day[data-i="${index}"]`);

  function select(index) {
    if (index === selected) return;
    cellOf(selected)?.classList.remove('is-selected');
    selected = index;
    cellOf(selected)?.classList.add('is-selected');
  }

  function setMatches(next) {
    matches = next;
    // One pass over the rendered cells: a broad query can match thousands of
    // days, and looking each one up by selector would be quadratic.
    for (const el of root.querySelectorAll('.day')) {
      el.classList.toggle('is-match', matches.has(Number(el.dataset.i)));
    }
  }

  function yearOf(index) {
    return model.years.find((year) => index >= year.from && index <= year.to);
  }

  function scrollToIndex(index, { behavior = 'smooth', ping = false } = {}) {
    const year = yearOf(index);
    if (!year) return;
    const body = bodies[year.age];
    fill(body);

    const el = cellOf(index) ?? body;
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
    window.scrollTo({ top: Math.max(0, top), behavior });

    if (ping && el !== body) {
      el.classList.add('is-pinged');
      setTimeout(() => el.classList.remove('is-pinged'), 1900);
    }
  }

  /* ---------- input ---------- */

  root.addEventListener('click', (event) => {
    const el = event.target.closest('.day');
    if (!el) return;
    const index = Number(el.dataset.i);
    select(index);
    onSelect?.(index, el);
  });

  root.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch' || !canHover.matches) return;
    const el = event.target.closest('.day');
    if (!el) return;
    const index = Number(el.dataset.i);
    if (index === hovered) return;
    hovered = index;
    onHover?.(index, el);
  });

  root.addEventListener('pointerleave', () => {
    hovered = -1;
    onHoverEnd?.();
  });

  let resizeFrame = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layout);
  });

  return {
    mount,
    layout,
    setDensity,
    getDensity: () => density,
    select,
    getSelected: () => selected,
    setMatches,
    scrollToIndex,
    cellOf,
  };
}
