import { db } from '../firebase-client.js';
import { SCHEMA } from '../config/schema.js';
import { DEMO_OPPORTUNITIES } from './opportunity-demo-data.js';
import {
  collection, doc, getDoc, getDocs, limit, query, where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const C = SCHEMA.collections;

function stringArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if (!value) return [];
  return [String(value).trim()].filter(Boolean);
}

export function normalizeOpportunity(raw = {}, id = '') {
  return {
    ...raw,
    id: id || raw.id || '',
    title: String(raw.title || raw.name || 'Untitled opportunity'),
    provider: String(raw.provider || raw.organization || raw.university || 'Opportunity provider'),
    university: String(raw.university || raw.institution || ''),
    country: String(raw.country || raw.destinationCountry || 'Global'),
    opportunityType: String(raw.opportunityType || raw.type || 'Scholarship'),
    fundingType: String(raw.fundingType || raw.funding || 'Funding not specified'),
    studyLevels: stringArray(raw.studyLevels || raw.educationLevels || raw.studyLevel),
    subjects: stringArray(raw.subjects || raw.subjectAreas || raw.subject),
    eligibleNationalities: stringArray(raw.eligibleNationalities || raw.nationalities),
    benefits: stringArray(raw.benefits || raw.fundingBenefits),
    requirements: stringArray(raw.requirements || raw.eligibilityRequirements),
    requiredDocuments: stringArray(raw.requiredDocuments),
    deadline: raw.deadline || raw.applicationDeadline || '',
    applicationOpen: raw.applicationOpen !== false && raw.status !== 'closed' && raw.status !== 'archived',
    verificationStatus: String(raw.verificationStatus || 'unverified').toLowerCase(),
    lastVerifiedAt: raw.lastVerifiedAt || null,
    summary: String(raw.summary || raw.description || ''),
    officialSourceUrl: String(raw.officialSourceUrl || raw.sourceUrl || raw.officialUrl || ''),
    status: String(raw.status || 'published').toLowerCase(),
    visibility: String(raw.visibility || 'public').toLowerCase()
  };
}

export async function getOpportunities(mode) {
  if (mode === 'demo') return DEMO_OPPORTUNITIES.map(item => normalizeOpportunity(item, item.id));

  const q = query(
    collection(db, C.opportunities),
    where('status', '==', 'published'),
    limit(60)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(row => normalizeOpportunity(row.data(), row.id))
    .filter(item => item.visibility === 'public');
}

export async function getOpportunityById(mode, opportunityId) {
  const id = String(opportunityId || '').trim();
  if (!id) return null;

  if (mode === 'demo') {
    const row = DEMO_OPPORTUNITIES.find(item => item.id === id);
    return row ? normalizeOpportunity(row, row.id) : null;
  }

  const snap = await getDoc(doc(db, C.opportunities, id));
  if (!snap.exists()) return null;
  const item = normalizeOpportunity(snap.data(), snap.id);
  if (item.status !== 'published' || item.visibility !== 'public') return null;
  return item;
}
