import { google } from 'googleapis';
import { SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON } from './config.js';

let sheetsClient = null;

export function sheetsEnabled() {
  return Boolean(GOOGLE_SERVICE_ACCOUNT_JSON);
}

async function getClient() {
  if (sheetsClient) return sheetsClient;
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set.');
  }
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

function normalizeProfile(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
}

/**
 * Log an approved request to the given sheet tab.
 *
 * Layout: D = username, G = profileLink, H = item, I = klass, J = status
 * (E and F are left blank on new rows).
 *
 * When `upsert` is true, an existing row whose Profile Link (column G) matches
 * `profileLink` is reused and only its class (column I) is updated to the new
 * value; everything else on that row (including the protected column J) is left
 * untouched. Otherwise, and when no match is found, a new row is appended at the
 * first empty row of column D.
 */
export async function logApproved({ username, profileLink, item, klass, sheetTab, status, upsert }) {
  const sheets = await getClient();

  if (upsert) {
    const profiles = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetTab}!G:G`,
    });
    const target = normalizeProfile(profileLink);
    const rowsG = profiles.data.values || [];
    const matchIndex = rowsG.findIndex((r) => normalizeProfile(r[0]) === target && target !== '');
    if (matchIndex !== -1) {
      const matchRow = matchIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetTab}!I${matchRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[klass]] },
      });
      return { row: matchRow, sheet: sheetTab, updated: true };
    }
  }

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetTab}!D:D`,
  });
  const rows = existing.data.values ? existing.data.values.length : 0;
  const row = rows + 1;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${sheetTab}!D${row}`, values: [[username]] },
        { range: `${sheetTab}!G${row}:I${row}`, values: [[profileLink, item, klass]] },
        { range: `${sheetTab}!J${row}`, values: [[status]] },
      ],
    },
  });

  return { row, sheet: sheetTab, updated: false };
}
