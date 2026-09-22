import { db } from '../firebase-client.js';
import { SCHEMA } from '../config/schema.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const C = SCHEMA.collections;
const DEMO_PREFIX = 'tefsen_student_passport_';

function clean(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function cleanList(value, maxItems = 12, maxLength = 80) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(source.map(item => clean(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanGpa(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 5 ? number : null;
}

export function emptyStudentPassport(userId = '') {
  return {
    userId,
    privacy: 'private',
    currentCountry: '',
    nationality: '',
    currentEducationLevel: '',
    targetEducationLevel: '',
    mainField: '',
    institution: '',
    gpa: null,
    gpaScale: 4,
    preferredCountries: [],
    fundingPreference: '',
    englishTestStatus: '',
    languages: [],
    skills: [],
    studyGoal: '',
    documentsReady: {
      passport: false,
      transcript: false,
      englishCertificate: false,
      recommendationLetter: false,
      cv: false,
      personalStatement: false
    }
  };
}

export function normalizeStudentPassport(raw = {}, userId = '') {
  const base = emptyStudentPassport(userId || raw.userId || raw.uid || '');
  const docs = raw.documentsReady && typeof raw.documentsReady === 'object' ? raw.documentsReady : {};
  return {
    ...base,
    ...raw,
    userId: userId || raw.userId || raw.uid || '',
    privacy: 'private',
    currentCountry: clean(raw.currentCountry),
    nationality: clean(raw.nationality),
    currentEducationLevel: clean(raw.currentEducationLevel),
    targetEducationLevel: clean(raw.targetEducationLevel),
    mainField: clean(raw.mainField),
    institution: clean(raw.institution),
    gpa: cleanGpa(raw.gpa),
    gpaScale: Number(raw.gpaScale) === 5 ? 5 : 4,
    preferredCountries: cleanList(raw.preferredCountries),
    fundingPreference: clean(raw.fundingPreference),
    englishTestStatus: clean(raw.englishTestStatus),
    languages: cleanList(raw.languages),
    skills: cleanList(raw.skills),
    studyGoal: clean(raw.studyGoal, 300),
    documentsReady: {
      passport: Boolean(docs.passport),
      transcript: Boolean(docs.transcript),
      englishCertificate: Boolean(docs.englishCertificate),
      recommendationLetter: Boolean(docs.recommendationLetter),
      cv: Boolean(docs.cv),
      personalStatement: Boolean(docs.personalStatement)
    }
  };
}

export function studentPassportCompleteness(passport = {}) {
  const p = normalizeStudentPassport(passport, passport.userId || '');
  const core = [
    p.currentCountry,
    p.nationality,
    p.currentEducationLevel,
    p.targetEducationLevel,
    p.mainField,
    p.fundingPreference,
    p.studyGoal
  ];
  const secondary = [
    p.preferredCountries.length,
    p.languages.length,
    p.skills.length,
    p.englishTestStatus
  ];
  const completed = core.filter(Boolean).length * 2 + secondary.filter(Boolean).length;
  const total = core.length * 2 + secondary.length;
  return Math.round((completed / total) * 100);
}

function demoKey(userId) {
  return DEMO_PREFIX + String(userId || 'guest');
}

export async function getStudentPassport(mode, userId) {
  if (!userId) return emptyStudentPassport('');
  if (mode === 'demo') {
    try {
      const raw = JSON.parse(localStorage.getItem(demoKey(userId)) || 'null');
      return normalizeStudentPassport(raw || {}, userId);
    } catch {
      return emptyStudentPassport(userId);
    }
  }

  const snap = await getDoc(doc(db, C.studentPassports, String(userId)));
  return snap.exists()
    ? normalizeStudentPassport(snap.data(), userId)
    : emptyStudentPassport(userId);
}

export async function saveStudentPassport(mode, userId, input = {}) {
  if (!userId) throw new Error('You must be signed in to save your Student Passport.');
  const payload = normalizeStudentPassport(input, userId);

  if (mode === 'demo') {
    localStorage.setItem(demoKey(userId), JSON.stringify(payload));
    return payload;
  }

  await setDoc(doc(db, C.studentPassports, String(userId)), {
    ...payload,
    userId: String(userId),
    privacy: 'private',
    updatedAt: serverTimestamp()
  }, { merge: true });

  return payload;
}
