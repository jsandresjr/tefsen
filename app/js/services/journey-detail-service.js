import { buildJourneyPriorityRow } from './journey-priority-service.js';
import { buildPostAcceptanceModel } from './post-acceptance-service.js';

const TERMINAL = new Set(['accepted','rejected','withdrawn']);
const PRE_SUBMISSION = new Set(['interested','preparing','ready_to_apply']);

function norm(value='') {
  return String(value || '').trim().toLowerCase();
}

function dateOnlyMillis(value) {
  const raw=String(value || '').trim();
  if(!raw) return null;
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) {
    const year=Number(m[1]), month=Number(m[2]), day=Number(m[3]);
    const value=Date.UTC(year,month-1,day);
    const check=new Date(value);
    if(check.getUTCFullYear()!==year || check.getUTCMonth()!==month-1 || check.getUTCDate()!==day) return null;
    return value;
  }
  const d=new Date(raw);
  if(Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
}

function stageGuidance(status, priority) {
  if(status==='interested') {
    return {
      tone:'active',
      kicker:'START WITH THE REQUIREMENTS',
      title:'Turn this opportunity into a preparation plan.',
      detail:'Review the official source, set a realistic private target, and work through the checklist before moving the Journey forward.'
    };
  }
  if(status==='preparing') {
    return {
      tone:priority.attention?.tone || 'active',
      kicker:'PREPARATION IN PROGRESS',
      title:priority.attention?.title || 'Continue application preparation.',
      detail:priority.attention?.detail || 'Finish the highest-priority checklist task and keep the official requirements open for verification.'
    };
  }
  if(status==='ready_to_apply') {
    return {
      tone:'ready',
      kicker:'FINAL REVIEW',
      title:'Confirm the provider requirements before you submit.',
      detail:'Ready to apply is your own Journey status. It does not mean the provider has reviewed or accepted the application.'
    };
  }
  if(status==='applied') {
    return {
      tone:'submitted',
      kicker:'SUBMISSION RECORDED',
      title:'Track the provider response, not the old application deadline.',
      detail:'Keep confirmation details in private notes and update the Journey only when the provider sends a review, interview or outcome.'
    };
  }
  if(status==='interview') {
    return {
      tone:'review',
      kicker:'INTERVIEW / REVIEW',
      title:'Prepare for the provider review stage.',
      detail:'Use custom tasks for interview preparation, requested documents or follow-up items. The original application deadline is no longer an action alert.'
    };
  }
  if(status==='accepted') {
    return {
      tone:'accepted',
      kicker:'ACCEPTED · NEXT STAGE',
      title:'Turn the acceptance into an organized next-step plan.',
      detail:'Keep the application record unchanged, then use the separate post-acceptance plan for offer response, enrollment and other official next steps. Tefsen does not replace official visa, legal or admissions guidance.'
    };
  }
  if(status==='rejected') {
    return {
      tone:'outcome',
      kicker:'OUTCOME RECORDED',
      title:'Keep this application as a private record.',
      detail:'The Journey remains available for notes, history and reflection. This outcome does not affect other opportunity recommendations.'
    };
  }
  if(status==='withdrawn') {
    return {
      tone:'outcome',
      kicker:'JOURNEY CLOSED',
      title:'This application was marked withdrawn.',
      detail:'The private record remains available so you can review what happened without mixing it into active application priority.'
    };
  }
  return {
    tone:'active',
    kicker:'APPLICATION JOURNEY',
    title:'Continue your Journey.',
    detail:'Review the current stage, checklist and private planning information.'
  };
}

export function buildJourneyDetailModel(journey={}, opportunity=null, now=new Date()) {
  const priority=buildJourneyPriorityRow(journey,opportunity,now);
  const status=norm(journey.status);
  const tasks=Array.isArray(journey.checklist) ? journey.checklist : [];
  const incomplete=tasks.filter(task=>!task?.completed);
  const completed=tasks.filter(task=>task?.completed);
  const systemTasks=tasks.filter(task=>task?.source==='system');
  const customTasks=tasks.filter(task=>task?.source!=='system');
  const terminal=TERMINAL.has(status);
  const preSubmission=PRE_SUBMISSION.has(status);
  const guidance=stageGuidance(status,priority);
  const postAcceptance=status==='accepted'
    ? buildPostAcceptanceModel(journey,opportunity,now)
    : null;

  return {
    priority,
    status,
    terminal,
    preSubmission,
    submitted:['applied','interview'].includes(status),
    guidance,
    postAcceptance,
    progress:{
      completed:completed.length,
      total:tasks.length,
      percent:tasks.length ? Math.round((completed.length/tasks.length)*100) : 0,
      remaining:incomplete.length
    },
    tasks:{
      incomplete,
      completed,
      system:systemTasks,
      custom:customTasks,
      next:incomplete[0] || null
    },
    planning:{
      showTarget:preSubmission,
      showDeadlineUrgency:preSubmission,
      notesEditable:true,
      targetAfterOfficial:Boolean(priority.targetAfterOfficial),
      officialDeadline:opportunity?.deadline || '',
      personalTargetDate:journey.personalTargetDate || ''
    },
    history:[...(journey.history || [])].reverse(),
    officialSourceUrl:String(opportunity?.officialSourceUrl || ''),
    provider:String(opportunity?.provider || opportunity?.university || ''),
    title:String(opportunity?.title || 'Saved opportunity')
  };
}

export function validateJourneyPlanningDraft({
  status='interested',
  personalTargetDate='',
  officialDeadline='',
  notes=''
}={}) {
  const errors=[];
  const warnings=[];
  const stage=norm(status);
  const preSubmission=PRE_SUBMISSION.has(stage);
  const target=dateOnlyMillis(personalTargetDate);
  const official=dateOnlyMillis(officialDeadline);

  if(String(notes || '').length>3000) {
    errors.push({field:'notes',message:'Private notes can contain up to 3000 characters.'});
  }

  if(preSubmission && personalTargetDate && target===null) {
    errors.push({field:'personalTargetDate',message:'Enter a valid personal preparation target date.'});
  }

  if(preSubmission && target!==null && official!==null && target>official) {
    errors.push({
      field:'personalTargetDate',
      message:'Personal preparation target must be on or before the stored official deadline.'
    });
  }

  if(preSubmission && !personalTargetDate) {
    warnings.push({
      code:'no_personal_target',
      message:'A personal preparation target is optional, but setting one can make preparation easier to manage.'
    });
  }

  if(!preSubmission && personalTargetDate) {
    warnings.push({
      code:'historical_target',
      message:'This Journey is past the pre-submission stage, so the personal preparation target is kept only as historical planning context.'
    });
  }

  return {valid:errors.length===0,errors,warnings};
}
