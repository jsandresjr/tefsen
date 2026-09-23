const NEW_ACCOUNT_KEYS = Object.freeze([
  'uid',
  'email',
  'fullName',
  'displayName',
  'username',
  'bio',
  'role',
  'profileImageUrl',
  'photoURL',
  'verified',
  'createdAt',
  'updatedAt'
]);

function clean(value='', max=1200) {
  return String(value || '').trim().replace(/\s+/g,' ').slice(0,max);
}

function safeDisplayName(value='') {
  const name=clean(value,80);
  if (!name || name.includes('@')) return 'Tefsen User';
  return name;
}

function safePhoto(value='') {
  const url=clean(value,1200);
  return /^https:\/\//i.test(url) ? url : '';
}

export function buildNewAccountDocument(user={}, {
  fullNameOverride='',
  createdAt=null,
  updatedAt=null
}={}) {
  const uid=clean(user.uid,180);
  if (!uid) throw new Error('Missing authenticated user ID.');

  const fullName=safeDisplayName(fullNameOverride || user.displayName || '');
  const photo=safePhoto(user.photoURL || '');

  return {
    uid,
    email:clean(user.email,320),
    fullName,
    displayName:fullName,
    username:'',
    bio:'',
    role:'student',
    profileImageUrl:photo,
    photoURL:photo,
    verified:false,
    createdAt,
    updatedAt
  };
}

export function buildExistingAccountProfilePatch(user={}, existing={}, {
  fullNameOverride='',
  updatedAt=null
}={}) {
  const existingName=safeDisplayName(existing.fullName || existing.displayName || '');
  const authName=safeDisplayName(fullNameOverride || user.displayName || '');
  const fullName=existingName !== 'Tefsen User' ? existingName : authName;
  const hasStoredPhotoField=
    Object.prototype.hasOwnProperty.call(existing,'profileImageUrl')
    || Object.prototype.hasOwnProperty.call(existing,'photoURL');
  const existingPhoto=safePhoto(existing.profileImageUrl || existing.photoURL || '');
  const authPhoto=safePhoto(user.photoURL || '');
  const photo=hasStoredPhotoField ? existingPhoto : authPhoto;

  return {
    fullName,
    displayName:fullName,
    profileImageUrl:photo,
    photoURL:photo,
    updatedAt
  };
}

export function accountCreateHasExactSchema(record={}) {
  const keys=Object.keys(record).sort();
  return keys.length===NEW_ACCOUNT_KEYS.length
    && NEW_ACCOUNT_KEYS.every(key=>keys.includes(key));
}

export { NEW_ACCOUNT_KEYS };
