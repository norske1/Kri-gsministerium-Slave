import { google } from 'googleapis';
import { SHEET_ID, SHEET_GID, GOOGLE_SERVICE_ACCOUNT_JSON } from './config.js';

let sheetsClient = null;
let sheetTitle = null;

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

async function getSheetTitle(sheets) {
  if (sheetTitle) return sheetTitle;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet =
    meta.data.sheets.find((s) => s.properties.sheetId === SHEET_GID) || meta.data.sheets[0];
  sheetTitle = sheet.properties.title;
  return sheetTitle;
}

/**
 * Append an approved request. Writes:
 *   D = username, G = profileLink, H = medal, I = klass, J = "Approved"
 * (E and F are left blank). The target row is the first empty row based on
 * the current contents of column D.
 */
export async function logApproved({ username, profileLink, medal, klass }) {
  const sheets = await getClient();
  const title = await getSheetTitle(sheets);

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${title}!D:D`,
  });
  const rows = existing.data.values ? existing.data.values.length : 0;
  const row = rows + 1;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${title}!D${row}`, values: [[username]] },
        { range: `${title}!G${row}:I${row}`, values: [[profileLink, medal, klass]] },
        { range: `${title}!J${row}`, values: [['Approved']] },
      ],
    },
  });

  return { row, sheet: title };
}
