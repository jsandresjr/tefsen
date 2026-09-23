const TERMINAL = new Set(['accepted','rejected','withdrawn']);
const PRE_SUBMISSION = new Set(['interested','preparing','ready_to_apply']);

function norm(value='') {
  return String(value || '').trim().toLowerCase();
}

function dateMillis(value) {
  const raw=String(value || '').trim();
  if(!raw) return null;
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
  const d=new Date(raw);
  if(Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
}

function todayMillis(now=new Date()) {
  return Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
}

function daysUntil(value,now=new Date()) {
  const target=dateMillis(value);
  if(target===null) return null;
  return Math.round((target-todayMillis(now))/86400000);
}

function taskProgress(journey={}) {
  const tasks=Array.isArray(journey.checklist) ? journey.checklist : [];
  const completed=tasks.filter(task=>task?.completed).length;
  const next=tasks.find(task=>!task?.completed) || null;
  return {
    completed,
    total:tasks.length,
    percent:tasks.length ? Math.round((completed/tasks.length)*100) : 0,
    nextTask:next ? String(next.label || '') : ''
  };
}

function priorityFor({journey,officialDays,personalDays,targetAfterOfficial,progress}) {
  const status=norm(journey.status);

  if(TERMINAL.has(status)) return 90;

  if(PRE_SUBMISSION.has(status)) {
    if(officialDays!==null && officialDays<0) return 0;
    if(officialDays===0) return 1;
    if(officialDays!==null && officialDays>0 && officialDays<=3) return 2;
    if(personalDays!==null && personalDays<0) return 3;
    if(targetAfterOfficial) return 4;
    if(officialDays!==null && officialDays>3 && officialDays<=7) return 5;
    if(officialDays!==null && officialDays>7 && officialDays<=14) return 6;
    if(status==='ready_to_apply') return progress.total===0 || progress.completed===progress.total ? 7 : 8;
    if(status==='preparing') return 10;
    return 12;
  }

  if(status==='interview') return 8;
  if(status==='applied') return 11;
  return 20;
}

function attentionFor({journey,opportunity,officialDays,personalDays,targetAfterOfficial,progress}) {
  const status=norm(journey.status);
  const officialKnown=officialDays!==null;

  if(status==='accepted') {
    return {
      key:'accepted',
      tone:'accepted',
      label:'Accepted',
      title:'Continue with post-acceptance planning',
      detail:'Your application outcome is accepted. Keep the next stage organized in this private Journey.'
    };
  }
  if(status==='rejected') {
    return {
      key:'rejected',
      tone:'outcome',
      label:'Outcome recorded',
      title:'Application marked rejected',
      detail:'This Journey is complete. Keep it as a private record of the application outcome.'
    };
  }
  if(status==='withdrawn') {
    return {
      key:'withdrawn',
      tone:'outcome',
      label:'Journey closed',
      title:'Application marked withdrawn',
      detail:'This Journey is complete and remains available as a private record.'
    };
  }

  if(PRE_SUBMISSION.has(status)) {
    if(officialDays!==null && officialDays<0) {
      return {
        key:'deadline_expired',tone:'expired',label:'Stored deadline passed',
        title:'The stored official application deadline has passed',
        detail:'Do not assume late submission or a new cycle is available. Check the official provider source before taking further application action.'
      };
    }
    if(officialDays===0) {
      return {
        key:'deadline_today',tone:'urgent',label:'Deadline today',
        title:'Official deadline is today',
        detail:'Prioritize final checks now and confirm the exact closing time on the official provider source.'
      };
    }
    if(officialDays!==null && officialDays>0 && officialDays<=3) {
      return {
        key:'deadline_3',tone:'urgent',label:`${officialDays} day${officialDays===1?'':'s'} left`,
        title:'Official deadline needs immediate attention',
        detail:'Finish the highest-priority preparation tasks and verify submission timing on the official source.'
      };
    }
    if(personalDays!==null && personalDays<0) {
      return {
        key:'personal_overdue',tone:'urgent',label:'Personal target missed',
        title:'Your preparation target has passed',
        detail:'Reset the personal target or complete the remaining work. The official provider deadline is unchanged.'
      };
    }
    if(targetAfterOfficial) {
      return {
        key:'target_after_official',tone:'warning',label:'Target needs fixing',
        title:'Personal target is after the official deadline',
        detail:'Move your preparation target earlier than the stored official deadline.'
      };
    }
    if(officialDays!==null && officialDays>3 && officialDays<=7) {
      return {
        key:'deadline_7',tone:'warning',label:`${officialDays} days left`,
        title:'Deadline is within one week',
        detail:progress.nextTask ? `Next unfinished task: ${progress.nextTask}` : 'Review the official requirements and finish submission preparation.'
      };
    }
    if(officialDays!==null && officialDays>7 && officialDays<=14) {
      return {
        key:'deadline_14',tone:'soon',label:`${officialDays} days left`,
        title:'Deadline is approaching',
        detail:progress.nextTask ? `Keep moving: ${progress.nextTask}` : 'Use this time to verify requirements and complete preparation.'
      };
    }
    if(status==='ready_to_apply') {
      return {
        key:'ready_to_apply',tone:'ready',label:'Ready to apply',
        title:'Review the final submission requirements',
        detail:progress.total && progress.completed<progress.total
          ? `${progress.total-progress.completed} checklist task${progress.total-progress.completed===1?'':'s'} still incomplete.`
          : 'Your checklist is complete or has no remaining tasks. Confirm the official source before submitting.'
      };
    }
    if(status==='preparing') {
      return {
        key:'preparing',tone:'active',label:'Preparing',
        title:progress.nextTask ? progress.nextTask : 'Continue application preparation',
        detail:progress.total
          ? `${progress.completed} of ${progress.total} checklist tasks complete.`
          : 'Add preparation tasks if the provider requirements are not structured in Tefsen.'
      };
    }
    return {
      key:'interested',tone:'active',label:'Journey started',
      title:'Turn interest into a preparation plan',
      detail:officialKnown ? 'Review requirements, set a personal target and begin the checklist.' : 'Review the official source, set a target and begin preparation.'
    };
  }

  if(status==='interview') {
    return {
      key:'interview',tone:'review',label:'Interview / review',
      title:'Prepare for the review stage',
      detail:'The original application deadline is no longer treated as an action deadline. Keep interview/review preparation and outcome updates current.'
    };
  }

  if(status==='applied') {
    return {
      key:'applied',tone:'submitted',label:'Applied',
      title:'Application submitted',
      detail:'The original application deadline is no longer an action alert. Update this Journey when the provider sends a review, interview or outcome.'
    };
  }

  return {
    key:'active',tone:'active',label:'Active Journey',
    title:'Continue your application Journey',
    detail:'Review your current stage, tasks and private planning notes.'
  };
}

export function buildJourneyPriorityRow(journey={},opportunity=null,now=new Date()) {
  const progress=taskProgress(journey);
  const status=norm(journey.status);
  const preSubmission=PRE_SUBMISSION.has(status);
  const officialDays=preSubmission ? daysUntil(opportunity?.deadline || '',now) : null;
  const personalDays=preSubmission ? daysUntil(journey.personalTargetDate || '',now) : null;
  const officialMillis=preSubmission ? dateMillis(opportunity?.deadline || '') : null;
  const personalMillis=preSubmission ? dateMillis(journey.personalTargetDate || '') : null;
  const targetAfterOfficial=Boolean(
    officialMillis!==null &&
    personalMillis!==null &&
    personalMillis>officialMillis
  );
  const attention=attentionFor({
    journey,opportunity,officialDays,personalDays,targetAfterOfficial,progress
  });
  const priority=priorityFor({
    journey,officialDays,personalDays,targetAfterOfficial,progress
  });

  return {
    journey,
    opportunity,
    status,
    terminal:TERMINAL.has(status),
    preSubmission,
    progress,
    officialDays,
    personalDays,
    targetAfterOfficial,
    attention,
    priority,
    updatedAtMillis:Number(journey.updatedAtMillis || 0)
  };
}

export function buildJourneyPriorityWorkspace(rows=[],now=new Date()) {
  const mapped=rows.map(row=>buildJourneyPriorityRow(row.journey || row,row.opportunity || null,now));
  const active=mapped.filter(row=>!row.terminal).sort((a,b)=>{
    if(a.priority!==b.priority) return a.priority-b.priority;
    const aOfficial=a.officialDays===null ? Number.POSITIVE_INFINITY : a.officialDays;
    const bOfficial=b.officialDays===null ? Number.POSITIVE_INFINITY : b.officialDays;
    if(aOfficial!==bOfficial) return aOfficial-bOfficial;
    return b.updatedAtMillis-a.updatedAtMillis;
  });
  const outcomes=mapped.filter(row=>row.terminal).sort((a,b)=>b.updatedAtMillis-a.updatedAtMillis);

  const needsAttention=active.filter(row=>row.priority<=6);
  const ready=active.filter(row=>row.attention.key==='ready_to_apply');
  const submitted=active.filter(row=>['applied','interview'].includes(row.status));

  return {
    active,
    outcomes,
    primary:active[0] || null,
    counts:{
      active:active.length,
      needsAttention:needsAttention.length,
      ready:ready.length,
      submitted:submitted.length,
      outcomes:outcomes.length
    }
  };
}
