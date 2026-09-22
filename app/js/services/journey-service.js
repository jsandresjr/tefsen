import { db } from '../firebase-client.js';
import { SCHEMA } from '../config/schema.js';
import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const C = SCHEMA.collections;
const S = SCHEMA.subcollections;
const DEMO_PREFIX = 'tefsen_journeys_';

export const JOURNEY_STATUSES = Object.freeze([
  'interested',
  'preparing',
  'ready_to_apply',
  'applied',
  'interview',
  'accepted',
  'rejected',
  'withdrawn'
]);

export const JOURNEY_LABELS = Object.freeze({
  interested: 'Interested',
  preparing: 'Preparing',
  ready_to_apply: 'Ready to apply',
  applied: 'Applied',
  interview: 'Interview / review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
});

const TRANSITIONS = Object.freeze({
  interested: ['preparing', 'withdrawn'],
  preparing: ['interested', 'ready_to_apply', 'withdrawn'],
  ready_to_apply: ['preparing', 'applied', 'withdrawn'],
  applied: ['interview', 'accepted', 'rejected', 'withdrawn'],
  interview: ['accepted', 'rejected', 'withdrawn'],
  accepted: [],
  rejected: [],
  withdrawn: []
});

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function safeStatus(value) {
  return JOURNEY_STATUSES.includes(value) ? value : 'interested';
}

function taskId(prefix = 'task') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function journeyCollection(userId) {
  return collection(db, C.journeys, String(userId), S.opportunityJourneys);
}

function journeyDoc(userId, opportunityId) {
  return doc(db, C.journeys, String(userId), S.opportunityJourneys, String(opportunityId));
}

function demoKey(userId) {
  return DEMO_PREFIX + String(userId || 'guest');
}

