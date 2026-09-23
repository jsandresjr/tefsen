import { isPublicProfileActivity } from './public-profile-service.js';
import {
  buildSubjectCommunities,
  buildUniversityCommunities,
  communityKey
} from './community-service.js';

function clean(value,max=500){
  return String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
}

function normalize(value){
  return clean(value,1200)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase();
}

function tokens(value){
  return [...new Set(normalize(value).split(/[^a-z0-9]+/).filter(Boolean))].slice(0,8);
}

function excerpt(value,max=180){
  const text=clean(value,1000);
  return text.length>max ? text.slice(0,max-1).trimEnd()+'…' : text;
}

function textScore(query,weightedFields=[]){
  const q=normalize(query);
  const qs=tokens(q);
  if(!q || !qs.length) return 0;

  let score=0;
  const combined=weightedFields.map(([value])=>normalize(value)).join(' ');
  if(!qs.every(token=>combined.includes(token))) return 0;

  for(const [value,weight=1] of weightedFields){
    const field=normalize(value);
    if(!field) continue;
    if(field===q) score+=60*weight;
    else if(field.startsWith(q)) score+=32*weight;
    else if(field.includes(q)) score+=22*weight;

    for(const token of qs){
      if(field===token) score+=18*weight;
      else if(field.startsWith(token)) score+=10*weight;
      else if(field.includes(token)) score+=5*weight;
    }
  }
  return score;
}

function sortResults(rows=[]){
  return [...rows].sort((a,b)=>
    (b.score-a.score) ||
    String(a.title||'').localeCompare(String(b.title||''))
  );
}

function publicPostResult(post,query){
  if(!isPublicProfileActivity(post)) return null;
  const storyData=post.successData||{};
  const milestoneText=(Array.isArray(post.publicMilestones)?post.publicMilestones:[])
    .flatMap(item=>[item?.stage,item?.note])
    .join(' ');
  const score=textScore(query,[
    [post.title,5],
    [post.subject,4],
    [post.communitySubject,4],
    [post.communityUniversity,3],
    [post.communityIntake,3],
    [storyData.opportunityName,4],
    [storyData.university,3],
    [storyData.country,2],
    [storyData.subject,4],
    [storyData.intake,3],
    [(post.tags||[]).join(' '),3],
    [milestoneText,2],
    [post.content,1]
  ]);
  if(!score) return null;

  const type=String(post.postType||'discussion');
  const kind=type==='success_story' ? 'success' : type==='journey_story' ? 'journey' : 'discussion';
  const label=kind==='success' ? 'Success story' : kind==='journey' ? 'Journey story' : 'Discussion';

  return {
    kind,
    id:String(post.id||''),
    route:`post/${encodeURIComponent(post.id||'')}`,
    title:clean(post.title || post.content || label,180) || label,
    subtitle:[label,clean(post.subject||post.communitySubject||'',120),clean(post.authorName||'',80)].filter(Boolean).join(' · '),
    excerpt:excerpt(post.content||'',190),
    score
  };
}

function userResult(user,query){
  const score=textScore(query,[
    [user.fullName,5],
    [user.username,5],
    [user.bio,2],
    [user.role,1]
  ]);
  if(!score) return null;
  const uid=String(user.uid||user.id||'');
  if(!uid) return null;
  return {
    kind:'person',
    id:uid,
    route:`profile/${encodeURIComponent(uid)}`,
    title:clean(user.fullName||'Tefsen User',80) || 'Tefsen User',
    subtitle:[user.username ? '@'+clean(user.username,40) : '',clean(user.role||'Student',60)].filter(Boolean).join(' · '),
    excerpt:excerpt(user.bio||'',150),
    photoUrl:String(user.photoUrl||''),
    verified:Boolean(user.verified),
    role:String(user.role||'student'),
    score
  };
}

function opportunityResult(item,query){
  const score=textScore(query,[
    [item.title,5],
    [item.provider,4],
    [item.university,4],
    [item.country,3],
    [item.intake,3],
    [item.opportunityType,3],
    [item.fundingType,3],
    [(item.subjects||[]).join(' '),4],
    [(item.studyLevels||[]).join(' '),3],
    [(item.benefits||[]).join(' '),2],
    [item.summary,1]
  ]);
  if(!score) return null;
  return {
    kind:'opportunity',
    id:String(item.id||''),
    route:`opportunity/${encodeURIComponent(item.id||'')}`,
    title:clean(item.title||'Opportunity',180),
    subtitle:[clean(item.provider||item.university||'',160),clean(item.country||'',100),clean(item.fundingType||'',100)].filter(Boolean).join(' · '),
    excerpt:excerpt(item.summary||'',190),
    verified:String(item.verificationStatus||'').toLowerCase()==='verified',
    officialSourceUrl:String(item.officialSourceUrl||''),
    score
  };
}

