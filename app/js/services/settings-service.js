const SETTINGS_SCHEMA_VERSION = 1;

const DEFAULTS = Object.freeze({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  theme: 'dark',
  compactFeed: false,
  reducedMotion: false,
  language: 'en',
  region: '',
  timeZone: '',
  notificationOpportunityDeadlines: true,
  notificationJourneyReminders: true,
  notificationCommunityActivity: true
});

function clean(value, max = 100) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function defaultUserSettings({ timeZone = '' } = {}) {
  return { ...DEFAULTS, timeZone: clean(timeZone, 100) };
}

export function normalizeUserSettings(raw = {}, { timeZone = '' } = {}) {
  const fallback = defaultUserSettings({ timeZone });
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    theme: 'dark',
    compactFeed: typeof raw.compactFeed === 'boolean' ? raw.compactFeed : fallback.compactFeed,
    reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : fallback.reducedMotion,
    language: raw.language === 'en' ? 'en' : fallback.language,
    region: clean(raw.region, 80),
    timeZone: clean(raw.timeZone || fallback.timeZone, 100),
    notificationOpportunityDeadlines: typeof raw.notificationOpportunityDeadlines === 'boolean'
      ? raw.notificationOpportunityDeadlines
      : fallback.notificationOpportunityDeadlines,
    notificationJourneyReminders: typeof raw.notificationJourneyReminders === 'boolean'
      ? raw.notificationJourneyReminders
      : fallback.notificationJourneyReminders,
    notificationCommunityActivity: typeof raw.notificationCommunityActivity === 'boolean'
      ? raw.notificationCommunityActivity
      : fallback.notificationCommunityActivity
  };
}

export function settingsCacheKey(userId) {
  return `tefsen_settings_${String(userId || 'guest')}`;
}

export function readSettingsCache(userId, storage = globalThis.localStorage) {
  if (!userId || !storage) return defaultUserSettings();
  try {
    return normalizeUserSettings(JSON.parse(storage.getItem(settingsCacheKey(userId)) || '{}'));
  } catch {
    return defaultUserSettings();
  }
}

export function writeSettingsCache(userId, settings, storage = globalThis.localStorage) {
  const normalized = normalizeUserSettings(settings);
  if (!userId || !storage) return normalized;
  try {
    storage.setItem(settingsCacheKey(userId), JSON.stringify(normalized));
  } catch {
    // Browsers may block storage in private/restricted contexts.
  }
  return normalized;
}

export function authProviderLabel(user = {}) {
  const ids = Array.isArray(user.providerData)
    ? user.providerData.map(item => String(item?.providerId || '').toLowerCase())
    : [];
  if (ids.includes('google.com')) return 'Google';
  if (ids.includes('microsoft.com')) return 'Microsoft';
  if (ids.includes('apple.com')) return 'Apple';
  if (ids.includes('password')) return 'Email and password';
  return user.email ? 'Tefsen account' : 'Account provider unavailable';
}

export function buildSettingsModel({ profile = {}, user = {}, settings = {} } = {}) {
  const normalized = normalizeUserSettings(settings);
  const admin = String(profile.role || '').trim().toLowerCase() === 'admin';
  const subscribed = Boolean(profile.subscriptionActive) && !admin;
  return {
    settings: normalized,
    identity: {
      name: clean(profile.fullName || user.displayName || 'Tefsen User', 80),
      email: clean(user.email || profile.email || '', 180),
      provider: authProviderLabel(user),
      emailVerified: user.emailVerified === true
    },
    plan: {
      label: admin ? 'Admin Full Access' : subscribed ? 'Subscribed Student' : 'Free Student',
      admin,
      subscribed
    },
    privacy: {
      privateItems: [
        'Student Passport',
        'Saved opportunities and application Journeys',
        'Saved Community list',
        'Settings and notification preferences',
        'Authentication and account information'
      ],
      publicItems: [
        'Public profile name, username, bio and profile photo',
        'Community posts or student stories you intentionally publish'
      ]
    }
  };
}

function notificationEnabled(item, settings) {
  if (!item) return false;
  if (item.source === 'activity' || item.category === 'activity') {
    return settings.notificationCommunityActivity;
  }
  if (item.type === 'deadline') {
    return settings.notificationOpportunityDeadlines;
  }
  if (item.type === 'journey' || item.type === 'post_acceptance' || item.category === 'planning') {
    return settings.notificationJourneyReminders;
  }
  return true;
}

export function applyNotificationPreferences(model = {}, rawSettings = {}) {
  const settings = normalizeUserSettings(rawSettings);
  const items = (Array.isArray(model.items) ? model.items : []).filter(item => notificationEnabled(item, settings));
  const unread = items.filter(item => !item.read);
  const attention = items.filter(item => item.category === 'attention');
  const planning = items.filter(item => item.category === 'planning');
  const activity = items.filter(item => item.category === 'activity');
  return {
    ...model,
    items,
    unreadCount: unread.length,
    counts: {
      all: items.length,
      unread: unread.length,
      attention: attention.length,
      planning: planning.length,
      activity: activity.length
    },
    sections: { attention, planning, activity },
    empty: items.length === 0
  };
}

export function applyRuntimeSettings(rawSettings = {}, root = globalThis.document?.documentElement) {
  const settings = normalizeUserSettings(rawSettings);
  if (!root) return settings;
  root.classList.toggle('pref-compact', settings.compactFeed);
  root.classList.toggle('pref-reduced-motion', settings.reducedMotion);
  root.dataset.appearance = 'dark';
  return settings;
}

export { SETTINGS_SCHEMA_VERSION };
