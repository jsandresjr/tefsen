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
    answers: 'answers',
    likes: 'likes',
    savedPosts: 'savedPosts',
    messages: 'messages',
    followers: 'followers',
    following: 'following'
  }
});

export const FIELD_ALIASES = Object.freeze({
  userName: ['fullName', 'displayName', 'name', 'username'],
  userPhoto: ['profileImageUrl', 'profilePhotoUrl', 'profilePictureUrl', 'photoURL', 'photoUrl', 'avatarUrl', 'imageUrl'],
  userRole: ['role', 'accountType', 'studentType'],
  userVerified: ['verified', 'isVerified', 'hasVerifiedBadge', 'isPremiumVerified', 'hasPremiumVerification', 'hasPremiumHSVerification', 'hasPremiumUniversityVerification', 'hasPremiumUniVerification'],
  subscriptionActive: ['subscriptionActive', 'isSubscribed', 'subscribed', 'hasActiveSubscription', 'hasSubscription', 'isPremium', 'premium', 'hasPremium', 'premiumActive', 'isPremiumUser'],
  subscriptionStatus: ['subscriptionStatus', 'planStatus', 'premiumStatus', 'billingStatus'],
  subscriptionPlan: ['subscriptionPlan', 'plan', 'planName', 'premiumPlan', 'tier'],
  subscriptionExpiresAt: ['subscriptionExpiresAt', 'subscriptionExpiry', 'subscriptionEndAt', 'premiumUntil', 'expiresAt', 'expiryDate'],
  postTitle: ['title', 'questionTitle', 'question', 'headline'],
  postBody: ['content', 'description', 'body', 'text'],
  postImage: ['imageUrl', 'imageURL', 'photoUrl', 'mediaUrl'],
  postImages: ['imageUrls', 'images', 'mediaUrls', 'photoUrls'],
  postAuthorId: ['authorId', 'userId', 'uid', 'ownerId', 'authorUid', 'createdById', 'creatorId', 'postedById', 'publisherId'],
  postAuthorName: ['authorName', 'userName', 'displayName', 'fullName'],
  postAuthorPhoto: ['authorPhotoUrl', 'authorImageUrl', 'authorProfileImageUrl', 'userProfileImageUrl', 'profileImageUrl', 'profilePhotoUrl', 'photoURL', 'photoUrl', 'avatarUrl'],
  createdAt: ['createdAt', 'timestamp', 'publishedAt'],
  likeCount: ['likeCount', 'likesCount', 'likes'],
  commentCount: ['answerCount', 'answersCount', 'commentCount', 'commentsCount'],
  saveCount: ['saveCount', 'savedCount']
});
