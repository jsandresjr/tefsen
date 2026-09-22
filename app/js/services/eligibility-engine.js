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

function check(id, label, status, message, options = {}) {
  return {
    id,
    label,
    status,
    message,
    category: options.category || 'eligibility',
    nextAction: options.nextAction || 'none',
    passportField: options.passportField || '',
    requiresOfficialSource: Boolean(options.requiresOfficialSource),
    basis: String(options.basis || '')
  };
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

function outcomeFor(counts) {
  if (counts.not_met > 0) {
    return {
      key: 'structured_mismatch',
      tone: 'mismatch',
      title: 'Some structured requirements do not match yet.',
      description: 'Review the mismatches below and confirm them on the official provider source. Stored Tefsen data can be incomplete or become outdated.'
    };
  }
  if (counts.action > 0) {
    return {
      key: 'action_needed',
      tone: 'action',
      title: 'You need to complete a few things before Tefsen can compare more.',
      description: 'No structured mismatch is currently shown, but your Student Passport or preparation data is incomplete.'
    };
  }
  if (counts.unknown > 0) {
    return {
      key: 'official_verification_needed',
      tone: 'unknown',
      title: 'No structured mismatch found, but some requirements still need official verification.',
      description: 'Tefsen does not have enough structured information to decide every criterion safely.'
    };
  }
  return {
    key: 'no_structured_mismatch',
    tone: 'met',
    title: 'No structured mismatch found in the criteria Tefsen can compare.',
    description: 'This does not guarantee admission, scholarship selection, or final eligibility. Verify the provider requirements before applying.'
  };
}

function nextActionsFor(checks, outcome) {
  const actions = [];
  const actionChecks = checks.filter(item => item.status === 'action');
  const mismatchChecks = checks.filter(item => item.status === 'not_met');
  const unknownChecks = checks.filter(item => item.status === 'unknown');

  if (actionChecks.length) {
    const passportLabels = actionChecks
      .filter(item => ['update_passport', 'update_documents'].includes(item.nextAction))
      .map(item => item.label);

    if (passportLabels.length) {
      actions.push({
        type: 'passport',
        label: 'Update Student Passport',
        detail: `Complete: ${[...new Set(passportLabels)].join(', ')}.`
      });
    }
  }

  if (mismatchChecks.length) {
    actions.push({
      type: 'official_source',
      label: 'Verify structured mismatches',
      detail: `Confirm ${mismatchChecks.map(item => item.label).join(', ')} on the official provider source before ruling the opportunity out.`
    });
  }

  if (unknownChecks.length) {
    actions.push({
      type: 'official_source',
      label: 'Verify unknown requirements',
      detail: `Check ${unknownChecks.map(item => item.label).join(', ')} on the official provider source.`
    });
  }

  if (!actions.length && outcome.key === 'no_structured_mismatch') {
    actions.push({
      type: 'official_source',
      label: 'Confirm final provider requirements',
      detail: 'Review the official source before preparing or submitting an application.'
    });
  }

  return actions.slice(0, 3);
}

export function evaluateEligibility(passport = {}, opportunity = {}) {
  const checks = [];

  const nationalities = opportunity.eligibleNationalities || [];
  if (!nationalities.length) {
    checks.push(check(
      'nationality',
      'Nationality',
      'unknown',
      'The listing does not contain structured nationality rules.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: 'No structured eligible-nationality list is stored for this opportunity.'
      }
    ));
  } else if (nationalities.some(item => /international|all nationalit|any nationalit/i.test(String(item)))) {
    checks.push(check(
      'nationality',
      'Nationality',
      'met',
      'This opportunity is stored as open to international or broadly eligible applicants.',
      {
        basis: `Stored rule: ${nationalities.join(', ')}.`
      }
    ));
  } else if (!passport.nationality) {
    checks.push(check(
      'nationality',
      'Nationality',
      'action',
      'Add your nationality to Student Passport to compare this requirement.',
      {
        nextAction: 'update_passport',
        passportField: 'nationality',
        basis: `Stored eligible list: ${nationalities.join(', ')}.`
      }
    ));
  } else if (includesLoose(nationalities, passport.nationality)) {
    checks.push(check(
      'nationality',
      'Nationality',
      'met',
      'Your nationality matches the structured eligibility list.',
      {
        basis: `Your Passport: ${passport.nationality} · Stored rule: ${nationalities.join(', ')}.`
      }
    ));
  } else {
    checks.push(check(
      'nationality',
      'Nationality',
      'not_met',
      'Your nationality does not appear in the structured eligibility list currently stored for this opportunity.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: `Your Passport: ${passport.nationality} · Stored rule: ${nationalities.join(', ')}.`
      }
    ));
  }

  const levels = opportunity.studyLevels || [];
  if (!levels.length) {
    checks.push(check(
      'studyLevel',
      'Study level',
      'unknown',
      'The opportunity does not contain a structured study-level requirement.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: 'No structured study-level list is stored.'
      }
    ));
  } else if (!passport.targetEducationLevel) {
    checks.push(check(
      'studyLevel',
      'Study level',
      'action',
      'Add your target education level to Student Passport.',
      {
        nextAction: 'update_passport',
        passportField: 'targetEducationLevel',
        basis: `Stored study level: ${levels.join(', ')}.`
      }
    ));
  } else if (includesLoose(levels, passport.targetEducationLevel)) {
    checks.push(check(
      'studyLevel',
      'Study level',
      'met',
      'Your target education level matches this opportunity.',
      {
        basis: `Your target: ${passport.targetEducationLevel} · Stored level: ${levels.join(', ')}.`
      }
    ));
  } else {
    checks.push(check(
      'studyLevel',
      'Study level',
      'not_met',
      `This listing targets ${levels.join(', ')}.`,
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: `Your target: ${passport.targetEducationLevel} · Stored level: ${levels.join(', ')}.`
      }
    ));
  }

  const subjects = opportunity.subjects || [];
  if (!subjects.length) {
    checks.push(check(
      'subject',
      'Field of study',
      'unknown',
      'No structured subject restriction is available.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: 'No structured subject list is stored.'
      }
    ));
  } else if (!passport.mainField) {
    checks.push(check(
      'subject',
      'Field of study',
      'action',
      'Add your main field of study to Student Passport.',
      {
        nextAction: 'update_passport',
        passportField: 'mainField',
        basis: `Stored subject scope: ${subjects.join(', ')}.`
      }
    ));
  } else if (includesLoose(subjects, passport.mainField)) {
    checks.push(check(
      'subject',
      'Field of study',
      'met',
      'Your field of study matches the stored subject scope.',
      {
        basis: `Your field: ${passport.mainField} · Stored scope: ${subjects.join(', ')}.`
      }
    ));
  } else {
    checks.push(check(
      'subject',
      'Field of study',
      'not_met',
      'Your field does not appear in the structured subject scope currently stored.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: `Your field: ${passport.mainField} · Stored scope: ${subjects.join(', ')}.`
      }
    ));
  }

  const minGpa = Number(opportunity.minGpa);
  if (!Number.isFinite(minGpa) || minGpa <= 0) {
    checks.push(check(
      'gpa',
      'Academic grade',
      'unknown',
      'No comparable structured GPA minimum is stored.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: 'No comparable minimum GPA is stored.'
      }
    ));
  } else if (passport.gpa === null || passport.gpa === undefined || passport.gpa === '' || !Number.isFinite(Number(passport.gpa))) {
    checks.push(check(
      'gpa',
      'Academic grade',
      'action',
      'Add your GPA to Student Passport to compare this criterion.',
      {
        nextAction: 'update_passport',
        passportField: 'gpa',
        basis: `Stored minimum: ${minGpa} / ${opportunity.gpaScale || 4}.`
      }
    ));
  } else if (Number(passport.gpaScale || 4) !== Number(opportunity.gpaScale || 4)) {
    checks.push(check(
      'gpa',
      'Academic grade',
      'unknown',
      'Your GPA scale differs from the opportunity data, so Tefsen will not convert it automatically.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: `Your GPA: ${passport.gpa} / ${passport.gpaScale || 4} · Stored minimum: ${minGpa} / ${opportunity.gpaScale || 4}.`
      }
    ));
  } else if (Number(passport.gpa) >= minGpa) {
    checks.push(check(
      'gpa',
      'Academic grade',
      'met',
      `Your GPA meets the stored minimum of ${minGpa} / ${opportunity.gpaScale || 4}.`,
      {
        basis: `Your GPA: ${passport.gpa} / ${passport.gpaScale || 4}.`
      }
    ));
  } else {
    checks.push(check(
      'gpa',
      'Academic grade',
      'not_met',
      `Your GPA is below the stored minimum of ${minGpa} / ${opportunity.gpaScale || 4}.`,
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: `Your GPA: ${passport.gpa} / ${passport.gpaScale || 4} · Stored minimum: ${minGpa} / ${opportunity.gpaScale || 4}.`
      }
    ));
  }

  const language = opportunity.languageRequirements || [];
  if (!language.length) {
    checks.push(check(
      'language',
      'Language requirement',
      'unknown',
      'No structured language requirement is stored.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: 'No structured language-test requirement is stored.'
      }
    ));
  } else if (!passport.englishTestStatus) {
    checks.push(check(
      'language',
      'Language requirement',
      'action',
      'Add your English-test status to Student Passport.',
      {
        nextAction: 'update_passport',
        passportField: 'englishTestStatus',
        basis: `Stored language requirement: ${language.join(', ')}.`
      }
    ));
  } else {
    checks.push(check(
      'language',
      'Language requirement',
      'unknown',
      'Tefsen will not infer that your current test status meets a specific provider score or test type.',
      {
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: `Your Passport: ${passport.englishTestStatus} · Stored requirement: ${language.join(', ')}.`
      }
    ));
  }

  const requiredDocuments = opportunity.requiredDocuments || [];
  if (!requiredDocuments.length) {
    checks.push(check(
      'documents',
      'Document readiness',
      'unknown',
      'The listing does not contain a structured document checklist.',
      {
        category: 'preparation',
        requiresOfficialSource: true,
        nextAction: 'official_source',
        basis: 'No structured required-document list is stored.'
      }
    ));
  } else {
    const known = requiredDocuments.map(label => ({ label, key: documentKeyFor(label) })).filter(item => item.key);
    if (!known.length) {
      checks.push(check(
        'documents',
        'Document readiness',
        'unknown',
        'Document requirements exist, but Tefsen cannot safely map them to your readiness checklist.',
        {
          category: 'preparation',
          requiresOfficialSource: true,
          nextAction: 'official_source',
          basis: `Stored requirements: ${requiredDocuments.join(', ')}.`
        }
      ));
    } else {
      const missing = known.filter(item => !passport.documentsReady?.[item.key]).map(item => item.label);
      if (!missing.length) {
        checks.push(check(
          'documents',
          'Document readiness',
          'met',
          'Your Student Passport marks the recognized required documents as ready.',
          {
            category: 'preparation',
            basis: `Recognized documents: ${known.map(item => item.label).join(', ')}.`
          }
        ));
      } else {
        checks.push(check(
          'documents',
          'Document readiness',
          'action',
          `Still marked not ready: ${missing.join(', ')}.`,
          {
            category: 'preparation',
            nextAction: 'update_documents',
            passportField: 'documentsReady',
            basis: `Recognized required documents: ${known.map(item => item.label).join(', ')}.`
          }
        ));
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
  const coverage = checks.length
    ? Math.round((knownDecisionCount / checks.length) * 100)
    : 0;
  const outcome = outcomeFor(counts);

  return {
    checks,
    counts,
    compatibility,
    coverage,
    comparedCriteria: knownDecisionCount,
    totalCriteria: checks.length,
    hasBlockingMismatch: counts.not_met > 0,
    outcome,
    nextActions: nextActionsFor(checks, outcome),
    summary: outcome.title,
    disclaimer: 'This is a structured comparison, not an admission, scholarship, visa, or legal decision. Always verify the official provider requirements.'
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
