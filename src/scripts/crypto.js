/**
 * Private entries.
 *
 * An entry whose text starts with `*v2:` is ciphertext. The format is
 *
 *   *v2:base64( iv[12] || AES-256-GCM ciphertext || tag[16] )
 *
 * with the key derived from your passphrase by PBKDF2-SHA-256 over a random
 * salt stored once on the `#events` element:
 *
 *   <div id="events" data-kdf-salt="…" data-kdf-iterations="600000">
 *
 * One salt per file means the key is derived once per page load, no matter how
 * many entries are encrypted — per-entry salts would cost a full PBKDF2 run
 * each. Uniqueness is carried by the per-entry random IV instead.
 *
 * What this does and does not buy you: the ciphertext sits in a public repo
 * forever, so an attacker can grind guesses offline at their leisure. GCM stops
 * tampering and 600k PBKDF2 rounds make each guess expensive, but the real
 * defence is passphrase entropy — use five or six random words, not a password
 * you can type from muscle memory.
 *
 * Everything here is WebCrypto; there is no library to load.
 */
import { STORAGE } from './config.js';

export const CIPHER_PREFIX = '*v2:';
const DEFAULT_ITERATIONS = 600_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBytes = (base64) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

/**
 * @param {string} password
 * @param {string} saltBase64 from `#events[data-kdf-salt]`
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, saltBase64, iterations = DEFAULT_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toBytes(saltBase64), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** @returns {Promise<string|null>} plain text, or null if the key is wrong. */
export async function decryptEntry(payloadBase64, key) {
  try {
    const bytes = toBytes(payloadBase64);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return decoder.decode(plain);
  } catch {
    return null;
  }
}

/** Mirror of the CLI in tools/add-entry.mjs, kept for round-trip tests. */
export async function encryptEntry(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
  const packed = new Uint8Array(iv.length + cipher.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(cipher), iv.length);
  return CIPHER_PREFIX + toBase64(packed);
}

/* ---------- passphrase storage ---------- */

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Reads the stored passphrase, migrating the cookie the old version used. */
export function getPassword() {
  const stored = localStorage.getItem(STORAGE.password);
  if (stored) return stored;
  const legacy = readCookie('password');
  if (legacy) {
    localStorage.setItem(STORAGE.password, legacy);
    document.cookie = 'password=; max-age=0';
    return legacy;
  }
  return null;
}

export function setPassword(value) {
  if (value) localStorage.setItem(STORAGE.password, value);
  else localStorage.removeItem(STORAGE.password);
}
