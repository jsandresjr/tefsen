import { db } from '../firebase-client.js';
import { SCHEMA } from '../config/schema.js';
import { normalizeOpportunity } from './opportunity-service.js';
import { timestampToDate } from '../utils.js';
import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  collection, doc, getDocs, limit, query, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const C = SCHEMA.collections;
const DEMO_IMPORT_KEY = 'tefsen_admin_import_preview_v1';

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function list(value, max = 20) {
  if (Array.isArray(value)) return value.map(v => clean(v, 120)).filter(Boolean).slice(0, max);
  return String(value || '').split(/[|;,]/).map(v => clean(v, 120)).filter(Boolean).slice(0, max);
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function normalizeUrlKey(value) {
  const href = validHttpUrl(value);
  if (!href) return '';
  try {
    const url = new URL(href);
    url.hash = '';
    url.searchParams.sort();
    return url.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return href.toLowerCase();
  }
}

export async function getAdminCapability(mode, user, profile = {}) {
  if (!user) return false;
  if (mode === 'demo') return String(profile?.role || '').toUpperCase() === 'ADMIN';
  try {
    const token = await getIdTokenResult(user, true);
    const claims = token?.claims || {};
    return claims.admin === true || String(claims.role || '').toUpperCase() === 'ADMIN';
  } catch {
    return false;
  }
}

export function opportunityFreshness(opportunity = {}, now = new Date()) {
  const deadline = opportunity.deadline ? new Date(opportunity.deadline) : null;
  const verified = timestampToDate(opportunity.lastVerifiedAt);
  const nowMs = now.getTime();

  if (deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < nowMs) {
    return { state: 'expired', label: 'Expired', needsReview: true };
  }

  if (opportunity.verificationStatus === 'pending') {
    return { state: 'pending', label: 'Pending review', needsReview: true };
  }

  if (opportunity.verificationStatus !== 'verified') {
    return { state: 'unverified', label: 'Unverified', needsReview: true };
  }

  if (!verified) {
    return { state: 'stale', label: 'Verified date missing', needsReview: true };
  }

  const ageDays = Math.floor((nowMs - verified.getTime()) / 86400000);
  if (ageDays > 90) return { state: 'stale', label: `Stale · ${ageDays} days`, needsReview: true };
  if (ageDays > 45) return { state: 'aging', label: `Review soon · ${ageDays} days`, needsReview: false };
  return { state: 'fresh', label: `Fresh · ${ageDays} days`, needsReview: false };
}

export function validateOpportunityRecord(input = {}) {
  const record = {
    title: clean(input.title || input.name, 180),
    provider: clean(input.provider || input.organization, 180),
    university: clean(input.university || input.institution, 180),
    country: clean(input.country || input.destinationCountry, 120),
    intake: clean(input.intake || input.intakeTerm || input.intakeYear, 80),
    opportunityType: clean(input.opportunityType || input.type || 'Scholarship', 80),
    fundingType: clean(input.fundingType || input.funding, 100),
    studyLevels: list(input.studyLevels || input.educationLevels || input.studyLevel),
    subjects: list(input.subjects || input.subjectAreas || input.subject),
    eligibleNationalities: list(input.eligibleNationalities || input.nationalities),
    benefits: list(input.benefits || input.fundingBenefits),
    requirements: list(input.requirements || input.eligibilityRequirements),
    requiredDocuments: list(input.requiredDocuments),
    languageRequirements: list(input.languageRequirements || input.englishRequirements),
    deadline: clean(input.deadline || input.applicationDeadline, 30),
    officialSourceUrl: validHttpUrl(input.officialSourceUrl || input.sourceUrl || input.officialUrl),
    summary: clean(input.summary || input.description, 1200),
    status: clean(input.status || 'draft', 40).toLowerCase(),
    visibility: clean(input.visibility || 'private', 40).toLowerCase(),
    verificationStatus: clean(input.verificationStatus || 'pending', 40).toLowerCase()
  };

  const errors = [];
  const warnings = [];
  if (!record.title) errors.push('Title is required.');
  if (!record.provider && !record.university) errors.push('Provider or university is required.');
  if (!record.officialSourceUrl) errors.push('A valid official/source URL is required.');
  if (!record.country) warnings.push('Country is missing.');
  if (!record.deadline) warnings.push('Deadline is missing.');
  if (!record.subjects.length) warnings.push('No subject mapping.');
  if (!record.studyLevels.length) warnings.push('No study-level mapping.');

  if (record.deadline) {
    const date = new Date(record.deadline);
    if (Number.isNaN(date.getTime())) errors.push('Deadline is not a valid date.');
  }

  // Imports never self-verify, publish or become public.
  record.status = 'draft';
  record.visibility = 'private';
  record.verificationStatus = 'pending';

  return { record, errors, warnings, valid: errors.length === 0 };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i], next = src[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => String(value).trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some(value => String(value).trim())) rows.push(row);
  return rows;
}

