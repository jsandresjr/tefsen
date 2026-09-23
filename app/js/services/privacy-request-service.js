const PRIVACY_CONTACT = 'support@tefsen.com';

const REQUESTS = Object.freeze({
  deletion:{
    subject:'Tefsen Account Deletion Request',
    intro:'I am requesting permanent deletion of my Tefsen account and associated personal data.'
  },
  access:{
    subject:'Tefsen Personal Data Access Request',
    intro:'I am requesting access to the personal information associated with my Tefsen account.'
  },
  portability:{
    subject:'Tefsen Data Portability Request',
    intro:'I am requesting a portable copy of eligible personal information associated with my Tefsen account.'
  }
});

function clean(value='',max=320){
  return String(value || '').trim().replace(/\s+/g,' ').slice(0,max);
}

export function privacyRequestDefinition(type='deletion'){
  return REQUESTS[type] || REQUESTS.deletion;
}

export function buildPrivacyRequestMailto(type='deletion',{
  email='',
  username='',
  fullName=''
}={}){
  const canonicalType=REQUESTS[type] ? type : 'deletion';
  const definition=privacyRequestDefinition(canonicalType);
  const identity=[
    clean(fullName,80) ? `Name: ${clean(fullName,80)}` : '',
    clean(email,180) ? `Account email: ${clean(email,180)}` : '',
    clean(username,80) ? `Username: @${clean(username,80).replace(/^@/,'')}` : ''
  ].filter(Boolean);

  const body=[
    definition.intro,
    '',
    ...identity,
    '',
    'Please let me know if you need additional information to verify my identity.',
    ...(canonicalType === 'deletion' ? [
      '',
      'I understand that Google Play subscriptions must be cancelled separately in Google Play if I no longer want to be charged.'
    ] : []),
    '',
    'For security, I have not included my password or authentication codes.'
  ].join('\n');

  return `mailto:${PRIVACY_CONTACT}?subject=${encodeURIComponent(definition.subject)}&body=${encodeURIComponent(body)}`;
}

export function privacyRequestSupportAddress(){
  return PRIVACY_CONTACT;
}

export function accountDeletionFacts(){
  return Object.freeze({
    automatic:false,
    requestRequired:true,
    subscriptionCancellationSeparate:true,
    supportAddress:PRIVACY_CONTACT
  });
}
