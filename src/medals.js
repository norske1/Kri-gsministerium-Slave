// Allowed medals and the classes each may be requested for.
// Matching is case- and letter-sensitive: a request must be an exact 1-to-1
// match of both the name (a key here) and the class (a value in its array).
export const MEDALS = {
  'Dänische-Verdienstmedaille': ['1. Klasse'],
};

// Venerations work like medals but the requested item is always "Serviceband"
// and approvals are logged to a different sheet tab.
export const VENERATIONS = {
  'Serviceband': [
    '3 Months',
    '6 Months',
    '9 Months',
    '1 Year',
    '15 Months',
    '18 Months',
    '21 Months',
    '2 Years',
    '27 Months',
    '30 Months',
    '33 Months',
    '3 Years',
    '39 Months',
  ],
};

// Per-type configuration: catalog, sheet tab to log approvals to, and labels.
export const CATALOGS = {
  medal: {
    map: MEDALS,
    sheetTab: 'Medals',
    label: 'Medal',
    noun: 'medal',
    status: 'Approved',
    upsert: false,
  },
  veneration: {
    map: VENERATIONS,
    sheetTab: 'Venerations',
    label: 'Veneration',
    noun: 'veneration',
    status: 'Active',
    // Existing applicants (matched by Profile Link) get their class updated
    // instead of a new row being appended.
    upsert: true,
  },
};

export function getCatalog(type) {
  return CATALOGS[type] || null;
}

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
 * Resolve an item/class pair against every catalog (exact, case-sensitive).
 * The item itself determines the request type (and therefore which sheet tab
 * approvals are logged to). Returns { ok, type, sheetTab } on success or
 * { ok: false, reason } describing the mismatch.
 */
export function resolveEntry(item, klass) {
  for (const [type, catalog] of Object.entries(CATALOGS)) {
    if (Object.prototype.hasOwnProperty.call(catalog.map, item)) {
      const classes = catalog.map[item];
      if (!classes.includes(klass)) {
        return {
          ok: false,
          reason: `"${klass}" is not a valid class for "${item}". Allowed: ${classes.join(', ')}.`,
        };
      }
      return {
        ok: true,
        type,
        sheetTab: catalog.sheetTab,
        status: catalog.status,
        upsert: catalog.upsert,
      };
    }
  }
  const allowed = Object.values(CATALOGS)
    .flatMap((c) => Object.keys(c.map))
    .join(', ');
  return {
    ok: false,
    reason: `"${item}" is not a valid option. It must exactly match (case-sensitive): ${allowed}.`,
  };
}
