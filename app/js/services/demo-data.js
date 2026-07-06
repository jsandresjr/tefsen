const now = Date.now();
const ago = (ms) => new Date(now - ms).toISOString();

export const DEMO_USERS = [
  { id: 'demo-kasuni', uid: 'demo-kasuni', fullName: 'Kasuni Mahesha', username: 'kasuni', email: 'kasuni@example.com', bio: 'Physical science student exploring ideas across physics, chemistry and technology.', role: 'University Student', verified: true, points: 2840, followersCount: 318, followingCount: 126 },
  { id: 'demo-amaya', uid: 'demo-amaya', fullName: 'Amaya Fernando', username: 'amaya.f', bio: 'Computer science student and open-source learner.', role: 'University Student', verified: true, points: 2410, followersCount: 224, followingCount: 98 },
  { id: 'demo-nimal', uid: 'demo-nimal', fullName: 'Nimal Perera', username: 'nimal.p', bio: 'A/L science learner. Curious about space and electronics.', role: 'School Student', verified: false, points: 1930, followersCount: 167, followingCount: 83 },
  { id: 'demo-sara', uid: 'demo-sara', fullName: 'Sara Williams', username: 'sara.learns', bio: 'Biology and public health.', role: 'Student', verified: false, points: 1675, followersCount: 145, followingCount: 101 },
  { id: 'demo-admin', uid: 'demo-admin', fullName: 'Tefsen Team', username: 'tefsen', bio: 'Official Tefsen updates and community support.', role: 'Admin', verified: true, points: 4500, followersCount: 1200, followingCount: 22 }
];

export const DEMO_POSTS = [
  {
    id: 'post-1', authorId: 'demo-kasuni', authorName: 'Kasuni Mahesha', title: 'Why does increasing temperature change the equilibrium constant?',
    content: 'I understand Le Chatelier’s principle qualitatively, but I want a clear thermodynamic explanation connecting temperature, ΔH°, and the equilibrium constant. How would you explain this to a first-year student?',
    subject: 'Chemistry', tags: ['equilibrium', 'thermodynamics', 'chemistry'], createdAt: ago(1000 * 60 * 18), likeCount: 128, commentCount: 24, saveCount: 31, trendingScore: 188, role: 'University Student', verified: true
  },
  {
    id: 'post-2', authorId: 'demo-amaya', authorName: 'Amaya Fernando', title: 'A simple way to understand recursion without memorising code',
    content: 'Think of recursion as a problem asking a smaller version of itself for help. The key is not “a function calling itself”; the key is defining the smallest solvable case and guaranteeing progress toward it. What examples helped you understand recursion?',
    subject: 'Computer Science', tags: ['programming', 'recursion', 'learning'], createdAt: ago(1000 * 60 * 62), likeCount: 96, commentCount: 18, saveCount: 42, trendingScore: 176, role: 'University Student', verified: true
  },
  {
    id: 'post-3', authorId: 'demo-nimal', authorName: 'Nimal Perera', title: 'What really happens to current in a series circuit when resistance changes?',
    content: 'I know I = V/R, but I am confused when there are several resistors and one resistance changes. Does current change instantly everywhere in the circuit? I would appreciate an intuitive explanation.',
    subject: 'Physics', tags: ['electricity', 'circuits', 'physics'], createdAt: ago(1000 * 60 * 60 * 4), likeCount: 74, commentCount: 29, saveCount: 15, trendingScore: 142, role: 'School Student', verified: false
  },
  {
    id: 'post-4', authorId: 'demo-sara', authorName: 'Sara Williams', title: 'Study technique: turn each lecture into three questions',
    content: 'After a lecture, I write one “what”, one “why”, and one “how would this change if…” question. It forces retrieval and reveals gaps much faster than rereading notes. Sharing in case it helps someone this week.',
    subject: 'Study Skills', tags: ['study', 'productivity', 'students'], createdAt: ago(1000 * 60 * 60 * 8), likeCount: 211, commentCount: 36, saveCount: 88, trendingScore: 260, role: 'Student', verified: false
  },
  {
    id: 'post-5', authorId: 'demo-admin', authorName: 'Tefsen Team', title: 'Welcome to a community built around useful knowledge',
    content: 'Ask thoughtful questions, share what you learn, credit your sources, and help keep discussions respectful. Tefsen grows when every contribution makes the next learner’s path a little easier.',
    subject: 'Tefsen', tags: ['community', 'welcome'], createdAt: ago(1000 * 60 * 60 * 22), likeCount: 324, commentCount: 51, saveCount: 60, trendingScore: 330, role: 'Admin', verified: true
  }
];

