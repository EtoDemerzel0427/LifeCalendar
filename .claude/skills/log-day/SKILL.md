---
name: log-day
description: Record a day in the Life Calendar — write the entry into events.html, commit and push. Use when the user describes what happened today (or on some past day), asks to log/record a day, 记录今天, 补记, or when the daily reminder task fires.
---

# Logging a day

The data lives in `events.html` at the repo root, one `<div>` per day. Never
hand-edit it — `tools/add-entry.mjs` handles formatting, escaping, encryption
and the file's KDF salt.

## Steps

1. **Check what is already there** before writing:

   ```bash
   grep -c 'date="08/15/2026"' events.html
   ```

   Use `date +%m/%d/%Y` for today. If an entry exists, ask whether to replace it
   (`--replace`) or add a second one (`--append`) rather than guessing.

2. **Write it.** `\n` becomes a line break in the day's card:

   ```bash
   node tools/add-entry.mjs --credit 20 --text $'早上写完了 PR\n晚上练腿 🏋️'
   ```

   Options: `--date 2026-08-14` (defaults to today, accepts `YYYY-MM-DD` or
   `MM/DD/YYYY`), `--credit 0-100`, `--color '#A349A4'` for a milestone,
   `--secret` to encrypt, `--replace` / `--append`, `--print` to preview.

3. **Commit and push:**

   ```bash
   git add events.html && git commit -m "log: 2026-08-15" && git push
   ```

## Writing the entry

- Keep the user's own words and tone. This is their diary, not a summary — do
  not rewrite 摆烂 into "rested". Translate nothing.
- One line per thing that happened; the tool joins them with `<br/>`.
- Put an emoji in the line if the day has an obvious one (🏋️ gym, ✈️ travel,
  💼 work milestone) — the first emoji of an entry is drawn inside the box.
- Ask, don't invent. If the user gives you three words, write three words.

## Credit

How much the day counted, 0–100. It only controls colour depth. The existing
data uses roughly:

| credit | day |
| ------ | --- |
| 5–10   | 摆烂/普通的一天 |
| 15–20  | 正常有产出 |
| 25–40  | 充实、有意思 |
| 50–60  | 很难忘 |
| 100    | 人生节点（配 `--color '#A349A4'`） |

Default to 10 when the user gives no signal; ask only if the day sounds like it
matters and you cannot tell.

## Private entries

`--secret` encrypts the body with AES-256-GCM (see `src/scripts/crypto.js`).
The passphrase comes from `$LIFECAL_KEY`, else the macOS keychain item
`lifecal`, else an interactive prompt.

**Never ask the user to type the passphrase into the chat** — it would land in
the transcript. If neither source is set, the script says so; tell the user to
run this once in their own terminal:

```bash
security add-generic-password -s lifecal -a key -w
```

## Periods and milestones

A new life period (job, school, city) is a `class="base"` entry with a hue, not
a daily log — those are rare, so add them by editing `events.html` directly,
placed before the daily entries, and tell the user which hue you picked:

```html
<!-- still going: leave `end` out entirely -->
<div class="base" credit="10" hue="220" start="06/24/2024"><i>Akuna Capital</i></div>
<!-- finished: give it an end date -->
<div class="base" credit="10" hue="25" start="01/07/2022" end="05/11/2024"><i>UT Austin</i></div>
```

An open period is drawn up to today and no further. When a period ends (new job,
new city), add the `end` date to the old one rather than deleting it.
