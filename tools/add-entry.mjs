#!/usr/bin/env node
/**
 * Adds a day to events.html.
 *
 *   node tools/add-entry.mjs --text "写了一天代码\n晚上去健身 🏋️" --credit 20
 *   node tools/add-entry.mjs --date 2026-08-14 --text "…" --replace
 *   node tools/add-entry.mjs --text "只有我自己看" --secret
 *   node tools/add-entry.mjs --text "…" --print          # show the markup, write nothing
 *
 * Options
 *   --text     entry body; \n becomes <br/>. Reads stdin when omitted.
 *   --date     YYYY-MM-DD or MM/DD/YYYY, defaults to today
 *   --credit   0-100, how much the day counted (default 10)
 *   --color    #rrggbb, paint the box by hand instead of by credit
 *   --secret   encrypt the body (see passphrase resolution below)
 *   --replace  replace an existing entry for that date instead of refusing
 *   --append   add a second entry for a date that already has one
 *   --print    print the markup instead of writing the file
 *
 * Passphrase for --secret, in order: $LIFECAL_KEY, the macOS keychain item
 * `lifecal` (`security add-generic-password -s lifecal -a key -w`), then an
 * interactive prompt. It is never written to disk by this script and never
 * needs to be pasted into a chat.
 *
 * The crypto matches src/scripts/crypto.js exactly: PBKDF2-SHA-256 over the
 * file's salt, AES-256-GCM, payload = iv || ciphertext || tag.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'events.html');
const ITERATIONS = 600_000;

/* ---------- arguments ---------- */

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith('--')) continue;
  const [key, inline] = token.slice(2).split(/=(.*)/s);
  const next = process.argv[i + 1];
  if (inline !== undefined) args[key] = inline;
  else if (next && !next.startsWith('--')) {
    args[key] = next;
    i += 1;
  } else args[key] = true;
}

const text = (args.text ?? readFileSync(0, 'utf8')).toString().trim();
if (!text) fail('nothing to write: pass --text or pipe the entry on stdin');

const date = parseDate(args.date);
const credit = args.credit === undefined ? 10 : Number(args.credit);
if (!Number.isFinite(credit) || credit < 0 || credit > 100) fail(`--credit must be 0-100, got ${args.credit}`);
if (args.color && !/^#[0-9a-f]{3,8}$/i.test(args.color)) fail(`--color must be a hex colour, got ${args.color}`);

/* ---------- build the entry ---------- */

let html = readFileSync(FILE, 'utf8');
const stamp = usDate(date);

const body = args.secret ? await encrypt(text) : escapeText(text);
const lines = body.split('\n').filter((line) => line.trim());
const attrs = [`credit="${credit}"`, `date="${stamp}"`];
if (args.color) attrs.unshift(`color="${args.color}"`);

const entry = [` <div ${attrs.join(' ')}>`, ...lines.flatMap((line, i) => (i ? ['  <br/>', `  ${line}`] : [`  ${line}`])), ' </div>'].join(
  '\n',
);

if (args.print) {
  console.log(entry);
  process.exit(0);
}

/* ---------- splice it in ---------- */

const existing = findEntry(html, stamp);
if (existing && !args.replace && !args.append) {
  fail(`${stamp} already has an entry. Pass --replace to rewrite it, or --append to add a second one.`);
}

if (existing && args.replace) {
  html = html.slice(0, existing.start) + entry + html.slice(existing.end);
} else {
  const close = html.lastIndexOf('</div>');
  if (close === -1) fail('events.html has no closing </div> for #events');
  html = `${html.slice(0, close).replace(/\s*$/, '\n')}${entry}\n${html.slice(close)}`;
}

writeFileSync(FILE, html);
console.log(`${existing && args.replace ? 'replaced' : 'added'} ${stamp}${args.secret ? ' (encrypted)' : ''}`);

/* ---------- helpers ---------- */

function fail(message) {
  console.error(`add-entry: ${message}`);
  process.exit(1);
}

function parseDate(input) {
  if (!input || input === true) return new Date();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  if (match) return new Date(+match[1], +match[2] - 1, +match[3]);
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (match) return new Date(+match[3], +match[1] - 1, +match[2]);
  fail(`--date must be YYYY-MM-DD or MM/DD/YYYY, got ${input}`);
}

function usDate(value) {
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${value.getFullYear()}`;
}

function escapeText(value) {
  // Entries are HTML, but a plain diary line should never become markup.
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Locates a single-day entry for `stamp` that is not a life period. */
function findEntry(source, stamp) {
  const pattern = new RegExp(`[ \\t]*<div (?![^>]*class="base")[^>]*date="${stamp}"[^>]*>[\\s\\S]*?</div>`, 'g');
  let last = null;
  for (const match of source.matchAll(pattern)) {
    last = { start: match.index, end: match.index + match[0].length };
  }
  return last;
}

/* ---------- encryption ---------- */

async function encrypt(plain) {
  const password = await resolvePassphrase();
  const salt = ensureSalt();
  const key = pbkdf2Sync(password, Buffer.from(salt, 'base64'), ITERATIONS, 32, 'sha256');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const packed = Buffer.concat([iv, cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return `*v2:${packed.toString('base64')}`;
}

/** The file-wide KDF salt, created on first use. */
function ensureSalt() {
  const found = /<div id="events"[^>]*data-kdf-salt="([^"]+)"/.exec(html);
  if (found) return found[1];

  const salt = randomBytes(16).toString('base64');
  const opening = /<div id="events"([^>]*)>/.exec(html);
  if (!opening) fail('events.html has no <div id="events">');
  html = html.replace(
    opening[0],
    `<div id="events"${opening[1]} data-kdf-salt="${salt}" data-kdf-iterations="${ITERATIONS}">`,
  );
  return salt;
}

async function resolvePassphrase() {
  if (process.env.LIFECAL_KEY) return process.env.LIFECAL_KEY;

  if (process.platform === 'darwin') {
    try {
      const fromKeychain = execFileSync('security', ['find-generic-password', '-s', 'lifecal', '-w'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (fromKeychain) return fromKeychain;
    } catch {
      // not stored yet — fall through to the prompt
    }
  }

  if (!process.stdin.isTTY) {
    fail('no passphrase: set $LIFECAL_KEY, or store one with\n  security add-generic-password -s lifecal -a key -w');
  }
  return prompt('passphrase: ');
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = () => rl.output.write('[2K[200D' + question);
    rl.input.on('data', onData);
    rl.question(question, (answer) => {
      rl.input.off('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}
