/**
 * Reads events.html and turns it into plain data.
 *
 * The data format is unchanged, so any bot that appends to events.html keeps
 * working. Every child of `#events` is one entry:
 *
 *   date="M/D/YYYY"          a single day
 *   start=… end=…            a stretch of days; drop `end` (or write
 *                            end="now") for a period that is still running
 *   class="base" hue="0-360" a life period: paints the base colour underneath
 *   credit="0-100"           how much that day counted
 *   color="#rrggbb"          override the computed colour
 *   icon="url"               background image for the cell
 *
 * Text nodes beginning with `*v2:` are ciphertext (see crypto.js).
 */
import { CONFIG } from './config.js';
import { CIPHER_PREFIX, decryptEntry, deriveKey } from './crypto.js';
import { firstEmoji, parseDate } from './utils.js';
import { t } from './i18n.js';

export async function fetchEventsDocument(url = CONFIG.eventsUrl) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * @returns {Promise<{entries: Array, encrypted: number}>} entries in document
 * order — later ones intentionally win over earlier ones.
 */
export async function parseEvents(doc, password) {
  const root = doc.getElementById('events');
  if (!root) return { entries: [], encrypted: 0 };

  const nodes = [...root.children];
  const secrets = nodes.flatMap((node) =>
    [...node.childNodes].filter(
      (child) => child.nodeType === Node.TEXT_NODE && child.nodeValue.trim().startsWith(CIPHER_PREFIX),
    ),
  );

  if (secrets.length) {
    await unlock(secrets, password, root);
  }

  const entries = [];
  for (const node of nodes) {
    const entry = toEntry(node);
    if (entry) entries.push(entry);
  }
  return { entries, encrypted: secrets.length };
}

/**
 * Replaces every ciphertext node in place. The passphrase is stretched once for
 * the whole file — see crypto.js for why the salt lives on `#events`.
 */
async function unlock(secrets, password, root) {
  if (!password) {
    for (const node of secrets) node.nodeValue = t.encrypted;
    return;
  }

  const salt = root.dataset.kdfSalt;
  if (!salt) {
    for (const node of secrets) node.nodeValue = t.decryptError;
    return;
  }

  const key = await deriveKey(password, salt, Number(root.dataset.kdfIterations) || undefined);
  for (const node of secrets) {
    const plain = await decryptEntry(node.nodeValue.trim().slice(CIPHER_PREFIX.length), key);
    node.nodeValue = plain || t.decryptError;
  }
}

/** `end` may be left out, or written as `now`, to mean "still going". */
const ONGOING = new Set(['', 'now', 'today', 'ongoing']);

function toEntry(node) {
  const attr = (name) => node.getAttribute(name);
  const single = attr('date');
  const rawEnd = (single ?? attr('end') ?? '').trim();
  const start = parseDate(single ?? attr('start') ?? '');
  const ongoing = !single && ONGOING.has(rawEnd.toLowerCase());
  const end = ongoing ? null : parseDate(rawEnd);
  if (!start || (!ongoing && (!end || end < start))) return null;

  const credit = Number.parseFloat(attr('credit'));
  const hue = Number.parseInt(attr('hue'), 10);
  const isPeriod = node.classList.contains('base');
  const text = node.textContent.replace(/\s+/g, ' ').trim();

  return {
    kind: isPeriod ? 'period' : single ? 'day' : 'span',
    start,
    /** null while the period is open — the model closes it at today. */
    end,
    ongoing,
    credit: Number.isFinite(credit) ? credit : CONFIG.defaultCredit,
    hue: Number.isFinite(hue) ? hue : null,
    color: attr('color'),
    icon: attr('icon'),
    emoji: single ? firstEmoji(text) : '',
    html: node.innerHTML.trim(),
    text,
  };
}
