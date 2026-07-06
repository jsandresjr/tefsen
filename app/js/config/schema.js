/**
 * Central Firestore mapping. Change names here only when your Android app uses
 * different collection names. The UI and services read from this mapping.
 */
export const SCHEMA = Object.freeze({
  collections: {
    users: 'users',
    posts: 'posts',
    notifications: 'notifications',
    conversations: 'conversations',
    reports: 'reports'
  },
  subcollections: {
    comments: 'comments',
    likes: 'likes',
    savedPosts: 'savedPosts',
    messages: 'messages'
  }
});

export const FIELD_ALIASES = Object.freeze({
  userName: ['fullName', 'displayName', 'name', 'username'],
  userPhoto: ['profileImageUrl', 'photoURL', 'photoUrl', 'avatarUrl'],
  userRole: ['role', 'accountType', 'studentType'],
  userVerified: ['verified', 'isVerified', 'hasVerifiedBadge'],
  postTitle: ['title', 'questionTitle', 'question', 'headline'],
  postBody: ['content', 'description', 'body', 'text'],
  postImage: ['imageUrl', 'imageURL', 'photoUrl', 'mediaUrl'],
  postAuthorId: ['authorId', 'userId', 'uid', 'ownerId'],
  postAuthorName: ['authorName', 'userName', 'displayName', 'fullName'],
  postAuthorPhoto: ['authorPhotoUrl', 'authorImageUrl', 'profileImageUrl', 'photoURL'],
  createdAt: ['createdAt', 'timestamp', 'publishedAt'],
  likeCount: ['likeCount', 'likesCount', 'likes'],
  commentCount: ['commentCount', 'commentsCount', 'answerCount', 'answersCount'],
  saveCount: ['saveCount', 'savedCount']
});
