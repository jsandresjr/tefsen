function utcDateOnly(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const time = Date.UTC(year, month - 1, day);
    const date = new Date(time);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function todayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function deadlineInfo(value, now = new Date()) {
  const deadline = utcDateOnly(value);
  if (!deadline) {
    return { valid:false, daysRemaining:null, state:'unknown', label:'Deadline not listed' };
  }

  const diff = Math.round((deadline.getTime() - todayUtc(now).getTime()) / 86400000);
  let state = 'more_than_30';
  if (diff < 0) state = 'expired';
  else if (diff === 0) state = 'today';
  else if (diff <= 6) state = '1_6_days';
  else if (diff <= 14) state = '7_14_days';
  else if (diff <= 30) state = '15_30_days';

  const label = diff < 0
    ? `Expired ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} ago`
    : diff === 0
      ? 'Deadline today'
      : `${diff} day${diff === 1 ? '' : 's'} remaining`;

  return { valid:true, daysRemaining:diff, state, label, date:deadline };
}

export function effectivePlanningDate(opportunityDeadline, personalTargetDate) {
  const personal = deadlineInfo(personalTargetDate);
  if (personal.valid) return { ...personal, kind:'personal', title:'Personal target' };
  const official = deadlineInfo(opportunityDeadline);
  return { ...official, kind:'official', title:'Official deadline' };
}
