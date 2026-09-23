function normStatus(value = '') {
  return String(value || '').trim().toLowerCase();
}

function dateOnlyMillis(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function todayMillis(now = new Date()) {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function homeDeadlineDays(value, now = new Date()) {
  const target = dateOnlyMillis(value);
  if (target === null) return null;
  return Math.round((target - todayMillis(now)) / 86400000);
}

function journeyTaskProgress(journey = {}) {
  const tasks = Array.isArray(journey.checklist) ? journey.checklist : [];
  if (!tasks.length) return { completed:0, total:0, percent:0 };
  const completed = tasks.filter(task => task?.completed).length;
  return { completed, total:tasks.length, percent:Math.round((completed / tasks.length) * 100) };
}

function meaningfulMatch(row = {}) {
  const score = Number(row.profileScore || 0);
  const personalized = row.personalized !== false && score > 0;
  return personalized ? score : 0;
}

function opportunityMap(rows = []) {
  return new Map(rows.map(row => [String(row.item?.id || ''), row.item]).filter(([id]) => id));
}

function journeyTitle(journey, opportunities) {
  const item = opportunities.get(String(journey?.opportunityId || ''));
  return item?.title || 'Your saved opportunity';
}

function routeForJourney(journey) {
  const id = encodeURIComponent(String(journey?.opportunityId || ''));
  return journey?.started ? `journey/${id}` : `opportunity/${id}`;
}

function nearestDeadlineEntry(journeys, opportunities, now) {
  return journeys
    .filter(row => {
      if (!(row?.saved || row?.started)) return false;
      const status = normStatus(row?.status);
      if (row?.started && ['accepted','rejected','withdrawn'].includes(status)) return false;
      return true;
    })
    .map(row => {
      const item = opportunities.get(String(row.opportunityId || ''));
      const days = homeDeadlineDays(item?.deadline || '', now);
      return { journey:row, item, days };
    })
    .filter(entry => entry.days !== null && entry.days >= 0)
    .sort((a,b) => a.days - b.days)[0] || null;
}

export function buildHomeDashboardModel({
  passport = {},
  passportDetails = {},
  rankedOpportunities = [],
  journeys = [],
  now = new Date()
} = {}) {
  const opportunityById = opportunityMap(rankedOpportunities);
  const visibleJourneys = journeys.filter(row => row?.saved || row?.started);
  const activeJourneys = visibleJourneys.filter(row => row?.started && !['accepted','rejected','withdrawn'].includes(normStatus(row.status)));
  const acceptedJourneys = visibleJourneys.filter(row => row?.started && normStatus(row.status) === 'accepted');
  const savedNotStarted = visibleJourneys.filter(row => row?.saved && !row?.started);
  const activePriority = activeJourneys
    .map(journey => ({ journey, progress:journeyTaskProgress(journey) }))
    .sort((a,b) => Number(b.journey.updatedAtMillis || 0) - Number(a.journey.updatedAtMillis || 0))[0] || null;
  const nearest = nearestDeadlineEntry(visibleJourneys, opportunityById, now);

  const essential = passportDetails?.sections?.essential || { complete:0, total:6, percent:0, missing:[] };
  const passportPercent = Number(passportDetails?.percent || 0);
  const essentialReady = essential.total > 0 && essential.complete >= essential.total;
  const hasDirection = Boolean(passport?.mainField || passport?.targetEducationLevel || passport?.studyGoal);

  const topMatch = rankedOpportunities
    .filter(row => meaningfulMatch(row) > 0)
    .sort((a,b) => meaningfulMatch(b) - meaningfulMatch(a))[0] || null;

  let state = 'discovery';
  let eyebrow = 'YOUR NEXT STEP';
  let action = {
    tone:'discovery',
    title:'Discover opportunities worth exploring',
    detail:'Browse the global opportunity catalogue and save anything you want to compare or prepare for.',
    route:'opportunities',
    button:'Explore opportunities',
    reason:'No urgent application action is waiting right now.'
  };

  if (nearest && nearest.days <= 14) {
    state = 'deadline';
    action = {
      tone: nearest.days <= 3 ? 'urgent' : 'deadline',
      title: nearest.days === 0 ? 'A saved opportunity closes today' : `${nearest.days} days until a saved opportunity deadline`,
      detail: journeyTitle(nearest.journey, opportunityById),
      route: routeForJourney(nearest.journey),
      button: nearest.journey.started ? 'Continue Journey' : 'Review before deadline',
      reason:'Deadlines take priority over profile completion and discovery.'
    };
  } else if (acceptedJourneys.length) {
    const row = acceptedJourneys[0];
    state = 'accepted';
    action = {
      tone:'accepted',
      title:'Continue after acceptance',
      detail:`${journeyTitle(row, opportunityById)} · keep your next-stage preparation organized.`,
      route:routeForJourney(row),
      button:'Open accepted Journey',
      reason:'Your accepted outcome is now more important than finding another application task.'
    };
  } else if (activePriority) {
    const row = activePriority;
    state = 'journey';
    action = {
      tone:'journey',
      title:'Continue your active application',
      detail:`${journeyTitle(row.journey, opportunityById)} · ${row.progress.completed}/${row.progress.total} preparation tasks complete.`,
      route:routeForJourney(row.journey),
      button:'Open Journey',
      reason:'You already started preparing this opportunity.'
    };
  } else if (!essentialReady) {
    state = 'getting_started';
    const missing = (essential.missing || []).slice(0,2).map(item => item.label).filter(Boolean);
    action = {
      tone:'passport',
      title:'Finish the essentials in Student Passport',
      detail:missing.length
        ? `Add ${missing.join(' and ')} to improve opportunity matching and eligibility comparisons.`
        : 'Complete your essential education direction so Tefsen can make matching more useful.',
      route:'passport',
      button:'Complete Passport essentials',
      reason:'Essential Passport fields are missing, so personalized matching is limited.'
    };
  } else if (savedNotStarted.length) {
    const row = savedNotStarted[0];
    state = 'saved';
    action = {
      tone:'saved',
      title:'Turn a saved opportunity into a plan',
      detail:`${journeyTitle(row, opportunityById)} is saved but its private Journey has not started.`,
      route:routeForJourney(row),
      button:'Review saved opportunity',
      reason:'You already showed interest by saving this opportunity.'
    };
  } else if (topMatch) {
    state = 'match';
    action = {
      tone:'match',
      title:'Review your strongest current profile match',
      detail:`${topMatch.item?.title || 'Opportunity'} · ${meaningfulMatch(topMatch)}% profile match based on structured Passport factors.`,
      route:`opportunity/${encodeURIComponent(String(topMatch.item?.id || ''))}`,
      button:'Review opportunity',
      reason:'Your essential Passport data is ready and this is the strongest structured match currently loaded.'
    };
  }

  const firstMissing = (passportDetails?.next || [])[0] || null;
  const goal = passport?.studyGoal
    || (passport?.mainField ? `${passport?.targetEducationLevel || 'Study'} opportunity in ${passport.mainField}` : '')
    || 'Set your education direction';

  const savedCount = visibleJourneys.filter(row => row.saved).length;
  const activeCount = activeJourneys.length;
  const acceptedCount = acceptedJourneys.length;
  const newUser = visibleJourneys.length === 0 && !hasDirection && passportPercent < 30;

  return {
    state,
    eyebrow,
    action,
    newUser,
    goal,
    passportPercent,
    essentialReady,
    firstMissing,
    savedCount,
    activeCount,
    acceptedCount,
    nearestDeadline: nearest ? {
      days:nearest.days,
      title:journeyTitle(nearest.journey, opportunityById),
      route:routeForJourney(nearest.journey),
      status:normStatus(nearest.journey.status)
    } : null,
    activeJourney:activePriority?.journey || null,
    acceptedJourney:acceptedJourneys[0] || null,
    topMatch,
    stats:{
      saved:savedCount,
      active:activeCount,
      accepted:acceptedCount,
      passport:passportPercent
    }
  };
}
