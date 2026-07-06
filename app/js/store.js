const listeners = new Set();

export const state = {
  initialized: false,
  mode: 'demo',
  user: null,
  profile: null,
  posts: [],
  notifications: [],
  conversations: [],
  selectedConversation: null,
  messages: [],
  leaderboard: [],
  activeFeedTab: 'latest',
  searchQuery: '',
  busy: false,
  unreadCount: 0,
  ui: { profileMenu: false }
};

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
