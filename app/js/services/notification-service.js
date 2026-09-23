const DAY=86400000;
const PRE_SUBMISSION=new Set(['interested','preparing','ready_to_apply']);

function clean(value,max=500){
  return String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
}

function dateOnlyMillis(value){
  const raw=clean(value,40).slice(0,10);
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match) return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const millis=Date.UTC(year,month-1,day);
  const check=new Date(millis);
  if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day) return null;
  return millis;
}

function todayMillis(now=new Date()){
  return Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
}

function daysUntil(value,now=new Date()){
  const target=dateOnlyMillis(value);
  if(target===null) return null;
  return Math.round((target-todayMillis(now))/DAY);
}

function deadlineTone(days){
  if(days===null) return null;
  if(days<0) return 'critical';
  if(days<=3) return 'critical';
  if(days<=7) return 'soon';
  if(days<=14) return 'normal';
  return null;
}

function dateTimeMillis(value){
  if(!value) return 0;
  if(typeof value?.toDate==='function') return value.toDate().getTime();
  if(typeof value?.seconds==='number') return value.seconds*1000;
  if(typeof value==='number') return value;
  const parsed=new Date(value).getTime();
  return Number.isFinite(parsed)?parsed:0;
}

function priorityWeight(priority){
  return ({critical:4,soon:3,normal:2,info:1})[priority]||1;
}

function routeFromActivity(raw={}){
  const postId=clean(raw.postId||raw.questionId||raw.parentPostId,160);
  if(postId) return `post/${encodeURIComponent(postId)}`;
  const opportunityId=clean(raw.opportunityId,160);
  if(opportunityId){
    const type=clean(raw.type||raw.notificationType,80).toLowerCase();
    return type.includes('journey') ? `journey/${encodeURIComponent(opportunityId)}` : `opportunity/${encodeURIComponent(opportunityId)}`;
  }
  const actorId=clean(raw.actorId||raw.fromUserId,160);
  return actorId ? `profile/${encodeURIComponent(actorId)}` : '';
}

export function normalizeActivityNotification(raw={},readIds=new Set()){
  const id=clean(raw.id,180);
  if(!id) return null;
  const type=clean(raw.type||raw.notificationType||'update',80).toLowerCase();
  const actorName=clean(raw.actorName||raw.fromUserName||raw.senderName,80);
  const rawText=clean(raw.text||raw.message||raw.body,500);
  const isReply=['answer','comment','reply'].some(value=>type.includes(value));
  const isLike=type.includes('like');

  const title=clean(
    raw.title ||
    (isReply ? 'New reply on your Community post' :
      isLike ? 'New reaction on your Community post' :
      actorName ? `Update from ${actorName}` : 'Tefsen update'),
    180
  );

  return {
    id:`activity:${id}`,
    source:'activity',
    type:isReply?'reply':isLike?'like':'activity',
    category:'activity',
    priority:isReply?'normal':'info',
    title,
    message:rawText || (isReply ? 'Someone added a public reply.' : isLike ? 'Someone liked your public post.' : 'You have a new update.'),
    route:routeFromActivity(raw),
    actionLabel:isReply?'Open post':'View update',
    read:Boolean(raw.read||raw.isRead||readIds.has(`activity:${id}`)),
    createdAt:raw.createdAt||raw.timestamp||raw.updatedAt||null,
    timeLabel:'',
    dueDays:null,
    sortTime:dateTimeMillis(raw.createdAt||raw.timestamp||raw.updatedAt),
    actorName
  };
}

function deadlineMessage(days,noun){
  if(days<0) return `The stored ${noun} passed ${Math.abs(days)} day${Math.abs(days)===1?'':'s'} ago. Verify the current official status before acting.`;
  if(days===0) return `The stored ${noun} is today. Verify the exact official deadline and time zone.`;
  return `${days} day${days===1?'':'s'} remain until the stored ${noun}. Verify the current official source before submitting anything.`;
}

function timeLabel(days){
  if(days===null) return '';
  if(days<0) return `${Math.abs(days)}d overdue`;
  if(days===0) return 'Today';
  return `${days}d remaining`;
}

function derivedRow({
  id,type='journey',category='attention',priority='normal',title,message,route,
  actionLabel='Open',days=null,readIds=new Set(),sortTime=0
}){
  return {
    id,
    source:'derived',
    type,
    category,
    priority,
    title:clean(title,180),
    message:clean(message,600),
    route,
    actionLabel,
    read:readIds.has(id),
    createdAt:null,
    timeLabel:timeLabel(days),
    dueDays:days,
    sortTime
  };
}

