/** Free-text search over the logged days, with jump-to-match navigation. */
import { $, debounce } from './utils.js';
import { t } from './i18n.js';

export function createSearch({ model, onJump, onQuery }) {
  const input = $('#search-input');
  const count = $('#search-count');
  const nav = $('#search-nav');

  let hits = [];
  let cursor = -1;

  function run(value) {
    const query = value.trim();
    hits = query ? model.search(query) : [];
    cursor = -1;
    nav.hidden = hits.length === 0;
    count.textContent = !query ? '' : hits.length ? String(hits.length) : t.noMatch;
    onQuery(query, hits);
  }

  function go(step) {
    if (!hits.length) return;
    if (cursor === -1) cursor = hits.length - 1; // start at the most recent hit
    else cursor = (cursor + step + hits.length) % hits.length;
    count.textContent = t.matchCount(cursor + 1, hits.length);
    onJump(hits[cursor]);
  }

  input.addEventListener('input', debounce((event) => run(event.target.value), 180));
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    go(event.shiftKey ? -1 : 1);
  });

  $('#search-prev').addEventListener('click', () => go(-1));
  $('#search-next').addEventListener('click', () => go(1));

  return { focus: () => input.focus() };
}
