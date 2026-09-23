import { isPublicProfileActivity } from './public-profile-service.js';

function createdMillis(post={}){
  const value=post.savedAtMillis ?? post._savedAtMillis ?? post.createdAtMillis ?? post.createdAt;
  if(typeof value==='number' && Number.isFinite(value)) return value;
  if(typeof value?.toDate==='function') return value.toDate().getTime();
  if(typeof value?.seconds==='number') return value.seconds*1000;
  const parsed=new Date(value || 0).getTime();
  return Number.isFinite(parsed)?parsed:0;
}

function kind(post={}){
  if(post.postType==='success_story') return 'success';
  if(post.postType==='journey_story') return 'journey';
  return 'discussion';
}

export function buildSavedCommunityModel({
  posts=[],
  referenceCount=0,
  staleCount=0
}={}){
  const deduped=new Map();
  for(const post of Array.isArray(posts)?posts:[]){
    if(!post?.id || !isPublicProfileActivity(post)) continue;
    const id=String(post.id);
    const current=deduped.get(id);
    if(!current || createdMillis(post)>createdMillis(current)) deduped.set(id,post);
  }

  const items=[...deduped.values()]
    .sort((a,b)=>
      createdMillis(b)-createdMillis(a) ||
      String(b.createdAt||'').localeCompare(String(a.createdAt||'')) ||
      String(a.id||'').localeCompare(String(b.id||''))
    );

  const discussions=items.filter(post=>kind(post)==='discussion');
  const successStories=items.filter(post=>kind(post)==='success');
  const journeyStories=items.filter(post=>kind(post)==='journey');
  const outcomes=[...successStories,...journeyStories]
    .sort((a,b)=>createdMillis(b)-createdMillis(a));

  return {
    items,
    discussions,
    successStories,
    journeyStories,
    outcomes,
    counts:{
      saved:items.length,
      discussions:discussions.length,
      successStories:successStories.length,
      journeyStories:journeyStories.length,
      outcomes:outcomes.length,
      unavailable:Math.max(0,Number(staleCount||0))
    },
    referenceCount:Math.max(Number(referenceCount||0),items.length+Math.max(0,Number(staleCount||0))),
    staleCount:Math.max(0,Number(staleCount||0)),
    empty:items.length===0,
    privacyNote:'Your Saved Community list is private account data. Saving a public post does not publish your saved list to Community.',
    distinctionNote:'Saved Community posts are separate from Saved Opportunities and application Journeys.'
  };
}
