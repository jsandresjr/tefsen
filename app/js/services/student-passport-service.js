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

function cleanGpa(value, scale = 4) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  const max = Number(scale) === 5 ? 5 : 4;
  return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
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
    onboardingStatus: 'not_started',
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
  const gpaScale = Number(raw.gpaScale) === 5 ? 5 : 4;
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
    gpa: cleanGpa(raw.gpa, gpaScale),
    gpaScale,
    preferredCountries: cleanList(raw.preferredCountries),
    fundingPreference: clean(raw.fundingPreference),
    englishTestStatus: clean(raw.englishTestStatus),
    languages: cleanList(raw.languages),
    skills: cleanList(raw.skills),
    studyGoal: clean(raw.studyGoal, 300),
    onboardingStatus: ['not_started','completed','skipped'].includes(String(raw.onboardingStatus || ''))
      ? String(raw.onboardingStatus)
      : 'not_started',
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

export function studentPassportOnboardingProgress(passport = {}) {
  const p = normalizeStudentPassport(passport, passport.userId || '');
  const fields = [
    ['currentCountry', Boolean(p.currentCountry)],
    ['nationality', Boolean(p.nationality)],
    ['currentEducationLevel', Boolean(p.currentEducationLevel)],
    ['targetEducationLevel', Boolean(p.targetEducationLevel)],
    ['mainField', Boolean(p.mainField)],
    ['fundingPreference', Boolean(p.fundingPreference)]
  ];
  const completed = fields.filter(([,ready]) => ready).length;
  return {
    completed,
    total: fields.length,
    percent: Math.round((completed / fields.length) * 100),
    ready: completed === fields.length,
    missing: fields.filter(([,ready]) => !ready).map(([name]) => name)
  };
}

export function shouldShowPassportOnboarding(passport = {}) {
  const p = normalizeStudentPassport(passport, passport.userId || '');
  if (p.onboardingStatus === 'completed' || p.onboardingStatus === 'skipped') return false;
  const progress = studentPassportOnboardingProgress(p);
  return progress.completed < 3;
}

export function validateStudentPassportInput(input = {}) {
  const errors = [];
  const warnings = [];
  const gpaScale = Number(input.gpaScale) === 5 ? 5 : 4;
  const hasGpa = input.gpa !== '' && input.gpa !== null && input.gpa !== undefined;

  if (hasGpa) {
    const gpa = Number(input.gpa);
    if (!Number.isFinite(gpa) || gpa < 0) {
      errors.push({ field:'gpa', message:'Enter a valid GPA or leave it blank.' });
    } else if (gpa > gpaScale) {
      errors.push({ field:'gpa', message:`GPA cannot be higher than the selected ${gpaScale.toFixed(1)} scale.` });
    }
  }

  const listRules = [
    ['preferredCountries', 'Preferred study countries'],
    ['languages', 'Languages'],
    ['skills', 'Skills']
  ];
  for (const [field, label] of listRules) {
    const value = Array.isArray(input[field]) ? input[field] : String(input[field] || '').split(',').map(v => v.trim()).filter(Boolean);
    if (value.length > 12) {
      errors.push({ field, message:`${label} can contain up to 12 items.` });
    }
  }

  const essential = [
    ['currentCountry','Current country'],
    ['nationality','Nationality'],
    ['currentEducationLevel','Current education level'],
    ['targetEducationLevel','Target education level'],
    ['mainField','Main field / subject'],
    ['fundingPreference','Funding preference']
  ];
  const missingEssential = essential.filter(([field]) => !String(input[field] || '').trim());
  if (missingEssential.length) {
    warnings.push({
      code:'missing_essential',
      message:`${missingEssential.length} essential field${missingEssential.length === 1 ? '' : 's'} still incomplete: ${missingEssential.map(([,label]) => label).join(', ')}.`
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function studentPassportCompletionDetails(passport = {}) {
  const p = normalizeStudentPassport(passport, passport.userId || '');
  const essential = [
    ['currentCountry','Current country',Boolean(p.currentCountry)],
    ['nationality','Nationality',Boolean(p.nationality)],
    ['currentEducationLevel','Current education level',Boolean(p.currentEducationLevel)],
    ['targetEducationLevel','Target education level',Boolean(p.targetEducationLevel)],
    ['mainField','Main field / subject',Boolean(p.mainField)],
    ['fundingPreference','Funding preference',Boolean(p.fundingPreference)]
  ];
  const academic = [
    ['institution','Current institution',Boolean(p.institution)],
    ['gpa','GPA',p.gpa !== null && p.gpa !== undefined],
    ['englishTestStatus','English-test status',Boolean(p.englishTestStatus)]
  ];
  const preferences = [
    ['preferredCountries','Preferred study countries',p.preferredCountries.length > 0],
    ['studyGoal','Study / career goal',Boolean(p.studyGoal)],
    ['languages','Languages',p.languages.length > 0],
    ['skills','Skills',p.skills.length > 0]
  ];
  const documentEntries = Object.entries(p.documentsReady || {});
  const documentsReady = documentEntries.filter(([,ready]) => Boolean(ready)).length;

  const section = (items, weight) => {
    const complete = items.filter(([, ,ready]) => ready).length;
    return {
      complete,
      total: items.length,
      percent: items.length ? Math.round((complete / items.length) * 100) : 100,
      weight,
      missing: items.filter(([, ,ready]) => !ready).map(([field,label]) => ({ field, label }))
    };
  };

  const sections = {
    essential: section(essential, 50),
    academic: section(academic, 20),
    preferences: section(preferences, 20),
    documents: {
      complete: documentsReady,
      total: documentEntries.length,
      percent: documentEntries.length ? Math.round((documentsReady / documentEntries.length) * 100) : 100,
      weight: 10,
      missing: documentEntries.filter(([,ready]) => !ready).map(([field]) => ({ field, label: field }))
    }
  };

  const percent = Math.round(
    sections.essential.percent * .50 +
    sections.academic.percent * .20 +
    sections.preferences.percent * .20 +
    sections.documents.percent * .10
  );

  const next = [
    ...sections.essential.missing.map(item => ({ ...item, priority:'essential', section:'essential' })),
    ...sections.academic.missing.map(item => ({ ...item, priority:'recommended', section:'academic' })),
    ...sections.preferences.missing.map(item => ({ ...item, priority:'recommended', section:'preferences' }))
  ].slice(0, 4);

  return { percent, sections, next };
}

export function studentPassportCompleteness(passport = {}) {
  return studentPassportCompletionDetails(passport).percent;
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
