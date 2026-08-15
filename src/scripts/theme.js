/** Theme switch: system → light → dark, remembered across visits. */
import { STORAGE } from './config.js';
import { t } from './i18n.js';

const MODES = ['auto', 'light', 'dark'];
const LABELS = { auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' };

export function initTheme(button) {
  let mode = MODES.includes(localStorage.getItem(STORAGE.theme)) ? localStorage.getItem(STORAGE.theme) : 'auto';

  const apply = () => {
    const root = document.documentElement;
    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.dataset.theme = mode;
    button.setAttribute('aria-label', t[LABELS[mode]]);
    button.title = t[LABELS[mode]];
  };

  button.addEventListener('click', () => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    localStorage.setItem(STORAGE.theme, mode);
    apply();
  });

  apply();
}
