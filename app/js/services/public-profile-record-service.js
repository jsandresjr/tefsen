const PUBLIC_PROFILE_SCHEMA_VERSION = 1;

function clean(value='', max=500) {
  return String(value || '').trim().replace(/\s+/g,' ').slice(0,max);
}

function cleanUsername(value='') {
  return clean(value,40).replace(/^@+/,'');
}

function safePublicName(value='') {
  const name=clean(value,80);
  if (!name || /@/.test(name)) return 'Tefsen User';
  return name;
}

export function buildPublicProfileRecord(userId, source={}) {
  const uid=clean(userId || source.uid || source.id,180);
  if (!uid) throw new Error('Missing public profile owner.');

  const profileImageUrl=clean(
    source.profileImageUrl || source.photoURL || source.photoUrl || '',
    1200
  );

  return {
    uid,
    schemaVersion:PUBLIC_PROFILE_SCHEMA_VERSION,
    fullName:safePublicName(source.fullName || source.displayName || source.name || ''),
    username:cleanUsername(source.username || source.handle || ''),
    bio:String(source.bio || source.about || '').trim().slice(0,500),
    profileImageUrl,
    photoURL:profileImageUrl
  };
}

export function normalizePublicProfileRecord(raw={}, id='') {
  return buildPublicProfileRecord(id || raw.uid || raw.id, raw);
}

export function publicProfileContainsPrivateFields(raw={}) {
  const privateKeys=[
    'email',
    'subscriptionActive',
    'subscriptionStatus',
    'subscriptionPlan',
    'subscriptionExpiresAt',
    'studentPassport',
    'journeys',
    'savedOpportunities',
    'settings',
    'notifications',
    'role',
    'verified',
    'accountType',
    'billingStatus'
  ];
  return privateKeys.some(key => Object.prototype.hasOwnProperty.call(raw,key));
}

export { PUBLIC_PROFILE_SCHEMA_VERSION };