function subjectResults(posts,opportunities,query){
  return buildSubjectCommunities(posts,opportunities)
    .filter(row=>communityKey(row.name)!=='general')
    .map(row=>{
      const score=textScore(query,[[row.name,5]]);
      if(!score) return null;
      return {
        kind:'subject',
        id:row.key,
        route:`subject/${encodeURIComponent(row.name)}`,
        title:row.name,
        subtitle:'Subject community',
        excerpt:`${row.postCount} public post${row.postCount===1?'':'s'} · ${row.opportunityCount} linked opportunit${row.opportunityCount===1?'y':'ies'}`,
        score
      };
    }).filter(Boolean);
}

function universityAndIntakeResults(posts,opportunities,query){
  const universities=[];
  const intakes=[];
  for(const row of buildUniversityCommunities(posts,opportunities)){
    const universityScore=textScore(query,[
      [row.name,5],
      [(row.countries||[]).join(' '),2]
    ]);
    if(universityScore){
      universities.push({
        kind:'university',
        id:row.key,
        route:`university/${encodeURIComponent(row.name)}`,
        title:row.name,
        subtitle:[ 'University community', ...(row.countries||[]).slice(0,2) ].join(' · '),
        excerpt:`${row.postCount} public post${row.postCount===1?'':'s'} · ${row.opportunityCount} linked opportunit${row.opportunityCount===1?'y':'ies'}`,
        score:universityScore
      });
    }

    for(const intake of row.intakes||[]){
      const score=textScore(query,[
        [intake,5],
        [row.name,4],
        [(row.countries||[]).join(' '),2]
      ]);
      if(!score) continue;
      intakes.push({
        kind:'intake',
        id:`${row.key}::${communityKey(intake)}`,
        route:`intake/${encodeURIComponent(row.name)}/${encodeURIComponent(intake)}`,
        title:intake,
        subtitle:`${row.name} · Intake community`,
        excerpt:(row.countries||[]).slice(0,3).join(' · '),
        score
      });
    }
  }
  return {universities,intakes};
}

export function buildGlobalSearchModel({
  term='',
  users=[],
  posts=[],
  opportunities=[]
}={}){
  const query=clean(term,120);
  const publicPosts=(Array.isArray(posts)?posts:[]).filter(isPublicProfileActivity);
  const safeUsers=Array.isArray(users)?users:[];
  const publicOpportunities=(Array.isArray(opportunities)?opportunities:[])
    .filter(item=>String(item.status||'published').toLowerCase()==='published')
    .filter(item=>String(item.visibility||'public').toLowerCase()==='public');

  const subjects=buildSubjectCommunities(publicPosts,publicOpportunities)
    .filter(row=>communityKey(row.name)!=='general');
  const universityRows=buildUniversityCommunities(publicPosts,publicOpportunities);

  if(!query){
    return {
      query:'',
      counts:{all:0,people:0,community:0,opportunities:0,subjects:0,universities:0,intakes:0},
      top:[],
      people:[],
      community:[],
      opportunities:[],
      subjects:[],
      universities:[],
      intakes:[],
      discover:{
        subjects:subjects.slice(0,6),
        universities:universityRows.slice(0,4),
        opportunities:publicOpportunities.slice(0,4)
      },
      empty:true,
      rankingNote:'Search uses deterministic text matching across public Tefsen content and opportunity metadata. It is not a quality, eligibility or recommendation score.'
    };
  }

  const people=sortResults(safeUsers.map(user=>userResult(user,query)).filter(Boolean)).slice(0,20);
  const community=sortResults(publicPosts.map(post=>publicPostResult(post,query)).filter(Boolean)).slice(0,30);
  const opportunityMatches=sortResults(publicOpportunities.map(item=>opportunityResult(item,query)).filter(Boolean)).slice(0,30);
  const subjectMatches=sortResults(subjectResults(publicPosts,publicOpportunities,query)).slice(0,20);
  const {universities:universityMatches,intakes:intakeMatches}=universityAndIntakeResults(publicPosts,publicOpportunities,query);
  const universities=sortResults(universityMatches).slice(0,20);
  const intakes=sortResults(intakeMatches).slice(0,20);

  const top=sortResults([
    ...people.slice(0,5),
    ...community.slice(0,8),
    ...opportunityMatches.slice(0,8),
    ...subjectMatches.slice(0,5),
    ...universities.slice(0,5),
    ...intakes.slice(0,5)
  ]).slice(0,12);

  const counts={
    people:people.length,
    community:community.length,
    opportunities:opportunityMatches.length,
    subjects:subjectMatches.length,
    universities:universities.length,
    intakes:intakes.length
  };
  counts.all=Object.values(counts).reduce((sum,value)=>sum+value,0);

  return {
    query,
    counts,
    top,
    people,
    community,
    opportunities:opportunityMatches,
    subjects:subjectMatches,
    universities,
    intakes,
    discover:{subjects:[],universities:[],opportunities:[]},
    empty:counts.all===0,
    rankingNote:'Search uses deterministic text matching across public Tefsen content and opportunity metadata. It is not a quality, eligibility or recommendation score.'
  };
}
