function clean(value='', max=500) {
  return String(value || '').trim().replace(/\s+/g,' ').slice(0,max);
}

function handle(value='') {
  return clean(value,40).replace(/^@+/,'');
}

export function validatePublicProfileDraft({
  fullName='',
  username='',
  bio=''
}={}) {
  const errors=[];
  const warnings=[];
  const name=clean(fullName,80);
  const user=handle(username);
  const about=String(bio || '').trim();

  if(name.length<2) {
    errors.push({field:'fullName',message:'Enter the name you want shown on your public profile.'});
  }

  if(user && user.length<3) {
    errors.push({field:'username',message:'Public username must contain at least 3 characters.'});
  }

  if(user && !/^[a-zA-Z0-9._-]+$/.test(user)) {
    errors.push({field:'username',message:'Username can use letters, numbers, dots, underscores and hyphens only.'});
  }

  if(about.length>500) {
    errors.push({field:'bio',message:'Bio can contain up to 500 characters.'});
  }

  if(!user) {
    warnings.push({code:'missing_username',message:'Add a public username so other students can recognize your profile more easily.'});
  }
  if(!about) {
    warnings.push({code:'missing_bio',message:'A short public bio can explain what you study or what you contribute to the community.'});
  }

  return {
    valid:errors.length===0,
    errors,
    warnings,
    value:{fullName:name,username:user,bio:about.slice(0,500)}
  };
}


export function resolveProfilePhotoForUpdate(current={}, authPhoto='') {
  const aliases=['profileImageUrl','profilePhotoUrl','profilePictureUrl','photoURL','photoUrl','avatarUrl','imageUrl'];
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(current,key)) {
      const value=current[key];
      return value === undefined || value === null ? '' : String(value).trim();
    }
  }
  return String(authPhoto || '').trim();
}

export function buildPublicProfileModel({
  profile={},
  own=false,
  posts=[],
  passportCompleteness=0,
  activeJourneys=0,
  savedOpportunities=0
}={}) {
  const fullName=clean(profile.fullName || profile.displayName || 'Tefsen User',80) || 'Tefsen User';
  const username=handle(profile.username || profile.handle || '');
  const bio=String(profile.bio || profile.about || '').trim().slice(0,500);
  const photoUrl=String(profile.photoUrl || profile.profileImageUrl || profile.photoURL || '').trim();
  const publicPosts=Array.isArray(posts) ? posts : [];

  const identityChecks=[
    {key:'name',label:'Public name',complete:fullName!=='Tefsen User' && fullName.length>=2},
    {key:'username',label:'Username',complete:username.length>=3},
    {key:'bio',label:'Bio',complete:bio.length>=20},
    {key:'photo',label:'Profile photo',complete:Boolean(photoUrl)}
  ];
  const identityCompleted=identityChecks.filter(item=>item.complete).length;
  const identityPercent=Math.round((identityCompleted/identityChecks.length)*100);

  const fallbackBio=own
    ? 'Add a short public bio so students understand your interests or what you contribute.'
    : 'This student has not added a public bio yet.';

  const capabilities=publicProfileCapabilities();

  return {
    own:Boolean(own),
    fullName,
    username,
    handleLabel:username ? '@'+username : (own ? 'Add a username' : 'No public username'),
    bio,
    bioLabel:bio || fallbackBio,
    photoUrl,
    hasPhoto:Boolean(photoUrl),
    role:String(profile.role || 'Student'),
    verified:Boolean(profile.verified),
    publicStats:{
      posts:publicPosts.length
    },
    capabilities,
    privateWorkspace:own ? {
      passportCompleteness:Math.max(0,Math.min(100,Number(passportCompleteness || 0))),
      activeJourneys:Math.max(0,Number(activeJourneys || 0)),
      savedOpportunities:Math.max(0,Number(savedOpportunities || 0))
    } : null,
    identity:{
      percent:identityPercent,
      completed:identityCompleted,
      total:identityChecks.length,
      checks:identityChecks,
      missing:identityChecks.filter(item=>!item.complete)
    },
    privacy:{
      publicFields:['name','username','bio','profile photo','public community activity'],
      privateFields:['Student Passport','saved opportunities','application Journeys','private planning notes']
    }
  };
}


export function projectPublicUser(raw={}, id='') {
  const uid=String(raw.uid || raw.id || id || '');
  const fullName=clean(raw.fullName || raw.displayName || 'Tefsen User',80) || 'Tefsen User';
  const username=handle(raw.username || raw.handle || '');
  const bio=String(raw.bio || raw.about || '').trim().slice(0,500);
  const photoUrl=String(raw.photoUrl || raw.profileImageUrl || raw.photoURL || '').trim();
  const role=String(raw.role || 'Student');
  return {
    id:uid,
    uid,
    fullName,
    username,
    bio,
    photoUrl,
    role,
    verified:Boolean(raw.verified)
  };
}

export function isPublicProfileActivity(post={}) {
  const status=String(post.status || 'published').toLowerCase();
  const visibility=String(post.visibility || 'public').toLowerCase();
  return status==='published' && visibility==='public';
}

export function publicProfileCapabilities() {
  return Object.freeze({
    follow:false,
    message:false,
    profileReporting:false
  });
}