export function parseOpportunityImport(text, format = 'auto') {
  const source = String(text || '').trim();
  if (!source) return { rows: [], error: 'Paste JSON or CSV data first.' };

  let values = [];
  const detected = format === 'auto' ? (source.startsWith('[') || source.startsWith('{') ? 'json' : 'csv') : format;

  try {
    if (detected === 'json') {
      const parsed = JSON.parse(source);
      values = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      const rows = parseCsvRows(source);
      if (rows.length < 2) return { rows: [], error: 'CSV needs a header row and at least one data row.' };
      const headers = rows[0].map(v => clean(v, 80));
      values = rows.slice(1).map(cells => Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ''])));
    }
  } catch (error) {
    return { rows: [], error: `Could not parse ${detected.toUpperCase()}: ${error.message}` };
  }

  if (values.length > 100) return { rows: [], error: 'Preview is limited to 100 records at a time.' };

  return {
    rows: values.map((value, index) => ({ index, ...validateOpportunityRecord(value) })),
    error: ''
  };
}

export function markImportDuplicates(previewRows = [], existing = []) {
  const existingKeys = new Set(existing.map(row => normalizeUrlKey(row.officialSourceUrl)).filter(Boolean));
  const previewKeys = new Set();

  return previewRows.map(row => {
    const key = normalizeUrlKey(row.record?.officialSourceUrl);
    const duplicateExisting = Boolean(key && existingKeys.has(key));
    const duplicateBatch = Boolean(key && previewKeys.has(key));
    if (key) previewKeys.add(key);
    return { ...row, duplicateExisting, duplicateBatch };
  });
}

export async function listAdminOpportunities(mode, user, profile) {
  if (!(await getAdminCapability(mode, user, profile))) throw new Error('Admin authorization is required.');
  if (mode === 'demo') return [];

  const snap = await getDocs(query(collection(db, C.opportunities), limit(200)));
  return snap.docs.map(row => normalizeOpportunity(row.data(), row.id));
}

async function writeAudit(user, action, opportunityId, details = {}) {
  const ref = doc(collection(db, C.opportunityAudit));
  await setDoc(ref, {
    action: clean(action, 80),
    opportunityId: clean(opportunityId, 180),
    adminUid: String(user.uid),
    details,
    createdAt: serverTimestamp()
  });
}

export async function reviewOpportunity(mode, user, profile, opportunity, action, patch = {}) {
  if (!(await getAdminCapability(mode, user, profile))) throw new Error('Admin authorization is required.');
  if (mode === 'demo') return { ...opportunity, ...patch };

  const id = clean(opportunity?.id, 180);
  if (!id) throw new Error('Opportunity ID is missing.');

  const officialSourceUrl = validHttpUrl(patch.officialSourceUrl || opportunity.officialSourceUrl);
  if (action === 'verify' && !officialSourceUrl) throw new Error('Verified opportunities require a valid official source URL.');

  const update = {
    ...patch,
    officialSourceUrl,
    updatedAt: serverTimestamp()
  };

  if (action === 'verify') {
    update.verificationStatus = 'verified';
    update.status = 'published';
    update.visibility = 'public';
    update.lastVerifiedAt = serverTimestamp();
  } else if (action === 'reject') {
    update.verificationStatus = 'rejected';
    update.status = 'archived';
    update.visibility = 'private';
  } else if (action === 'archive') {
    update.status = 'archived';
    update.visibility = 'private';
  } else if (action === 'mark_review') {
    update.verificationStatus = 'needs_review';
  } else {
    throw new Error('Unsupported review action.');
  }

  await setDoc(doc(db, C.opportunities, id), update, { merge: true });
  await writeAudit(user, action, id, { officialSourceUrl });
  return { ...opportunity, ...update };
}

export async function importOpportunityRecords(mode, user, profile, previewRows, existing = []) {
  if (!(await getAdminCapability(mode, user, profile))) throw new Error('Admin authorization is required.');

  const rows = markImportDuplicates(previewRows, existing)
    .filter(row => row.valid && !row.duplicateExisting && !row.duplicateBatch)
    .slice(0, 25);

  if (!rows.length) throw new Error('No valid non-duplicate records are ready to import.');
  if (mode === 'demo') {
    localStorage.setItem(DEMO_IMPORT_KEY, JSON.stringify(rows.map(row => row.record)));
    return { imported: rows.length, demo: true };
  }

  let imported = 0;
  for (const row of rows) {
    const ref = doc(collection(db, C.opportunities));
    await setDoc(ref, {
      ...row.record,
      verificationStatus: 'pending',
      status: 'draft',
      visibility: 'private',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      importedByAdminUid: String(user.uid)
    });
    await writeAudit(user, 'import', ref.id, { sourceUrl: row.record.officialSourceUrl });
    imported++;
  }

  return { imported, demo: false };
}
