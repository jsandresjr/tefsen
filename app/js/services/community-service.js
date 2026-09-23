import { isPublicProfileActivity } from './public-profile-service.js';

function clean(value, max = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function communityKey(value = '') {
  return clean(value, 180).toLowerCase();
}

export function uniqueValues(values = [], max = 40) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const label = clean(value, 180);
    const key = communityKey(label);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
    if (result.length >= max) break;
  }
  return result;
}

export function buildSubjectCommunities(posts = [], opportunities = []) {
  const map = new Map();
  const ensure = name => {
    const label = clean(name, 120) || 'General';
    const key = communityKey(label);
    if (!map.has(key)) map.set(key, { key, name: label, postCount: 0, opportunityCount: 0, successCount: 0 });
    return map.get(key);
  };

  for (const post of posts) {
    const names = uniqueValues([
      post.communitySubject,
      post.successData?.subject,
      post.subject
    ].filter(Boolean), 4);
    for (const name of names) {
      const row = ensure(name);
      row.postCount += 1;
      if (post.postType === 'success_story') row.successCount += 1;
    }
  }

  for (const opportunity of opportunities) {
    for (const name of opportunity.subjects || []) ensure(name).opportunityCount += 1;
  }

  return [...map.values()].sort((a,b) =>
    (b.opportunityCount * 2 + b.postCount + b.successCount * 2) -
    (a.opportunityCount * 2 + a.postCount + a.successCount * 2)
  );
}

export function buildUniversityCommunities(posts = [], opportunities = []) {
  const map = new Map();
  const ensure = name => {
    const label = clean(name, 180);
    if (!label) return null;
    const key = communityKey(label);
    if (!map.has(key)) map.set(key, {
      key, name: label, countries: new Set(), postCount: 0, opportunityCount: 0,
      successCount: 0, intakes: new Set()
    });
    return map.get(key);
  };

  for (const opportunity of opportunities) {
    const row = ensure(opportunity.university);
    if (!row) continue;
    row.opportunityCount += 1;
    if (opportunity.country) row.countries.add(clean(opportunity.country, 120));
    if (opportunity.intake) row.intakes.add(clean(opportunity.intake, 80));
  }

  for (const post of posts) {
    const university = post.communityUniversity || post.successData?.university || '';
    const row = ensure(university);
    if (!row) continue;
    row.postCount += 1;
    if (post.postType === 'success_story') row.successCount += 1;
    if (post.successData?.country) row.countries.add(clean(post.successData.country, 120));
    if (post.communityIntake) row.intakes.add(clean(post.communityIntake, 80));
    if (post.successData?.intake) row.intakes.add(clean(post.successData.intake, 80));
  }

  return [...map.values()].map(row => ({
    ...row,
    countries: [...row.countries],
    intakes: [...row.intakes]
  })).sort((a,b) =>
    (b.opportunityCount * 2 + b.postCount + b.successCount * 2) -
    (a.opportunityCount * 2 + a.postCount + a.successCount * 2)
  );
}

function postMatchesSubject(post={}, target='') {
  return uniqueValues([
    post.communitySubject,
    post.successData?.subject,
    post.subject
  ].filter(Boolean),5).some(value=>communityKey(value)===target);
}

function opportunityMatchesSubject(opportunity={}, target='') {
  return (Array.isArray(opportunity.subjects) ? opportunity.subjects : [])
    .some(value=>communityKey(value)===target);
}

