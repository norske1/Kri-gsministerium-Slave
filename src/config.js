// Hardcoded bot owner. The owner always has full access and can never be
// locked out, regardless of the access list.
export const OWNER_ID = '1215001848105279498';

export const TOKEN = process.env.DISCORD_TOKEN;
export const CLIENT_ID = process.env.CLIENT_ID;
export const GUILD_ID = process.env.GUILD_ID || '';

// Google Sheet that approved medal requests are logged to.
export const SHEET_ID = process.env.SHEET_ID || '17-78i_JY0bwzacYCl_YkfQdrCpP_LCvHrBf7S37Yo5k';
export const SHEET_GID = Number(process.env.SHEET_GID || '0');

// Full service account JSON key contents (as a single-line or multi-line string).
export const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
