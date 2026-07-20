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

/**
 * Append an approved request to the given sheet tab. Writes:
 *   D = username, G = profileLink, H = item, I = klass, J = status
 * (E and F are left blank). The target row is the first empty row based on
 * the current contents of column D.
 */
export async function logApproved({ username, profileLink, item, klass, sheetTab, status }) {
  const sheets = await getClient();

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

  return { row, sheet: sheetTab };
}
