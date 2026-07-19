import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DENY_COOLDOWN_MS } from './medals.js';

const DATA_FILE = fileURLToPath(new URL('../data/applications.json', import.meta.url));

// Persisted so accept/deny buttons keep working across restarts and so the
// 30-minute deny cooldown survives a restart.
let state = { requests: {}, cooldowns: {} };

export async function loadApplications() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    state = { requests: parsed.requests || {}, cooldowns: parsed.cooldowns || {} };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    state = { requests: {}, cooldowns: {} };
  }
  return state;
}

async function persist() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2));
}

export function getCooldownRemaining(userId) {
  const until = state.cooldowns[userId] || 0;
  const remaining = until - Date.now();
  return remaining > 0 ? remaining : 0;
}

export async function setDenyCooldown(userId) {
  state.cooldowns[userId] = Date.now() + DENY_COOLDOWN_MS;
  await persist();
}

export async function createRequest(data) {
  const id = randomUUID();
  state.requests[id] = {
    id,
    ...data,
    status: 'pending',
    reviewerMessages: [],
    createdAt: Date.now(),
  };
  await persist();
  return id;
}

export function getRequest(id) {
  return state.requests[id] || null;
}

export async function addReviewerMessage(id, ref) {
  const req = state.requests[id];
  if (!req) return;
  req.reviewerMessages.push(ref);
  await persist();
}

/**
 * Atomically transition a pending request to accepted/denied. Returns true if
 * this caller won the decision, false if it was already decided by someone else.
 */
export async function decideRequest(id, decision, reviewerId, reason = null) {
  const req = state.requests[id];
  if (!req) return { won: false, missing: true };
  if (req.status !== 'pending') return { won: false, missing: false, req };
  req.status = decision;
  req.decidedBy = reviewerId;
  req.decidedAt = Date.now();
  if (reason) req.reason = reason;
  await persist();
  return { won: true, req };
}
