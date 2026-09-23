export const POST_ACCEPTANCE_DECISIONS = Object.freeze([
  'reviewing',
  'intend_to_accept',
  'accepted_offer',
  'declined_offer'
]);

export const POST_ACCEPTANCE_DECISION_LABELS = Object.freeze({
  reviewing: 'Reviewing offer',
  intend_to_accept: 'Planning to accept',
  accepted_offer: 'Offer accepted',
  declined_offer: 'Offer declined'
});

export const POST_ACCEPTANCE_CATEGORY_LABELS = Object.freeze({
  offer: 'Offer & conditions',
  finance: 'Funding & fees',
  enrollment: 'Enrollment',
  immigration: 'Visa / immigration',
  arrival: 'Arrival planning',
  custom: 'My task'
});

function clean(value='', max=1000) {
  return String(value || '').trim().slice(0,max);
}

function strictDateMillis(value) {
  const raw=clean(value,20);
  if(!raw) return null;
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match) return null;
  const year=Number(match[1]);
  const month=Number(match[2]);
  const day=Number(match[3]);
  const millis=Date.UTC(year,month-1,day);
  const check=new Date(millis);
  if(
    check.getUTCFullYear()!==year ||
    check.getUTCMonth()!==month-1 ||
    check.getUTCDate()!==day
  ) return null;
  return millis;
}

function todayMillis(now=new Date()) {
  return Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
}

function daysUntil(value, now=new Date()) {
  const millis=strictDateMillis(value);
  if(millis===null) return null;
  return Math.round((millis-todayMillis(now))/86400000);
}

function normalizeDecision(value='reviewing') {
  return POST_ACCEPTANCE_DECISIONS.includes(value) ? value : 'reviewing';
}

function normalizeCategory(value='custom') {
  return Object.prototype.hasOwnProperty.call(POST_ACCEPTANCE_CATEGORY_LABELS,value) ? value : 'custom';
}

function normalizeTask(raw={}) {
  const id=clean(raw.id,120);
  const label=clean(raw.label,240);
  if(!id || !label) return null;
  return {
    id,
    label,
    category:normalizeCategory(raw.category),
    source:raw.source==='system' ? 'system' : 'custom',
    completed:Boolean(raw.completed),
    createdAtMillis:Number(raw.createdAtMillis || 0)
  };
}

export function createDefaultPostAcceptancePlan() {
  return {
    offerDecision:'reviewing',
    offerResponseDate:'',
    enrollmentDate:'',
    initializedAtMillis:0,
    updatedAtMillis:0,
    tasks:[
      {
        id:'post_offer_review',
        label:'Review the official offer letter and all conditions',
        category:'offer',
        source:'system',
        completed:false,
        createdAtMillis:0
      },
      {
        id:'post_offer_response',
        label:'Confirm the provider\'s official offer-response method and deadline',
        category:'offer',
        source:'system',
        completed:false,
        createdAtMillis:0
      },
      {
        id:'post_finance_verify',
        label:'Verify fees, deposit and funding conditions on official sources',
        category:'finance',
        source:'system',
        completed:false,
        createdAtMillis:0
      },
      {
        id:'post_enrollment',
        label:'Complete provider enrollment or registration steps when required',
        category:'enrollment',
        source:'system',
        completed:false,
        createdAtMillis:0
      },
      {
        id:'post_immigration',
        label:'Check official visa or immigration requirements if they apply to you',
        category:'immigration',
        source:'system',
        completed:false,
        createdAtMillis:0
      },
      {
        id:'post_arrival',
        label:'Plan required documents, housing and travel after official requirements are clear',
        category:'arrival',
        source:'system',
        completed:false,
        createdAtMillis:0
      }
    ]
  };
}

export function normalizePostAcceptancePlan(raw={}) {
  const defaults=createDefaultPostAcceptancePlan();
  const suppliedTasks=Array.isArray(raw.tasks)
    ? raw.tasks.map(normalizeTask).filter(Boolean)
    : null;

  return {
    offerDecision:normalizeDecision(raw.offerDecision),
    offerResponseDate:clean(raw.offerResponseDate,20),
    enrollmentDate:clean(raw.enrollmentDate,20),
    initializedAtMillis:Number(raw.initializedAtMillis || 0),
    updatedAtMillis:Number(raw.updatedAtMillis || 0),
    tasks:suppliedTasks === null ? defaults.tasks : suppliedTasks
  };
}

