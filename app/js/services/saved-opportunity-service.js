const TERMINAL = new Set(['accepted','rejected','withdrawn']);

function status(value='') {
  return String(value || '').trim().toLowerCase();
}

function dayMillis(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function todayMillis(now = new Date()) {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function savedDeadlineState(value, now = new Date()) {
  const target = dayMillis(value);
  if (target === null) return { days:null, state:'unknown' };
  const days = Math.round((target - todayMillis(now)) / 86400000);
  if (days < 0) return { days, state:'expired' };
  if (days === 0) return { days, state:'today' };
  if (days <= 7) return { days, state:'urgent' };
  if (days <= 30) return { days, state:'soon' };
  return { days, state:'future' };
}

export function buildSavedOpportunityWorkspace({
  journeys = [],
  opportunities = [],
  profileScores = new Map(),
  now = new Date()
} = {}) {
  const byId = new Map(opportunities.map(item => [String(item?.id || ''), item]).filter(([id]) => id));

  const savedReview = [];
  const active = [];
  const completed = [];

  for (const journey of journeys) {
    if (!journey || (!journey.saved && !journey.started)) continue;
    const id = String(journey.opportunityId || '');
    const opportunity = byId.get(id) || null;
    const terminal = TERMINAL.has(status(journey.status));

    if (journey.started) {
      const row = { journey, opportunity };
      if (terminal) completed.push(row);
      else active.push(row);
      continue;
    }

    if (!journey.saved) continue;
    const deadline = savedDeadlineState(opportunity?.deadline || '', now);
    savedReview.push({
      journey,
      opportunity,
      deadline,
      profileScore:Number(profileScores.get(id) || 0)
    });
  }

  savedReview.sort((a,b) => {
    const rank = { today:0, urgent:1, soon:2, future:3, unknown:4, expired:5 };
    const byState = (rank[a.deadline.state] ?? 9) - (rank[b.deadline.state] ?? 9);
    if (byState !== 0) return byState;
    if (a.deadline.days !== null && b.deadline.days !== null) return a.deadline.days - b.deadline.days;
    return b.profileScore - a.profileScore;
  });

  active.sort((a,b) => Number(b.journey.updatedAtMillis || 0) - Number(a.journey.updatedAtMillis || 0));
  completed.sort((a,b) => Number(b.journey.updatedAtMillis || 0) - Number(a.journey.updatedAtMillis || 0));

  const expiredSaved = savedReview.filter(row => row.deadline.state === 'expired').length;
  const closingSaved = savedReview.filter(row => ['today','urgent','soon'].includes(row.deadline.state)).length;
  const withNotes = savedReview.filter(row => String(row.journey.notes || '').trim()).length;

  return {
    savedReview,
    active,
    completed,
    counts:{
      savedReview:savedReview.length,
      active:active.length,
      completed:completed.length,
      closingSaved,
      expiredSaved,
      withNotes
    }
  };
}

export function buildSavedComparison(rows = []) {
  return rows.slice(0,3).map(row => {
    const item = row.opportunity || {};
    return {
      id:String(item.id || row.journey?.opportunityId || ''),
      title:String(item.title || 'Opportunity unavailable'),
      provider:String(item.provider || item.university || 'Provider unavailable'),
      funding:String(item.fundingType || 'Not specified'),
      country:String(item.country || 'Not specified'),
      studyLevel:(item.studyLevels || []).join(', ') || 'Varies',
      deadline:String(item.deadline || ''),
      profileScore:Number(row.profileScore || 0),
      verificationStatus:String(item.verificationStatus || 'unverified'),
      officialSourceUrl:String(item.officialSourceUrl || '')
    };
  });
}
