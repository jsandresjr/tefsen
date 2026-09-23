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

export function subjectCommunityData(name, posts = [], opportunities = []) {
  const target = communityKey(name);
  const communityPosts = posts.filter(post => uniqueValues([
    post.communitySubject, post.successData?.subject, post.subject
  ].filter(Boolean), 5).some(value => communityKey(value) === target));
  const communityOpportunities = opportunities.filter(opportunity =>
    (opportunity.subjects || []).some(value => communityKey(value) === target)
  );
  return { name: clean(name,120), posts: communityPosts, opportunities: communityOpportunities };
}

export function universityCommunityData(name, posts = [], opportunities = []) {
  const target = communityKey(name);
  const communityPosts = posts.filter(post =>
    communityKey(post.communityUniversity || post.successData?.university || '') === target
  );
  const communityOpportunities = opportunities.filter(opportunity =>
    communityKey(opportunity.university || '') === target
  );
  const intakes = uniqueValues([
    ...communityPosts.map(post => post.communityIntake || post.successData?.intake || ''),
    ...communityOpportunities.map(opportunity => opportunity.intake || '')
  ].filter(Boolean), 24);

  const countries = uniqueValues([
    ...communityPosts.map(post => post.successData?.country || ''),
    ...communityOpportunities.map(opportunity => opportunity.country || '')
  ].filter(Boolean), 12);

  return {
    name: clean(name,180),
    posts: communityPosts,
    opportunities: communityOpportunities,
    intakes,
    countries
  };
}

export function intakeCommunityData(university, intake, posts = [], opportunities = []) {
  const universityKey = communityKey(university);
  const intakeKey = communityKey(intake);
  const communityPosts = posts.filter(post =>
    communityKey(post.communityUniversity || post.successData?.university || '') === universityKey &&
    communityKey(post.communityIntake || post.successData?.intake || '') === intakeKey
  );
  const communityOpportunities = opportunities.filter(opportunity =>
    communityKey(opportunity.university || '') === universityKey &&
    (!opportunity.intake || communityKey(opportunity.intake) === intakeKey)
  );
  return {
    university: clean(university,180),
    intake: clean(intake,80),
    posts: communityPosts,
    opportunities: communityOpportunities
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
