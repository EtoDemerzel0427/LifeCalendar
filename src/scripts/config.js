/**
 * Everything you need to make this calendar yours.
 * (Previously these were magic numbers buried in index.html.)
 */
export const CONFIG = {
  /** Your birthday, `YYYY-MM-DD`. Day 0 of the calendar. */
  birth: '1998-04-27',

  /** How many years the calendar draws. Not a prediction — a canvas. */
  lifeExpectancy: 102,

  /** Where the event data lives. See README for the format. */
  eventsUrl: './events.html',

  /** Shown under the title. Set to '' to hide. */
  motto:
    'When you want to hurry something, that means you no longer care about it and want to get on to other things.',

  /** Hue used for days that no period covers. */
  defaultHue: 180,

  /** Credit an event carries when it does not declare one. */
  defaultCredit: 1,
};

/** localStorage keys, namespaced so they don't collide on a shared origin. */
export const STORAGE = {
  theme: 'lifecal.theme',
  density: 'lifecal.density',
  password: 'lifecal.password',
};
