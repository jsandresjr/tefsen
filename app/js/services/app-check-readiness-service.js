export function normalizeAppCheckSiteKey(value='') {
  const key=String(value || '').trim();
  if (!key || key.includes('PASTE_')) return '';
  return key.slice(0,300);
}

export function buildAppCheckReadiness({
  mode='demo',
  siteKey='',
  initialized=false
}={}) {
  const configured=Boolean(normalizeAppCheckSiteKey(siteKey));
  if (mode !== 'firebase') {
    return {
      mode,
      configured,
      initialized:false,
      readyForEnforcement:false,
      state:'not-applicable',
      label:'Firebase not active',
      detail:'App Check becomes relevant when Tefsen Web is using Firebase.'
    };
  }

  if (!configured) {
    return {
      mode,
      configured:false,
      initialized:false,
      readyForEnforcement:false,
      state:'missing-key',
      label:'App Check key missing',
      detail:'Configure the Web App Check site key before validating traffic or enabling enforcement.'
    };
  }

  if (!initialized) {
    return {
      mode,
      configured:true,
      initialized:false,
      readyForEnforcement:false,
      state:'initialization-failed',
      label:'App Check not initialized',
      detail:'A site key is configured, but the current Web session did not initialize App Check.'
    };
  }

  return {
    mode,
    configured:true,
    initialized:true,
    readyForEnforcement:false,
    state:'client-ready',
    label:'App Check client initialized',
    detail:'Client initialization is ready for traffic validation. Enforcement must still be verified and enabled service-by-service in Firebase Console.'
  };
}