export function buildSubjectCommunityModel(name, posts = [], opportunities = []) {
  const subjectName=clean(name,120);
  const target=communityKey(subjectName);
  const publicPosts=(Array.isArray(posts) ? posts : [])
    .filter(isPublicProfileActivity)
    .filter(post=>postMatchesSubject(post,target));
  const linkedOpportunities=(Array.isArray(opportunities) ? opportunities : [])
    .filter(opportunity=>opportunityMatchesSubject(opportunity,target));

  const discussions=publicPosts
    .filter(post=>communityPostType(post)==='discussion')
    .sort((a,b)=>discussionActivityScore(b)-discussionActivityScore(a));

  const unanswered=discussions
    .filter(post=>Number(post.commentCount || 0)===0)
    .sort((a,b)=>{
      const bySaves=Number(b.saveCount || 0)-Number(a.saveCount || 0);
      return bySaves || Number(b.likeCount || 0)-Number(a.likeCount || 0);
    });

  const outcomes=publicPosts
    .filter(post=>communityPostType(post)!=='discussion')
    .sort((a,b)=>outcomeActivityScore(b)-outcomeActivityScore(a));

  const universities=uniqueValues(
    linkedOpportunities.map(item=>item.university).filter(Boolean),
    12
  );

  const destinations=uniqueValues(
    linkedOpportunities.map(item=>item.country).filter(Boolean),
    12
  );

  const fundingTypes=uniqueValues(
    linkedOpportunities.map(item=>item.fundingType).filter(Boolean),
    8
  );

  return {
    name:subjectName || 'Subject',
    discussions,
    unanswered,
    outcomes,
    opportunities:linkedOpportunities,
    universities,
    destinations,
    fundingTypes,
    counts:{
      discussions:discussions.length,
      unanswered:unanswered.length,
      outcomes:outcomes.length,
      opportunities:linkedOpportunities.length,
      universities:universities.length,
      destinations:destinations.length
    },
    empty:discussions.length===0 && outcomes.length===0 && linkedOpportunities.length===0,
    rankingNote:'Discussion order uses public engagement signals such as replies, saves and likes. It is not a quality or accuracy score.',
    sourceNote:'Linked opportunities provide discovery context only. Official provider sources remain authoritative for eligibility, deadlines, funding and application requirements.'
  };
}

export function subjectCommunityData(name, posts = [], opportunities = []) {
  const model=buildSubjectCommunityModel(name,posts,opportunities);
  return {
    name:model.name,
    posts:[...model.discussions,...model.outcomes],
    opportunities:model.opportunities
  };
}

function postUniversityName(post={}) {
  return clean(post.communityUniversity || post.successData?.university || '',180);
}

function postIntakeName(post={}) {
  return clean(post.communityIntake || post.successData?.intake || '',80);
}

function opportunityUniversityName(opportunity={}) {
  return clean(opportunity.university || '',180);
}

function opportunityIntakeName(opportunity={}) {
  return clean(opportunity.intake || '',80);
}

function rankedDiscussions(posts=[]) {
  return [...posts]
    .filter(post=>communityPostType(post)==='discussion')
    .sort((a,b)=>discussionActivityScore(b)-discussionActivityScore(a));
}

function unansweredDiscussions(posts=[]) {
  return [...posts]
    .filter(post=>Number(post.commentCount || 0)===0)
    .sort((a,b)=>{
      const bySaves=Number(b.saveCount || 0)-Number(a.saveCount || 0);
      return bySaves || Number(b.likeCount || 0)-Number(a.likeCount || 0);
    });
}

function rankedOutcomes(posts=[]) {
  return [...posts]
    .filter(post=>communityPostType(post)!=='discussion')
    .sort((a,b)=>outcomeActivityScore(b)-outcomeActivityScore(a));
}