function attentionFor(plan, now=new Date()) {
  const responseDays=daysUntil(plan.offerResponseDate,now);

  if(plan.offerDecision==='declined_offer') {
    return {
      key:'declined',
      tone:'outcome',
      label:'Offer declined',
      title:'Keep this acceptance as a private record.',
      detail:'The provider acceptance remains part of your Journey history. Your private plan records that you chose not to continue with this offer.'
    };
  }

  if(plan.offerDecision==='accepted_offer') {
    return {
      key:'offer_accepted',
      tone:'accepted',
      label:'Offer accepted',
      title:'Continue official enrollment and arrival steps.',
      detail:'Work only from provider and government instructions that apply to your situation. Tefsen is an organizer, not an admissions, legal or immigration authority.'
    };
  }

  if(responseDays!==null && responseDays<0) {
    return {
      key:'response_date_passed',
      tone:'urgent',
      label:'Stored response date passed',
      title:'Verify your offer status with the provider.',
      detail:'Do not assume a late response is accepted. Check the official offer letter or provider portal immediately.'
    };
  }

  if(responseDays===0) {
    return {
      key:'response_today',
      tone:'urgent',
      label:'Response date today',
      title:'Confirm the official response requirement today.',
      detail:'Check the exact provider deadline, time zone and response method before taking action.'
    };
  }

  if(responseDays!==null && responseDays<=3) {
    return {
      key:'response_3',
      tone:'urgent',
      label:`${responseDays} day${responseDays===1?'':'s'} to stored response date`,
      title:'Your stored offer-response date needs attention.',
      detail:'Verify the official deadline and response method on the provider source before you submit anything.'
    };
  }

  if(responseDays!==null && responseDays<=7) {
    return {
      key:'response_7',
      tone:'soon',
      label:`${responseDays} days to stored response date`,
      title:'Finish reviewing the offer conditions.',
      detail:'Confirm funding, fees, conditions and the official response process before deciding.'
    };
  }

  if(plan.offerDecision==='intend_to_accept') {
    return {
      key:'intend_to_accept',
      tone:'active',
      label:'Planning to accept',
      title:'Verify every condition before final confirmation.',
      detail:'Use the post-acceptance plan to organize provider requirements without treating Tefsen as the official source.'
    };
  }

  if(!plan.offerResponseDate) {
    return {
      key:'missing_response_date',
      tone:'warning',
      label:'Response date not stored',
      title:'Check whether the provider requires an offer response by a specific date.',
      detail:'If an official response deadline exists, add it here for private planning. Tefsen will not invent one.'
    };
  }

  return {
    key:'reviewing',
    tone:'active',
    label:'Reviewing offer',
    title:'Compare the offer conditions with your real plan.',
    detail:'Review official funding, fees, enrollment requirements and any conditions before deciding.'
  };
}

export function validatePostAcceptanceDraft({
  offerDecision='reviewing',
  offerResponseDate='',
  enrollmentDate=''
}={}) {
  const errors=[];
  const warnings=[];
  const decision=normalizeDecision(offerDecision);

  if(decision!==offerDecision) {
    errors.push({field:'offerDecision',message:'Choose a valid private offer decision state.'});
  }

  const responseMillis=strictDateMillis(offerResponseDate);
  const enrollmentMillis=strictDateMillis(enrollmentDate);

  if(offerResponseDate && responseMillis===null) {
    errors.push({field:'offerResponseDate',message:'Enter a valid offer-response date.'});
  }
  if(enrollmentDate && enrollmentMillis===null) {
    errors.push({field:'enrollmentDate',message:'Enter a valid enrollment date.'});
  }

  if(!offerResponseDate && !['accepted_offer','declined_offer'].includes(decision)) {
    warnings.push({
      code:'missing_response_date',
      message:'No offer-response date is stored. Add one only if it is stated by the provider.'
    });
  }

  if(responseMillis!==null && enrollmentMillis!==null && enrollmentMillis<responseMillis) {
    warnings.push({
      code:'date_order',
      message:'The stored enrollment date is before the offer-response date. Verify both dates on official sources.'
    });
  }

  return {valid:errors.length===0,errors,warnings};
}

export function buildPostAcceptanceModel(journey={}, opportunity=null, now=new Date()) {
  const active=String(journey.status || '').toLowerCase()==='accepted';
  const plan=normalizePostAcceptancePlan(journey.postAcceptance || {});
  const completed=plan.tasks.filter(task=>task.completed);
  const incomplete=plan.tasks.filter(task=>!task.completed);
  const responseDays=daysUntil(plan.offerResponseDate,now);
  const enrollmentDays=daysUntil(plan.enrollmentDate,now);

  return {
    active,
    plan,
    attention:attentionFor(plan,now),
    decisionLabel:POST_ACCEPTANCE_DECISION_LABELS[plan.offerDecision],
    progress:{
      completed:completed.length,
      total:plan.tasks.length,
      remaining:incomplete.length,
      percent:plan.tasks.length ? Math.round((completed.length/plan.tasks.length)*100) : 0
    },
    tasks:{
      incomplete,
      completed,
      next:incomplete[0] || null
    },
    dates:{
      responseDays,
      enrollmentDays
    },
    provider:String(opportunity?.provider || opportunity?.university || ''),
    title:String(opportunity?.title || 'Accepted opportunity'),
    officialSourceUrl:String(opportunity?.officialSourceUrl || ''),
    safety:{
      officialSourceRequired:true,
      immigrationAdvice:false,
      legalAdvice:false,
      admissionsAuthority:false
    }
  };
}
