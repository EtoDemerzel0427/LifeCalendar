/** Header numbers, the life progress bar, and the period legend. */
import { $ } from './utils.js';
import { fmtNumber, t } from './i18n.js';

function stat(label, value, unit) {
  const wrap = document.createElement('div');
  wrap.className = 'stat';
  wrap.innerHTML =
    `<dt class="stat__label">${label}</dt>` +
    `<dd class="stat__value">${value}</dd>` +
    (unit ? `<dd class="stat__label">${unit}</dd>` : '');
  return wrap;
}

export function renderStats(model) {
  const { lived, logged, left, progress } = model.stats;

  $('#stats').replaceChildren(
    stat(t.statLived, fmtNumber.format(lived), t.unitDays),
    stat(t.statLogged, fmtNumber.format(logged), t.unitDays),
    stat(t.statLeft, fmtNumber.format(left), t.unitDays),
    stat(t.statProgress, `${(progress * 100).toFixed(1)}`, '%'),
  );

  const ticks = $('#lifebar-ticks');
  ticks.replaceChildren();
  for (let decade = 10; decade < model.config.lifeExpectancy; decade += 10) {
    const tick = document.createElement('span');
    tick.style.left = `${(decade / model.config.lifeExpectancy) * 100}%`;
    ticks.append(tick);
  }

  requestAnimationFrame(() => {
    $('#lifebar-fill').style.width = `${(progress * 100).toFixed(2)}%`;
  });
}

export function renderLegend(model, onJump) {
  const legend = $('#legend');
  legend.replaceChildren();

  for (const period of model.periods) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'legend__item';

    const swatch = document.createElement('span');
    swatch.className = 'legend__swatch';
    if (period.color) swatch.style.background = period.color;
    else swatch.style.setProperty('--h', String(period.hue ?? model.config.defaultHue));

    item.append(swatch, period.text);
    if (period.ongoing) {
      const badge = document.createElement('span');
      badge.className = 'legend__now';
      badge.textContent = t.ongoing;
      item.append(badge);
    }
    item.addEventListener('click', () => onJump(period.from));
    legend.append(item);
  }
}