function opportunityTitle(opportunity,journey){
  return clean(opportunity?.title||journey?.opportunityTitle||'Saved opportunity',180);
}

function journeyRoute(opportunityId){
  return `journey/${encodeURIComponent(opportunityId)}`;
}

function opportunityRoute(opportunityId){
  return `opportunity/${encodeURIComponent(opportunityId)}`;
}

function buildJourneyRows(journey,opportunity,readIds,now){
  const rows=[];
  const opportunityId=clean(journey.opportunityId||opportunity?.id,180);
  if(!opportunityId) return rows;
  const title=opportunityTitle(opportunity,journey);
  const status=clean(journey.status||'interested',60).toLowerCase();
  const started=Boolean(journey.started);
  const saved=journey.saved!==false;
  const officialDeadline=clean(opportunity?.deadline,30);
  const officialDays=daysUntil(officialDeadline,now);

  if(saved && officialDays!==null && (!started || PRE_SUBMISSION.has(status))){
    const tone=deadlineTone(officialDays);
    const shouldShow=started ? tone!==null : officialDays>=0 && officialDays<=14;
    if(shouldShow){
      const key=officialDays<0?'passed':officialDays<=3?'critical':officialDays<=7?'soon':'14';
      rows.push(derivedRow({
        id:`deadline:${opportunityId}:${officialDeadline}:${key}`,
        type:'deadline',
        category:'attention',
        priority:tone||'normal',
        title:started ? `${title}: official deadline needs attention` : `${title}: saved deadline is approaching`,
        message:deadlineMessage(officialDays,'official deadline'),
        route:started?journeyRoute(opportunityId):opportunityRoute(opportunityId),
        actionLabel:started?'Open Journey':'Review opportunity',
        days:officialDays,
        readIds,
        sortTime:dateOnlyMillis(officialDeadline)||0
      }));
    }
  }

  if(started && PRE_SUBMISSION.has(status)){
    const target=clean(journey.personalTargetDate,30);
    const targetDays=daysUntil(target,now);
    if(targetDays!==null && targetDays<=7){
      const tone=targetDays<0?'critical':targetDays<=2?'soon':'normal';
      const key=targetDays<0?'passed':targetDays<=2?'soon':'7';
      rows.push(derivedRow({
        id:`target:${opportunityId}:${target}:${key}`,
        type:'journey',
        category:'attention',
        priority:tone,
        title:`${title}: personal preparation target`,
        message:targetDays<0
          ? `Your private preparation target passed ${Math.abs(targetDays)} day${Math.abs(targetDays)===1?'':'s'} ago. Review your Journey and update the plan if needed.`
          : targetDays===0
            ? 'Your private preparation target is today. Review the next unfinished task.'
            : `${targetDays} day${targetDays===1?'':'s'} remain until your private preparation target.`,
        route:journeyRoute(opportunityId),
        actionLabel:'Open Journey',
        days:targetDays,
        readIds,
        sortTime:dateOnlyMillis(target)||0
      }));
    }

    if(status==='ready_to_apply'){
      rows.push(derivedRow({
        id:`ready:${opportunityId}`,
        type:'journey',
        category:'planning',
        priority:'normal',
        title:`${title}: marked ready to apply`,
        message:'Verify the current official requirements and submit only through the provider’s official application route.',
        route:journeyRoute(opportunityId),
        actionLabel:'Review Journey',
        readIds,
        sortTime:Number(journey.updatedAtMillis||0)
      }));
    }

    const checklist=Array.isArray(journey.checklist)?journey.checklist:[];
    const remaining=checklist.filter(task=>!task.completed);
    const hasUrgent=rows.some(row=>['critical','soon'].includes(row.priority));
    if(remaining.length && !hasUrgent && status!=='ready_to_apply'){
      rows.push(derivedRow({
        id:`next-task:${opportunityId}`,
        type:'journey',
        category:'planning',
        priority:'info',
        title:`${title}: continue your next Journey task`,
        message:clean(remaining[0]?.label||`${remaining.length} checklist tasks remain.`,260),
        route:journeyRoute(opportunityId),
        actionLabel:'Continue Journey',
        readIds,
        sortTime:Number(journey.updatedAtMillis||0)
      }));
    }
  }

  if(started && status==='accepted' && journey.postAcceptance){
    const plan=journey.postAcceptance||{};
    const finalDecision=['accepted_offer','declined_offer'].includes(clean(plan.offerDecision,40));
    const responseDate=clean(plan.offerResponseDate,30);
    const responseDays=daysUntil(responseDate,now);
    if(!finalDecision && responseDays!==null && responseDays<=7){
      rows.push(derivedRow({
        id:`offer-response:${opportunityId}:${responseDate}:${responseDays<0?'passed':responseDays<=2?'soon':'7'}`,
        type:'post_acceptance',
        category:'attention',
        priority:responseDays<0?'critical':responseDays<=2?'soon':'normal',
        title:`${title}: offer-response date needs attention`,
        message:deadlineMessage(responseDays,'offer-response date'),
        route:journeyRoute(opportunityId),
        actionLabel:'Open accepted Journey',
        days:responseDays,
        readIds,
        sortTime:dateOnlyMillis(responseDate)||0
      }));
    }

    const enrollmentDate=clean(plan.enrollmentDate,30);
    const enrollmentDays=daysUntil(enrollmentDate,now);
    if(clean(plan.offerDecision,40)!=='declined_offer' && enrollmentDays!==null && enrollmentDays<=14){
      rows.push(derivedRow({
        id:`enrollment:${opportunityId}:${enrollmentDate}:${enrollmentDays<0?'passed':enrollmentDays<=3?'soon':'14'}`,
        type:'post_acceptance',
        category:'attention',
        priority:enrollmentDays<0?'critical':enrollmentDays<=3?'soon':'normal',
        title:`${title}: stored enrollment date`,
        message:deadlineMessage(enrollmentDays,'enrollment date'),
        route:journeyRoute(opportunityId),
        actionLabel:'Open accepted Journey',
        days:enrollmentDays,
        readIds,
        sortTime:dateOnlyMillis(enrollmentDate)||0
      }));
    }

    const tasks=Array.isArray(plan.tasks)?plan.tasks:[];
    const next=tasks.find(task=>!task.completed);
    const hasPostDateAlert=rows.some(row=>row.type==='post_acceptance');
    if(next && !hasPostDateAlert){
      rows.push(derivedRow({
        id:`accepted-next:${opportunityId}`,
        type:'post_acceptance',
        category:'planning',
        priority:'info',
        title:`${title}: continue accepted-offer planning`,
        message:clean(next.label||'Review the next provider requirement.',260),
        route:journeyRoute(opportunityId),
        actionLabel:'Continue planning',
        readIds,
        sortTime:Number(plan.updatedAtMillis||journey.updatedAtMillis||0)
      }));
    }
  }

  return rows;
}

