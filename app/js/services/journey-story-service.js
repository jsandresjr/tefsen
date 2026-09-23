import { detectSensitiveSuccessStoryText } from './success-story-service.js';

function cleanSingle(value,max){
  return String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
}

function cleanNarrative(value,max){
  return String(value||'')
    .replace(/\r\n?/g,'\n')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim()
    .slice(0,max);
}

function normalizeMonth(value){
  const month=cleanSingle(value,20);
  if(!month) return '';
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : month;
}

function monthIsValid(value){
  return !value || /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function validateJourneyStoryDraft(input={}){
  const title=cleanSingle(input.title,180);
  const content=cleanNarrative(input.content,3000);
  const subject=cleanSingle(input.subject,120);
  const university=cleanSingle(input.university,180);
  const intake=cleanSingle(input.intake,80);
  const source=Array.isArray(input.publicMilestones) ? input.publicMilestones : [];

  const publicMilestones=source.slice(0,4).map((item,index)=>({
    index,
    stage:cleanSingle(item?.stage,80),
    month:normalizeMonth(item?.month),
    note:cleanNarrative(item?.note,300)
  })).filter(item=>item.stage || item.month || item.note);

  const errors=[];
  const warnings=[];

  if(subject.length<2) errors.push({field:'subject',message:'Add the subject or field for this Journey story.'});
  if(title.length<8) errors.push({field:'title',message:'Use a clear story title of at least 8 characters.'});
  if(content.length<40) errors.push({field:'content',message:'Add at least 40 characters of introduction so readers understand the Journey context.'});
  if(!publicMilestones.length) errors.push({field:'stage1',message:'Add at least one public milestone.'});

  publicMilestones.forEach((item)=>{
    const position=item.index+1;
    if(item.stage.length<2){
      errors.push({field:`stage${position}`,message:`Milestone ${position} needs a short stage name.`});
    }
    if(!monthIsValid(item.month)){
      errors.push({field:`month${position}`,message:`Milestone ${position} month must use YYYY-MM.`});
    }
    if(item.note && item.note.length<8){
      errors.push({field:`note${position}`,message:`Milestone ${position} note is too short to add useful context.`});
    }
  });

  if(!university) warnings.push({field:'university',message:'University is optional.'});
  if(!intake) warnings.push({field:'intake',message:'Intake is optional.'});

  const sensitiveText=[
    title,
    content,
    university,
    intake,
    ...publicMilestones.flatMap(item=>[item.stage,item.note])
  ].filter(Boolean).join('\n');

  const sensitive=detectSensitiveSuccessStoryText({title,content:sensitiveText,university});
  for(const item of sensitive){
    errors.push({
      field:'content',
      code:item.key,
      message:`Remove the ${item.label} before publishing. Journey stories are public.`
    });
  }

  return {
    valid:errors.length===0,
    errors,
    warnings,
    sensitive,
    value:{
      title,
      content,
      subject,
      university,
      intake,
      publicMilestones:publicMilestones.map(({stage,month,note})=>({stage,month,note}))
    }
  };
}

export function buildJourneyStoryModel(post={}){
  if(String(post.postType||'')!=='journey_story') return null;

  const milestones=(Array.isArray(post.publicMilestones)?post.publicMilestones:[])
    .slice(0,8)
    .map((item,index)=>({
      index,
      stage:cleanSingle(item?.stage,80),
      month:cleanSingle(item?.month,20),
      note:cleanNarrative(item?.note,300)
    }))
    .filter(item=>item.stage || item.note);

  const status=String(post.status||'published').toLowerCase();
  const visibility=String(post.visibility||'public').toLowerCase();

  return {
    id:String(post.id||''),
    title:cleanSingle(post.title||'Student Journey story',180)||'Student Journey story',
    content:cleanNarrative(post.content,3000),
    authorId:String(post.authorId||''),
    authorName:cleanSingle(post.authorName||'Tefsen User',80)||'Tefsen User',
    authorPhotoUrl:String(post.authorPhotoUrl||''),
    role:String(post.role||'student'),
    verified:Boolean(post.verified),
    createdAt:post.createdAt||null,
    subject:cleanSingle(post.communitySubject||post.subject||'',120),
    university:cleanSingle(post.communityUniversity||'',180),
    intake:cleanSingle(post.communityIntake||'',80),
    milestones,
    tags:Array.isArray(post.tags)?post.tags.slice(0,6):[],
    likeCount:Math.max(0,Number(post.likeCount||0)),
    commentCount:Math.max(0,Number(post.commentCount||0)),
    isPublic:status==='published' && visibility==='public',
    privacyNotice:'This page shows only milestones the student explicitly chose to publish. Private Tefsen Journey stages, checklists, target dates, notes and post-acceptance planning are not automatically included.',
    trustNotice:'A student Journey is personal context, not a recommended sequence, official admissions guidance or evidence that another student will have the same timeline or result.',
    sourceNotice:'Confirm current admissions, scholarship, funding, deadline, visa, enrollment and arrival requirements on official university or provider sources.'
  };
}
