import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OWNER_ID } from './config.js';

const DATA_FILE = fileURLToPath(new URL('../data/access.json', import.meta.url));

/**
 * Access is stored per guild:
 * {
 *   "<guildId>": { "users": ["<userId>", ...], "roles": ["<roleId>", ...] }
 * }
 */
let store = {};

export async function loadAccess() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    store = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      store = {};
    } else {
      throw err;
    }
  }
  return store;
}

async function persist() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function guildEntry(guildId) {
  if (!store[guildId]) {
    store[guildId] = { users: [], roles: [] };
  }
  return store[guildId];
}

export async function allowUser(guildId, userId) {
  const entry = guildEntry(guildId);
  if (entry.users.includes(userId)) return false;
  entry.users.push(userId);
  await persist();
  return true;
}

export async function denyUser(guildId, userId) {
  const entry = guildEntry(guildId);
  const idx = entry.users.indexOf(userId);
  if (idx === -1) return false;
  entry.users.splice(idx, 1);
  await persist();
  return true;
}

export async function allowRole(guildId, roleId) {
  const entry = guildEntry(guildId);
  if (entry.roles.includes(roleId)) return false;
  entry.roles.push(roleId);
  await persist();
  return true;
}

export async function denyRole(guildId, roleId) {
  const entry = guildEntry(guildId);
  const idx = entry.roles.indexOf(roleId);
  if (idx === -1) return false;
  entry.roles.splice(idx, 1);
  await persist();
  return true;
}

export function getAccess(guildId) {
  const entry = store[guildId] || { users: [], roles: [] };
  return { users: [...entry.users], roles: [...entry.roles] };
}

/**
 * Returns true if the member is allowed to use the bot in this guild.
 * The owner is always allowed. Otherwise the member must be individually
 * allowed or hold at least one allowed role.
 */
export function hasAccess(guildId, member) {
  if (!member) return false;
  if (member.id === OWNER_ID) return true;
  const entry = store[guildId];
  if (!entry) return false;
  if (entry.users.includes(member.id)) return true;
  const roleIds = member.roles?.cache ? [...member.roles.cache.keys()] : [];
  return roleIds.some((rid) => entry.roles.includes(rid));
}