function readDemo(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(demoKey(userId)) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeDemo(userId, rows) {
  localStorage.setItem(demoKey(userId), JSON.stringify(rows));
}

function normalizeTask(raw = {}) {
  return {
    id: clean(raw.id, 120) || taskId(),
    label: clean(raw.label, 240),
    source: raw.source === 'system' ? 'system' : 'custom',
    completed: Boolean(raw.completed),
    createdAtMillis: Number(raw.createdAtMillis || Date.now())
  };
}

export function normalizeJourney(raw = {}, opportunityId = '', userId = '') {
  const checklist = Array.isArray(raw.checklist) ? raw.checklist.map(normalizeTask).filter(item => item.label) : [];
  const history = Array.isArray(raw.history)
    ? raw.history.map(item => ({
        status: safeStatus(item.status),
        atMillis: Number(item.atMillis || Date.now())
      })).slice(-30)
    : [];
  return {
    ...raw,
    userId: userId || raw.userId || '',
    opportunityId: opportunityId || raw.opportunityId || '',
    saved: raw.saved !== false,
    started: Boolean(raw.started),
    status: safeStatus(raw.status),
    personalTargetDate: clean(raw.personalTargetDate, 20),
    notes: clean(raw.notes, 3000),
    checklist,
    history
  };
}

export function createSystemChecklist(opportunity = {}) {
  const tasks = [];
  const seen = new Set();
  const add = label => {
    const cleanLabel = clean(label, 240);
    const key = cleanLabel.toLowerCase();
    if (!cleanLabel || seen.has(key)) return;
    seen.add(key);
    tasks.push({
      id: taskId('req'),
      label: cleanLabel,
      source: 'system',
      completed: false,
      createdAtMillis: Date.now()
    });
  };

  for (const documentName of opportunity.requiredDocuments || []) add(`Prepare: ${documentName}`);
  if (opportunity.officialSourceUrl) add('Review the official opportunity source and current requirements');

  return tasks;
}

export function journeyProgress(journey = {}) {
  const checklist = Array.isArray(journey.checklist) ? journey.checklist : [];
  if (!checklist.length) return { completed: 0, total: 0, percent: 0 };
  const completed = checklist.filter(task => task.completed).length;
  return { completed, total: checklist.length, percent: Math.round((completed / checklist.length) * 100) };
}

export function allowedJourneyTransitions(status = 'interested') {
  return TRANSITIONS[safeStatus(status)] || [];
}

export async function listJourneyStates(mode, userId) {
  if (!userId) return [];
  if (mode === 'demo') {
    return Object.values(readDemo(userId))
      .map(row => normalizeJourney(row, row.opportunityId, userId))
      .sort((a, b) => Number(b.updatedAtMillis || 0) - Number(a.updatedAtMillis || 0));
  }

  const snap = await getDocs(query(journeyCollection(userId), limit(100)));
  return snap.docs.map(row => normalizeJourney(row.data(), row.id, userId));
}

export async function getJourneyState(mode, userId, opportunityId) {
  if (!userId || !opportunityId) return null;
  if (mode === 'demo') {
    const row = readDemo(userId)[opportunityId];
    return row ? normalizeJourney(row, opportunityId, userId) : null;
  }

  const snap = await getDoc(journeyDoc(userId, opportunityId));
  return snap.exists() ? normalizeJourney(snap.data(), opportunityId, userId) : null;
}

async function persistJourney(mode, userId, opportunityId, value) {
  const normalized = normalizeJourney(value, opportunityId, userId);
  const now = Date.now();

  if (mode === 'demo') {
    const rows = readDemo(userId);
    rows[opportunityId] = { ...normalized, updatedAtMillis: now };
    writeDemo(userId, rows);
    return rows[opportunityId];
  }

  await setDoc(journeyDoc(userId, opportunityId), {
    ...normalized,
    userId: String(userId),
    opportunityId: String(opportunityId),
    updatedAt: serverTimestamp(),
    updatedAtMillis: now
  }, { merge: true });

  return normalized;
}

export async function setOpportunitySaved(mode, userId, opportunity, saved) {
  const opportunityId = String(opportunity?.id || '').trim();
  if (!opportunityId) throw new Error('Opportunity ID is missing.');

  const existing = await getJourneyState(mode, userId, opportunityId);
  if (!existing && !saved) return null;

  const next = existing || {
    userId,
    opportunityId,
    saved: true,
    started: false,
    status: 'interested',
    personalTargetDate: '',
    notes: '',
    checklist: [],
    history: []
  };
  next.saved = Boolean(saved);

  return persistJourney(mode, userId, opportunityId, next);
}

export async function startJourney(mode, userId, opportunity) {
  const opportunityId = String(opportunity?.id || '').trim();
  if (!opportunityId) throw new Error('Opportunity ID is missing.');

  const existing = await getJourneyState(mode, userId, opportunityId);
  const checklist = existing?.checklist?.length ? existing.checklist : createSystemChecklist(opportunity);
  const status = existing?.status || 'interested';
  const history = existing?.history?.length
    ? existing.history
    : [{ status, atMillis: Date.now() }];

  return persistJourney(mode, userId, opportunityId, {
    ...existing,
    saved: true,
    started: true,
    status,
    checklist,
    history,
    personalTargetDate: existing?.personalTargetDate || '',
    notes: existing?.notes || ''
  });
}

export async function updateJourneyStage(mode, userId, opportunityId, nextStatus) {
  const journey = await getJourneyState(mode, userId, opportunityId);
  if (!journey) throw new Error('Start the journey before changing its stage.');

  const next = safeStatus(nextStatus);
  if (next === journey.status) return journey;
  if (!allowedJourneyTransitions(journey.status).includes(next)) {
    throw new Error(`You cannot move directly from ${JOURNEY_LABELS[journey.status]} to ${JOURNEY_LABELS[next]}.`);
  }

  journey.status = next;
  journey.saved = true;
  journey.started = true;
  journey.history = [...(journey.history || []), { status: next, atMillis: Date.now() }].slice(-30);
  return persistJourney(mode, userId, opportunityId, journey);
}

export async function updateJourneyPlanning(mode, userId, opportunityId, { personalTargetDate = '', notes = '' } = {}) {
  const journey = await getJourneyState(mode, userId, opportunityId);
  if (!journey) throw new Error('Start the journey before adding planning details.');
  journey.personalTargetDate = clean(personalTargetDate, 20);
  journey.notes = clean(notes, 3000);
  return persistJourney(mode, userId, opportunityId, journey);
}

export async function toggleJourneyTask(mode, userId, opportunityId, taskIdValue) {
  const journey = await getJourneyState(mode, userId, opportunityId);
  if (!journey) throw new Error('Journey not found.');
  const index = journey.checklist.findIndex(task => task.id === taskIdValue);
  if (index < 0) throw new Error('Checklist task not found.');
  journey.checklist[index] = { ...journey.checklist[index], completed: !journey.checklist[index].completed };
  return persistJourney(mode, userId, opportunityId, journey);
}

export async function addCustomJourneyTask(mode, userId, opportunityId, label) {
  const journey = await getJourneyState(mode, userId, opportunityId);
  if (!journey) throw new Error('Start the journey before adding tasks.');
  const cleanLabel = clean(label, 240);
  if (!cleanLabel) throw new Error('Task cannot be empty.');
  if (journey.checklist.length >= 40) throw new Error('Checklist limit reached.');

  journey.checklist = [...journey.checklist, {
    id: taskId('custom'),
    label: cleanLabel,
    source: 'custom',
    completed: false,
    createdAtMillis: Date.now()
  }];
  return persistJourney(mode, userId, opportunityId, journey);
}

export async function deleteCustomJourneyTask(mode, userId, opportunityId, taskIdValue) {
  const journey = await getJourneyState(mode, userId, opportunityId);
  if (!journey) throw new Error('Journey not found.');
  const task = journey.checklist.find(item => item.id === taskIdValue);
  if (!task) return journey;
  if (task.source !== 'custom') throw new Error('System-generated requirement tasks cannot be deleted here.');
  journey.checklist = journey.checklist.filter(item => item.id !== taskIdValue);
  return persistJourney(mode, userId, opportunityId, journey);
}