export const DEMO_COMMENTS = {
  'post-1': [
    { id: 'c1', authorId: 'demo-amaya', authorName: 'Amaya Fernando', role: 'University Student', verified: true, content: 'A useful bridge is the van ’t Hoff equation: the sign of ΔH° tells you how ln K changes with 1/T. For an endothermic reaction, raising T generally increases K.', createdAt: ago(1000 * 60 * 9), likeCount: 17 },
    { id: 'c2', authorId: 'demo-sara', authorName: 'Sara Williams', role: 'Student', verified: false, content: 'I also like to distinguish “equilibrium shifts” from “K changes”. Concentration changes can shift Q relative to K without changing K; temperature is different because it changes K itself.', createdAt: ago(1000 * 60 * 4), likeCount: 11 }
  ],
  'post-2': [{ id: 'c3', authorId: 'demo-kasuni', authorName: 'Kasuni Mahesha', role: 'University Student', verified: true, content: 'The folder-inside-folder analogy helped me, but the “guaranteed progress toward a base case” wording is much more precise.', createdAt: ago(1000 * 60 * 26), likeCount: 8 }]
};

export const DEMO_NOTIFICATIONS = [
  { id: 'n1', recipientId: 'demo-kasuni', type: 'answer', actorName: 'Amaya Fernando', text: 'answered your chemistry question', createdAt: ago(1000 * 60 * 9), read: false, postId: 'post-1' },
  { id: 'n2', recipientId: 'demo-kasuni', type: 'like', actorName: 'Nimal Perera', text: 'liked your question', createdAt: ago(1000 * 60 * 45), read: false, postId: 'post-1' },
  { id: 'n3', recipientId: 'demo-kasuni', type: 'system', actorName: 'Tefsen', text: 'Your profile is ready for the community', createdAt: ago(1000 * 60 * 60 * 7), read: true }
];

export const DEMO_CONVERSATIONS = [
  { id: 'conv-1', participants: ['demo-kasuni', 'demo-amaya'], title: 'Amaya Fernando', otherUserId: 'demo-amaya', lastMessage: 'That source explains it really well.', updatedAt: ago(1000 * 60 * 12) },
  { id: 'conv-2', participants: ['demo-kasuni', 'demo-nimal'], title: 'Nimal Perera', otherUserId: 'demo-nimal', lastMessage: 'Thanks! I will try the circuit example.', updatedAt: ago(1000 * 60 * 60 * 3) }
];

export const DEMO_MESSAGES = {
  'conv-1': [
    { id: 'm1', senderId: 'demo-amaya', text: 'Did you see the thermodynamics note I sent?', createdAt: ago(1000 * 60 * 25) },
    { id: 'm2', senderId: 'demo-kasuni', text: 'Yes, the van ’t Hoff part was exactly what I needed.', createdAt: ago(1000 * 60 * 20) },
    { id: 'm3', senderId: 'demo-amaya', text: 'That source explains it really well.', createdAt: ago(1000 * 60 * 12) }
  ],
  'conv-2': [
    { id: 'm4', senderId: 'demo-kasuni', text: 'Try drawing the same current path before applying Ohm’s law.', createdAt: ago(1000 * 60 * 60 * 3.4) },
    { id: 'm5', senderId: 'demo-nimal', text: 'Thanks! I will try the circuit example.', createdAt: ago(1000 * 60 * 60 * 3) }
  ]
};