export function buildNotificationCenterModel({
  activityNotifications=[],
  journeys=[],
  opportunities=[],
  readIds=new Set(),
  now=new Date()
}={}){
  const safeReadIds=readIds instanceof Set?readIds:new Set(readIds||[]);
  const opportunityMap=new Map(
    (Array.isArray(opportunities)?opportunities:[])
      .filter(item=>item?.id)
      .map(item=>[String(item.id),item])
  );

  const derived=(Array.isArray(journeys)?journeys:[])
    .flatMap(journey=>buildJourneyRows(
      journey,
      opportunityMap.get(String(journey?.opportunityId||''))||null,
      safeReadIds,
      now
    ));

  const activity=(Array.isArray(activityNotifications)?activityNotifications:[])
    .map(row=>normalizeActivityNotification(row,safeReadIds))
    .filter(Boolean);

  const deduped=new Map();
  for(const item of [...derived,...activity]){
    if(!deduped.has(item.id)) deduped.set(item.id,item);
  }

  const items=[...deduped.values()].sort((a,b)=>
    Number(a.read)-Number(b.read) ||
    priorityWeight(b.priority)-priorityWeight(a.priority) ||
    (a.dueDays??999)-(b.dueDays??999) ||
    Number(b.sortTime||0)-Number(a.sortTime||0) ||
    String(a.title||'').localeCompare(String(b.title||''))
  );

  const unread=items.filter(item=>!item.read);
  const attention=items.filter(item=>item.category==='attention');
  const planning=items.filter(item=>item.category==='planning');
  const activityRows=items.filter(item=>item.category==='activity');

  return {
    items,
    unreadCount:unread.length,
    counts:{
      all:items.length,
      unread:unread.length,
      attention:attention.length,
      planning:planning.length,
      activity:activityRows.length
    },
    sections:{
      attention,
      planning,
      activity:activityRows
    },
    empty:items.length===0,
    sourceNote:'Deadline and Journey alerts are derived from your private Tefsen planning data and current public opportunity records. Always verify official deadlines and requirements on the provider source.'
  };
}
