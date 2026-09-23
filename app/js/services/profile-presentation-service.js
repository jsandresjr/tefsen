function clean(value='', max=500) {
  return String(value || '').trim().replace(/\s+/g,' ').slice(0,max);
}

function photoUrl(profile={}) {
  return clean(profile.photoUrl || profile.profileImageUrl || profile.photoURL || '', 2000);
}

export function publicProfileCompletion(profile={}) {
  const fields = {
    fullName:Boolean(clean(profile.fullName || profile.displayName || '',80)),
    username:Boolean(clean(profile.username || profile.handle || '',40)),
    bio:Boolean(clean(profile.bio || profile.about || '',500)),
    photo:Boolean(photoUrl(profile))
  };
  const weights={fullName:35,username:20,bio:25,photo:20};
  const percent=Object.entries(fields).reduce((sum,[key,ready])=>sum+(ready?weights[key]:0),0);
  const improve=[];
  if(!fields.photo) improve.push({key:'photo',label:'Add a profile photo',detail:'A public photo makes your profile easier to recognize in community discussions.'});
  if(!fields.username) improve.push({key:'username',label:'Add a username',detail:'A short username makes your public identity easier to recognize.'});
  if(!fields.bio) improve.push({key:'bio',label:'Write a short bio',detail:'Share only the study interests or context you want to make public.'});
  if(!fields.fullName) improve.push({key:'fullName',label:'Add your name',detail:'A display name is required for the public profile.'});
  return {percent,fields,improve};
}

export function validatePublicProfileDraft({fullName='',username='',bio=''}={}) {
  const errors=[];
  const warnings=[];
  const name=clean(fullName,200);
  const handle=String(username || '').trim();
  const about=String(bio || '').trim();

  if(!name) errors.push({field:'fullName',message:'Full name is required.'});
  if(name.length>80) errors.push({field:'fullName',message:'Full name can contain up to 80 characters.'});

  if(handle.length>40) errors.push({field:'username',message:'Username can contain up to 40 characters.'});
  if(handle && !/^[A-Za-z0-9._-]+$/.test(handle)) {
    errors.push({field:'username',message:'Username can use letters, numbers, dots, underscores and hyphens only.'});
  }
  if(handle && handle.length<3) {
    errors.push({field:'username',message:'Username must contain at least 3 characters when you set one.'});
  }

  if(about.length>500) errors.push({field:'bio',message:'Bio can contain up to 500 characters.'});
  if(!handle) warnings.push({code:'missing_username',message:'Username is optional, but adding one makes your public profile easier to recognize.'});
  if(!about) warnings.push({code:'missing_bio',message:'Bio is optional. Add only information you want to make public.'});

  return {valid:errors.length===0,errors,warnings};
}

export function buildProfilePresentation({
  profile={},
  own=false,
  postCount=0,
  followersCount=0,
  followingCount=0,
  passportCompleteness=0,
  savedOpportunities=0,
  activeJourneys=0,
  goal=''
}={}) {
  const fullName=clean(profile.fullName || profile.displayName || 'Tefsen User',80) || 'Tefsen User';
  const username=clean(profile.username || profile.handle || '',40);
  const bio=clean(profile.bio || profile.about || '',500);
  const photo=photoUrl(profile);
  const completion=publicProfileCompletion({fullName,username,bio,photoUrl:photo});

  return {
    own:Boolean(own),
    public:{
      fullName,
      username,
      displayHandle:username ? '@'+username : (own ? 'Add a username' : 'No public username'),
      bio,
      displayBio:bio || (own ? 'Add a short public bio about your study interests.' : 'This student has not added a public bio yet.'),
      photoUrl:photo,
      hasPhoto:Boolean(photo),
      role:clean(profile.role || 'Student',60) || 'Student',
      verified:Boolean(profile.verified),
      completion,
      stats:{
        posts:Math.max(0,Number(postCount || 0)),
        followers:Math.max(0,Number(followersCount || 0)),
        following:Math.max(0,Number(followingCount || 0))
      }
    },
    private:own ? {
      passportCompleteness:Math.max(0,Math.min(100,Number(passportCompleteness || 0))),
      savedOpportunities:Math.max(0,Number(savedOpportunities || 0)),
      activeJourneys:Math.max(0,Number(activeJourneys || 0)),
      goal:clean(goal,300) || 'Add your education goal to Student Passport'
    } : null
  };
}