export function buildUniversityCommunityModel(name, posts = [], opportunities = []) {
  const university=clean(name,180);
  const target=communityKey(university);

  const publicPosts=(Array.isArray(posts) ? posts : [])
    .filter(isPublicProfileActivity)
    .filter(post=>communityKey(postUniversityName(post))===target);

  const linkedOpportunities=(Array.isArray(opportunities) ? opportunities : [])
    .filter(opportunity=>communityKey(opportunityUniversityName(opportunity))===target);

  const discussions=rankedDiscussions(publicPosts);
  const unanswered=unansweredDiscussions(discussions);
  const outcomes=rankedOutcomes(publicPosts);

  const intakes=uniqueValues([
    ...publicPosts.map(post=>postIntakeName(post)),
    ...linkedOpportunities.map(opportunity=>opportunityIntakeName(opportunity))
  ].filter(Boolean),24);

  const intakeSummaries=intakes.map(intake=>{
    const intakeKey=communityKey(intake);
    const intakePosts=publicPosts.filter(post=>communityKey(postIntakeName(post))===intakeKey);
    const exactOpportunities=linkedOpportunities.filter(opportunity=>communityKey(opportunityIntakeName(opportunity))===intakeKey);
    return {
      name:intake,
      postCount:intakePosts.length,
      discussionCount:intakePosts.filter(post=>communityPostType(post)==='discussion').length,
      outcomeCount:intakePosts.filter(post=>communityPostType(post)!=='discussion').length,
      opportunityCount:exactOpportunities.length
    };
  }).sort((a,b)=>
    (b.opportunityCount*3 + b.discussionCount*2 + b.outcomeCount) -
    (a.opportunityCount*3 + a.discussionCount*2 + a.outcomeCount)
  );

  const countries=uniqueValues([
    ...publicPosts.map(post=>post.successData?.country || ''),
    ...linkedOpportunities.map(opportunity=>opportunity.country || '')
  ].filter(Boolean),12);

  const subjects=uniqueValues([
    ...publicPosts.map(post=>post.communitySubject || post.successData?.subject || post.subject || ''),
    ...linkedOpportunities.flatMap(opportunity=>Array.isArray(opportunity.subjects) ? opportunity.subjects : [])
  ].filter(Boolean),20);

  const fundingTypes=uniqueValues(
    linkedOpportunities.map(opportunity=>opportunity.fundingType).filter(Boolean),
    10
  );

  return {
    name:university || 'University',
    discussions,
    unanswered,
    outcomes,
    opportunities:linkedOpportunities,
    intakes,
    intakeSummaries,
    countries,
    subjects,
    fundingTypes,
    counts:{
      discussions:discussions.length,
      unanswered:unanswered.length,
      outcomes:outcomes.length,
      opportunities:linkedOpportunities.length,
      intakes:intakes.length,
      subjects:subjects.length
    },
    empty:publicPosts.length===0 && linkedOpportunities.length===0,
    rankingNote:'Discussion order uses public engagement signals such as replies, saves and likes. It is not a quality or accuracy score.',
    sourceNote:'This is a student community space, not an official university channel. Official institution and provider sources remain authoritative for admissions, fees, funding, deadlines, visas and enrollment requirements.'
  };
}

export function buildIntakeCommunityModel(universityName, intakeName, posts = [], opportunities = []) {
  const university=clean(universityName,180);
  const intake=clean(intakeName,80);
  const universityKey=communityKey(university);
  const intakeKey=communityKey(intake);

  const publicPosts=(Array.isArray(posts) ? posts : [])
    .filter(isPublicProfileActivity)
    .filter(post=>
      communityKey(postUniversityName(post))===universityKey &&
      communityKey(postIntakeName(post))===intakeKey
    );

  const universityOpportunities=(Array.isArray(opportunities) ? opportunities : [])
    .filter(opportunity=>communityKey(opportunityUniversityName(opportunity))===universityKey);

  const exactOpportunities=universityOpportunities
    .filter(opportunity=>communityKey(opportunityIntakeName(opportunity))===intakeKey);

  const generalUniversityOpportunities=universityOpportunities
    .filter(opportunity=>!opportunityIntakeName(opportunity));

  const discussions=rankedDiscussions(publicPosts);
  const unanswered=unansweredDiscussions(discussions);
  const outcomes=rankedOutcomes(publicPosts);

  const subjects=uniqueValues([
    ...publicPosts.map(post=>post.communitySubject || post.successData?.subject || post.subject || ''),
    ...exactOpportunities.flatMap(opportunity=>Array.isArray(opportunity.subjects) ? opportunity.subjects : [])
  ].filter(Boolean),20);

  const countries=uniqueValues([
    ...publicPosts.map(post=>post.successData?.country || ''),
    ...exactOpportunities.map(opportunity=>opportunity.country || ''),
    ...generalUniversityOpportunities.map(opportunity=>opportunity.country || '')
  ].filter(Boolean),12);

  return {
    university:university || 'University',
    intake:intake || 'Intake',
    discussions,
    unanswered,
    outcomes,
    opportunities:exactOpportunities,
    generalUniversityOpportunities,
    subjects,
    countries,
    counts:{
      discussions:discussions.length,
      unanswered:unanswered.length,
      outcomes:outcomes.length,
      opportunities:exactOpportunities.length,
      generalUniversityOpportunities:generalUniversityOpportunities.length,
      subjects:subjects.length
    },
    empty:publicPosts.length===0 && exactOpportunities.length===0,
    rankingNote:'Discussion order uses public engagement signals such as replies, saves and likes. It is not a quality or accuracy score.',
    sourceNote:'This intake space is community context only. Confirm intake dates, admissions, fees, funding, enrollment, visa and arrival requirements on official university or provider sources.',
    privacyNote:'Do not publish application IDs, passport or visa numbers, booking references, exact addresses, private documents or other sensitive application/travel information.'
  };
}

