// Allowed medals and the classes each may be requested for.
// Matching is case- and letter-sensitive: a request must be an exact 1-to-1
// match of both the medal name (a key here) and the class (a value in its array).
export const MEDALS = {
  'Orden des Schwarzen Adler': ['Großkomtur', 'Komtur', 'Ritter'],
  'Orden des Rotes Adler': ['Großkomtur', 'Komtur', 'Ritter'],
  'Orden Pour le Merite': ['Komtur', 'Ritter'],
  'Orden Niter Johan': ['Großkomtur', 'Komtur', 'Inhaber', 'Ritter'],
  'Adelsstand': ['Ritter', 'Freiherr', 'Graf', 'Fürst', 'Herzog', 'Erzherzog'],
  'House of': ['Hohenzollern', 'Schönich', 'Krockow', 'Fürstenberg', 'Solms'],
  'Kommandantenmedaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Militär-Verdienstkreuz': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Allgemeine-Ehrenmedaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Militär-Ehrenmedaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Rekrutierung-Ehrenmedaille': ['Orden des Rekrutierung', '3. Klasse', '2. Klasse', '1. Klasse'],
  'Soziale-Ehrenmedaille': ['1. Klasse'],
  'Fahnenträger-Ehrenmedaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Stab-Ehrenmedaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Propagandamedaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Ingenieurmedaille': ['3. Klasse', '2. Klasse'],
  'Rettungsmedaille': ['1. Klasse'],
  'Dänische-Verdienstmedaille': ['1. Klasse'],
  'Schlesischer-Feldzug Medaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Garde-Ehrenmedaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
  'Erstes-Ehrenmedaille': ['3. Klasse', '2. Klasse', '1. Klasse'],
};

// The reviewers who receive every application and can accept/deny it.
export const REVIEWER_IDS = [
  '1215001848105279498',
  '724637232484450385',
  '568792703157010435',
  '1182476852607070310',
  '398227338866720778',
  '608784225176387584',
];

// Channel where the application panel (embed + button) is posted.
export const PANEL_CHANNEL_ID = '1485356903784513738';

// Cooldown after a denial before the user may submit again (milliseconds).
export const DENY_COOLDOWN_MS = 30 * 60 * 1000;

/**
 * Validate a medal/class pair against the allowlist (exact, case-sensitive).
 * Returns { ok: true } or { ok: false, reason } describing the mismatch.
 */
export function validateMedal(medal, klass) {
  if (!Object.prototype.hasOwnProperty.call(MEDALS, medal)) {
    return {
      ok: false,
      reason: `"${medal}" is not a valid medal. It must exactly match one of the allowed medals (case-sensitive).`,
    };
  }
  const classes = MEDALS[medal];
  if (!classes.includes(klass)) {
    return {
      ok: false,
      reason: `"${klass}" is not a valid class for "${medal}". Allowed: ${classes.join(', ')}.`,
    };
  }
  return { ok: true };
}
