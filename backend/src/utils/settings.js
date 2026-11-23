import db from '../db.js';

// Limits used here and by the admin settings page in the next group
export const MIN_DURATION = 2;
export const MAX_DURATION = 60;
export const TRANSITIONS = ['fade', 'slide', 'zoom'];

const readSettings = db.prepare(
  'SELECT photo_duration, transition_type FROM slideshow_settings WHERE setting_id = 1'
);

export function getSettings() {
  const row = readSettings.get();
  return { photoDuration: row.photo_duration, transitionType: row.transition_type };
}