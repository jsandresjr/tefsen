function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ');
}

function includesLoose(list = [], value = '') {
  const target = norm(value);
  if (!target) return false;
  return list.some(item => {
    const candidate = norm(item);
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
}

function check(id, label, status, message) {
  return { id, label, status, message };
}

function documentKeyFor(label = '') {
  const text = norm(label);
  if (text.includes('passport')) return 'passport';
  if (text.includes('transcript')) return 'transcript';
  if (text.includes('english') || text.includes('ielts') || text.includes('toefl')) return 'englishCertificate';
  if (text.includes('recommend')) return 'recommendationLetter';
  if (text === 'cv' || text.includes('resume') || text.includes('curriculum vitae')) return 'cv';
  if (text.includes('personal statement') || text.includes('statement of purpose') || text === 'sop') return 'personalStatement';
  return '';
}

export function evaluateEligibility(passport = {}, opportunity = {}) {
  const checks = [];

  const nationalities = opportunity.eligibleNationalities || [];
  if (!nationalities.length) {
    checks.push(check('nationality','Nationality','unknown','The listing does not contain structured nationality rules. Verify the official source.'));
  } else if (nationalities.some(item => /international|all nationalit|any nationalit/i.test(String(item)))) {
    checks.push(check('nationality','Nationality','met','This opportunity is listed for international or broadly eligible applicants.'));
  } else if (!passport.nationality) {
    checks.push(check('nationality','Nationality','action','Add your nationality to Student Passport to compare this requirement.'));
  } else if (includesLoose(nationalities, passport.nationality)) {
    checks.push(check('nationality','Nationality','met',`Your nationality matches the structured eligibility list.`));
  } else {
    checks.push(check('nationality','Nationality','not_met','Your nationality is not in the structured eligibility list currently stored for this opportunity.'));
  }

  const levels = opportunity.studyLevels || [];
  if (!levels.length) {
    checks.push(check('studyLevel','Study level','unknown','The opportunity does not contain a structured study-level requirement.'));
  } else if (!passport.targetEducationLevel) {
    checks.push(check('studyLevel','Study level','action','Add your target education level to Student Passport.'));
  } else if (includesLoose(levels, passport.targetEducationLevel)) {
    checks.push(check('studyLevel','Study level','met','Your target education level matches this opportunity.'));
  } else {
    checks.push(check('studyLevel','Study level','not_met',`This listing targets ${levels.join(', ')}.`));
  }

  const subjects = opportunity.subjects || [];
  if (!subjects.length) {
    checks.push(check('subject','Field of study','unknown','No structured subject restriction is available.'));
  } else if (!passport.mainField) {
    checks.push(check('subject','Field of study','action','Add your main field of study to Student Passport.'));
  } else if (includesLoose(subjects, passport.mainField)) {
    checks.push(check('subject','Field of study','met','Your field of study matches this opportunity.'));
  } else {
    checks.push(check('subject','Field of study','not_met',`The structured subject list currently includes: ${subjects.join(', ')}.`));
  }

  const minGpa = Number(opportunity.minGpa);
  if (!Number.isFinite(minGpa) || minGpa <= 0) {
    checks.push(check('gpa','Academic grade','unknown','No comparable structured GPA minimum is stored. Check the official grading requirement.'));
  } else if (!Number.isFinite(Number(passport.gpa))) {
    checks.push(check('gpa','Academic grade','action','Add your GPA to Student Passport to compare this criterion.'));
  } else if (Number(passport.gpaScale || 4) !== Number(opportunity.gpaScale || 4)) {
    checks.push(check('gpa','Academic grade','unknown','Your GPA scale differs from the opportunity data, so Tefsen will not make an automatic pass/fail decision.'));
  } else if (Number(passport.gpa) >= minGpa) {
    checks.push(check('gpa','Academic grade','met',`Your GPA meets the stored minimum of ${minGpa} / ${opportunity.gpaScale || 4}.`));
  } else {
    checks.push(check('gpa','Academic grade','not_met',`The stored minimum is ${minGpa} / ${opportunity.gpaScale || 4}.`));
  }

  const language = opportunity.languageRequirements || [];
  if (!language.length) {
    checks.push(check('language','Language requirement','unknown','No structured language requirement is stored.'));
  } else if (!passport.englishTestStatus) {
    checks.push(check('language','Language requirement','action','Add your English-test status to Student Passport.'));
  } else {
    checks.push(check('language','Language requirement','unknown',`Your profile says “${passport.englishTestStatus}”. Verify the required test type and score on the official source.`));
  }

  const requiredDocuments = opportunity.requiredDocuments || [];
  if (!requiredDocuments.length) {
    checks.push(check('documents','Documents','unknown','The listing does not contain a structured document checklist.'));
  } else {
    const known = requiredDocuments.map(label => ({ label, key: documentKeyFor(label) })).filter(item => item.key);
    if (!known.length) {
      checks.push(check('documents','Documents','unknown','Document requirements exist, but Tefsen cannot safely map them to your readiness checklist.'));
    } else {
      const missing = known.filter(item => !passport.documentsReady?.[item.key]).map(item => item.label);
      if (!missing.length) {
        checks.push(check('documents','Documents','met','Your Student Passport marks the recognized required documents as ready.'));
      } else {
        checks.push(check('documents','Documents','action',`Still marked not ready: ${missing.join(', ')}.`));
      }
    }
  }

  const counts = checks.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { met:0, action:0, not_met:0, unknown:0 });

  const knownDecisionCount = counts.met + counts.not_met;
  const compatibility = knownDecisionCount
    ? Math.round((counts.met / knownDecisionCount) * 100)
    : null;

  return {
    checks,
    counts,
    compatibility,
    hasBlockingMismatch: counts.not_met > 0,
    summary: counts.not_met
      ? 'Some structured requirements do not currently match your Student Passport.'
      : counts.action
        ? 'No structured mismatch was found, but your profile or preparation is incomplete.'
        : 'No structured mismatch was found in the requirements Tefsen can compare.',
    disclaimer: 'This is a structured comparison, not an admission or scholarship decision. Always verify the official provider requirements.'
  };
}

export function scoreOpportunityMatch(passport = {}, opportunity = {}) {
  let score = 0;
  const reasons = [];

  if (passport.mainField && includesLoose(opportunity.subjects || [], passport.mainField)) {
    score += 30;
    reasons.push('field of study');
  }
  if (passport.targetEducationLevel && includesLoose(opportunity.studyLevels || [], passport.targetEducationLevel)) {
    score += 25;
    reasons.push('study level');
  }
  if (passport.preferredCountries?.length && includesLoose(passport.preferredCountries, opportunity.country)) {
    score += 15;
    reasons.push('preferred country');
  }
  if (passport.fundingPreference) {
    const pref = norm(passport.fundingPreference);
    const funding = norm(opportunity.fundingType);
    const match = pref.includes('any')
      || (pref.includes('fully') && funding.includes('fully'))
      || (pref.includes('partial') && (funding.includes('partial') || funding.includes('fully')));
    if (match) {
      score += 15;
      reasons.push('funding preference');
    }
  }
  if ((opportunity.eligibleNationalities || []).some(item => /international|all nationalit|any nationalit/i.test(String(item)))
      || (passport.nationality && includesLoose(opportunity.eligibleNationalities || [], passport.nationality))) {
    score += 10;
    reasons.push('nationality');
  }
  if (opportunity.verificationStatus === 'verified') {
    score += 5;
    reasons.push('verified source');
  }

  const eligibility = evaluateEligibility(passport, opportunity);
  if (eligibility.hasBlockingMismatch) score = Math.max(0, score - 45);

  return { score: Math.max(0, Math.min(100, score)), reasons, eligibility };
}