export function universityCommunityData(name, posts = [], opportunities = []) {
  const model=buildUniversityCommunityModel(name,posts,opportunities);
  return {
    name:model.name,
    posts:[...model.discussions,...model.outcomes],
    opportunities:model.opportunities,
    intakes:model.intakes,
    countries:model.countries
  };
}

export function intakeCommunityData(university, intake, posts = [], opportunities = []) {
  const model=buildIntakeCommunityModel(university,intake,posts,opportunities);
  return {
    university:model.university,
    intake:model.intake,
    posts:[...model.discussions,...model.outcomes],
    opportunities:model.opportunities
  };
}


function communityPostType(post={}) {
  const type=String(post.postType || 'discussion').trim();
  return ['success_story','journey_story'].includes(type) ? type : 'discussion';
}

function discussionActivityScore(post={}) {
  const comments=Math.max(0,Number(post.commentCount || 0));
  const saves=Math.max(0,Number(post.saveCount || 0));
  const likes=Math.max(0,Number(post.likeCount || 0));
  const subject=clean(post.communitySubject || post.subject || '',120);
  return comments*4 + saves*3 + likes + (subject && communityKey(subject)!=='general' ? 5 : 0);
}

function outcomeActivityScore(post={}) {
  const comments=Math.max(0,Number(post.commentCount || 0));
  const saves=Math.max(0,Number(post.saveCount || 0));
  const likes=Math.max(0,Number(post.likeCount || 0));
  return comments*3 + saves*3 + likes;
}

export function buildCommunityHomeModel(posts=[], opportunities=[]) {
  const publicPosts=(Array.isArray(posts) ? posts : []).filter(isPublicProfileActivity);
  const publicOpportunities=Array.isArray(opportunities) ? opportunities : [];
  const subjects=buildSubjectCommunities(publicPosts,publicOpportunities)
    .filter(row=>communityKey(row.name)!=='general');
  const universities=buildUniversityCommunities(publicPosts,publicOpportunities);

  const discussions=publicPosts
    .filter(post=>communityPostType(post)==='discussion')
    .sort((a,b)=>discussionActivityScore(b)-discussionActivityScore(a));

  const unanswered=discussions
    .filter(post=>Number(post.commentCount || 0)===0)
    .sort((a,b)=>{
      const bySaves=Number(b.saveCount || 0)-Number(a.saveCount || 0);
      return bySaves || Number(b.likeCount || 0)-Number(a.likeCount || 0);
    });

  const outcomes=publicPosts
    .filter(post=>communityPostType(post)!=='discussion')
    .sort((a,b)=>outcomeActivityScore(b)-outcomeActivityScore(a));

  const activeSubjects=subjects
    .filter(row=>row.postCount>0 || row.opportunityCount>0)
    .slice(0,6);

  const activeUniversities=universities
    .filter(row=>row.postCount>0 || row.opportunityCount>0)
    .slice(0,4);

  return {
    counts:{
      discussions:discussions.length,
      unanswered:unanswered.length,
      outcomes:outcomes.length,
      subjectCommunities:subjects.length,
      universityCommunities:universities.length
    },
    discussions:discussions.slice(0,6),
    unanswered:unanswered.slice(0,3),
    outcomes:outcomes.slice(0,4),
    subjects:activeSubjects,
    universities:activeUniversities,
    empty:publicPosts.length===0 && activeSubjects.length===0 && activeUniversities.length===0,
    rankingNote:'Discussion order uses public engagement signals such as replies, saves and likes. It is not a quality or accuracy score.'
  };
}
