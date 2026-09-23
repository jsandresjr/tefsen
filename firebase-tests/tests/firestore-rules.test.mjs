import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  buildNewAccountDocument,
  buildExistingAccountProfilePatch
} from '../../app/js/services/account-bootstrap-service.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tefsen-web-v1',
    firestore: {
      rules: await readFile(new URL('../firestore.web-v1.test.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8088
    }
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'user-a'), {
      uid:'user-a',
      email:'private-a@example.test',
      fullName:'Amina Rahman',
      displayName:'Amina Rahman',
      username:'amina',
      bio:'Student',
      role:'student',
      verified:false,
      subscriptionActive:true,
      profileImageUrl:'',
      photoURL:''
    });
    await setDoc(doc(db, 'users', 'user-b'), {
      uid:'user-b',
      email:'private-b@example.test',
      fullName:'Daniel Lee',
      displayName:'Daniel Lee',
      username:'daniel',
      bio:'Student',
      role:'student',
      verified:false,
      subscriptionActive:false,
      profileImageUrl:'',
      photoURL:''
    });
    await setDoc(doc(db, 'public_profiles', 'user-a'), {
      uid:'user-a',
      schemaVersion:1,
      fullName:'Amina Rahman',
      username:'amina',
      bio:'Student',
      profileImageUrl:'',
      photoURL:'',
      updatedAt:123
    });
    await setDoc(doc(db, 'opportunities', 'public-opportunity'), {
      title: 'Public scholarship',
      status: 'published',
      visibility: 'public',
      verificationStatus: 'verified'
    });
    await setDoc(doc(db, 'opportunities', 'draft-opportunity'), {
      title: 'Draft scholarship',
      status: 'draft',
      visibility: 'private',
      verificationStatus: 'pending'
    });
    await setDoc(doc(db, 'notifications', 'canonical-a'), {
      userId:'user-a',
      type:'reply',
      text:'A reply for user A',
      read:false,
      isRead:false,
      createdAtMillis:300
    });
    await setDoc(doc(db, 'notifications', 'legacy-a'), {
      recipientId:'user-a',
      type:'like',
      text:'A legacy notification for user A',
      read:false,
      isRead:false,
      createdAtMillis:200
    });
    await setDoc(doc(db, 'notifications', 'canonical-b'), {
      userId:'user-b',
      type:'reply',
      text:'A reply for user B',
      read:false,
      isRead:false,
      createdAtMillis:100
    });
    await setDoc(doc(db, 'posts', 'public-post'), {
      title:'Public Community post',
      content:'Public content for moderation testing',
      authorId:'author-a',
      status:'published',
      visibility:'public'
    });
    await setDoc(doc(db, 'posts', 'private-post'), {
      title:'Private post',
      content:'Not reportable through public Community',
      authorId:'author-b',
      status:'hidden',
      visibility:'private'
    });
    await setDoc(doc(db, 'support_requests', 'legacy-report'), {
      type:'post_report',
      status:'open',
      requesterId:'user-a',
      userId:'user-a',
      postId:'public-post',
      reason:'Spam',
      details:'Legacy moderation item'
    });
  });
});

test('Private user account document is readable only by its owner or admin', async () => {
  const owner=env.authenticatedContext('user-a').firestore();
  const other=env.authenticatedContext('user-b').firestore();
  const anon=env.unauthenticatedContext().firestore();
  const admin=env.authenticatedContext('admin-user',{admin:true}).firestore();

  await assertSucceeds(getDoc(doc(owner,'users','user-a')));
  await assertSucceeds(getDoc(doc(admin,'users','user-a')));
  await assertFails(getDoc(doc(other,'users','user-a')));
  await assertFails(getDoc(doc(anon,'users','user-a')));

  await assertSucceeds(updateDoc(doc(owner,'users','user-a'),{
    fullName:'Amina Updated',
    displayName:'Amina Updated',
    username:'amina.updated',
    bio:'Updated public identity',
    updatedAt:456
  }));
  await assertFails(updateDoc(doc(owner,'users','user-a'),{ role:'ADMIN' }));
  await assertFails(updateDoc(doc(owner,'users','user-a'),{ subscriptionActive:false }));
  await assertFails(updateDoc(doc(other,'users','user-a'),{ bio:'tampered' }));
  await assertFails(deleteDoc(doc(owner,'users','user-a')));
});

test('Owner account creation cannot seed privileged or subscription fields', async () => {
  const owner=env.authenticatedContext('user-c').firestore();
  const adminAttempt=env.authenticatedContext('user-d').firestore();
  const subscriptionAttempt=env.authenticatedContext('user-e').firestore();
  const valid={
    uid:'user-c',
    email:'user-c@example.test',
    fullName:'New Student',
    displayName:'New Student',
    username:'',
    bio:'',
    role:'student',
    profileImageUrl:'',
    photoURL:'',
    verified:false,
    createdAt:123,
    updatedAt:123
  };
  await assertSucceeds(setDoc(doc(owner,'users','user-c'),valid));
  await assertFails(setDoc(doc(owner,'users','user-d'),{...valid,uid:'user-d'}));
  await assertFails(setDoc(doc(adminAttempt,'users','user-d'),{
    ...valid,
    uid:'user-d',
    email:'user-d@example.test',
    role:'ADMIN'
  }));
  await assertFails(setDoc(doc(subscriptionAttempt,'users','user-e'),{
    ...valid,
    uid:'user-e',
    email:'user-e@example.test',
    subscriptionActive:true
  }));
});

test('Production auth bootstrap payload matches strict owner account rules', async () => {
  const owner=env.authenticatedContext('bootstrap-user').firestore();
  const created=buildNewAccountDocument({
    uid:'bootstrap-user',
    email:'bootstrap@example.test',
    displayName:'Bootstrap Student',
    photoURL:'https://example.test/bootstrap.jpg'
  },{createdAt:123,updatedAt:123});

  await assertSucceeds(setDoc(doc(owner,'users','bootstrap-user'),created));

  const patch=buildExistingAccountProfilePatch({
    uid:'bootstrap-user',
    email:'changed-auth-email@example.test',
    displayName:'Provider Name',
    photoURL:'https://example.test/provider.jpg'
  },created,{updatedAt:456});

  await assertSucceeds(updateDoc(doc(owner,'users','bootstrap-user'),patch));
  await assertFails(updateDoc(doc(owner,'users','bootstrap-user'),{email:'changed-auth-email@example.test'}));
  await assertFails(updateDoc(doc(owner,'users','bootstrap-user'),{role:'ADMIN'}));
  await assertFails(updateDoc(doc(owner,'users','bootstrap-user'),{verified:true}));
});

test('Public profile exposes only the dedicated safe public record', async () => {
  const owner=env.authenticatedContext('user-a').firestore();
  const other=env.authenticatedContext('user-b').firestore();
  const anon=env.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(owner,'public_profiles','user-a')));
  await assertSucceeds(getDoc(doc(other,'public_profiles','user-a')));
  await assertSucceeds(getDoc(doc(anon,'public_profiles','user-a')));

  const valid={
    uid:'user-b',
    schemaVersion:1,
    fullName:'Daniel Lee',
    username:'daniel',
    bio:'Physics student',
    profileImageUrl:'',
    photoURL:'',
    updatedAt:123
  };
  await assertSucceeds(setDoc(doc(other,'public_profiles','user-b'),valid));
  await assertFails(setDoc(doc(owner,'public_profiles','user-b'),valid));
  await assertFails(setDoc(doc(owner,'public_profiles','user-a'),{
    uid:'user-a',
    schemaVersion:1,
    fullName:'Amina Rahman',
    username:'amina',
    bio:'Student',
    profileImageUrl:'',
    photoURL:'',
    email:'private-a@example.test',
    updatedAt:123
  }));
  await assertFails(updateDoc(doc(owner,'public_profiles','user-a'),{ role:'ADMIN' }));
  await assertFails(updateDoc(doc(owner,'public_profiles','user-a'),{ verified:true }));
  await assertFails(updateDoc(doc(owner,'public_profiles','user-a'),{ subscriptionPlan:'Premium' }));
  await assertFails(deleteDoc(doc(owner,'public_profiles','user-a')));
});

test('Students can create only self-authored public Web posts with zero client counters', async () => {
  const owner=env.authenticatedContext('user-a').firestore();
  const other=env.authenticatedContext('user-b').firestore();
  const valid={
    title:'Need scholarship advice',
    questionTitle:'Need scholarship advice',
    content:'How should I prepare my documents?',
    description:'How should I prepare my documents?',
    subject:'General',
    tags:[],
    postType:'discussion',
    successData:{},
    publicMilestones:[],
    communityUniversity:'',
    communityIntake:'',
    communitySubject:'General',
    imageUrl:'',
    imageUrls:[],
    imageCount:0,
    totalImageBytes:0,
    authorId:'user-a',
    firebaseUid:'user-a',
    userId:'user-a',
    authorName:'Amina Rahman',
    authorPhotoUrl:'',
    type:'question',
    status:'published',
    visibility:'public',
    sourcePlatform:'web',
    webPost:true,
    likeCount:0,
    commentCount:0,
    answerCount:0,
    saveCount:0,
    createdAt:123,
    updatedAt:123
  };

  await assertSucceeds(setDoc(doc(owner,'posts','user-a-post'),valid));
  await assertFails(setDoc(doc(other,'posts','forged-post'),{...valid}));
  await assertFails(setDoc(doc(owner,'posts','spoofed-author'),{...valid,authorName:'Someone Else'}));
  await assertFails(setDoc(doc(owner,'posts','spoofed-role'),{...valid,authorRole:'ADMIN'}));
  await assertFails(setDoc(doc(owner,'posts','spoofed-verification'),{...valid,verified:true}));
  await assertFails(setDoc(doc(owner,'posts','spoofed-plan'),{...valid,webPlan:'subscribed'}));
  await assertFails(setDoc(doc(owner,'posts','spoofed-counter'),{...valid,likeCount:99}));
  await assertFails(updateDoc(doc(owner,'posts','user-a-post'),{likeCount:500}));
  await assertSucceeds(deleteDoc(doc(owner,'posts','user-a-post')));
});

test('Post likes are private to the liking account and cannot rewrite parent counters', async () => {
  const owner=env.authenticatedContext('user-a').firestore();
  const other=env.authenticatedContext('user-b').firestore();
  const anon=env.unauthenticatedContext().firestore();
  const likeRef=doc(owner,'posts','public-post','likes','user-a');
  const valid={uid:'user-a',userId:'user-a',postId:'public-post',createdAt:123};

  await assertSucceeds(setDoc(likeRef,valid));
  await assertSucceeds(getDoc(likeRef));
  await assertFails(getDoc(doc(other,'posts','public-post','likes','user-a')));
  await assertFails(getDoc(doc(anon,'posts','public-post','likes','user-a')));
  await assertFails(getDocs(collection(owner,'posts','public-post','likes')));
  await assertFails(setDoc(doc(other,'posts','public-post','likes','user-a'),valid));
  await assertFails(setDoc(doc(owner,'posts','public-post','likes','user-a-2'),{...valid,uid:'user-a-2',userId:'user-a-2'}));
  await assertFails(updateDoc(likeRef,{postId:'private-post'}));
  await assertFails(updateDoc(doc(owner,'posts','public-post'),{likeCount:999}));
  await assertSucceeds(deleteDoc(likeRef));
});

test('Public answers require authenticated self-authorship and cannot claim trust metadata', async () => {
  const owner=env.authenticatedContext('user-a').firestore();
  const other=env.authenticatedContext('user-b').firestore();
  const anon=env.unauthenticatedContext().firestore();
  const answerRef=doc(owner,'posts','public-post','answers','answer-a');
  const valid={
    id:'answer-a',
    postId:'public-post',
    questionId:'public-post',
    parentPostId:'public-post',
    authorId:'user-a',
    firebaseUid:'user-a',
    userId:'user-a',
    uid:'user-a',
    authorName:'Amina Rahman',
    authorPhotoUrl:'',
    profileImageUrl:'',
    content:'Prepare the official documents early.',
    text:'Prepare the official documents early.',
    answer:'Prepare the official documents early.',
    reply:'Prepare the official documents early.',
    type:'answer',
    status:'published',
    visibility:'public',
    sourcePlatform:'web',
    likeCount:0,
    createdAtMillis:123,
    createdAt:123,
    updatedAt:123
  };

  await assertSucceeds(setDoc(answerRef,valid));
  await assertSucceeds(getDoc(doc(anon,'posts','public-post','answers','answer-a')));
  await assertFails(setDoc(doc(other,'posts','public-post','answers','answer-b'),{...valid,id:'answer-b'}));
  await assertFails(setDoc(doc(owner,'posts','public-post','answers','answer-c'),{...valid,id:'answer-c',authorName:'Impersonated'}));
  await assertFails(setDoc(doc(owner,'posts','public-post','answers','answer-d'),{...valid,id:'answer-d',authorVerified:true}));
  await assertFails(setDoc(doc(owner,'posts','public-post','answers','answer-e'),{...valid,id:'answer-e',likeCount:7}));
  await assertFails(setDoc(doc(owner,'posts','private-post','answers','answer-f'),{
    ...valid,
    id:'answer-f',
    postId:'private-post',
    questionId:'private-post',
    parentPostId:'private-post'
  }));
  await assertFails(updateDoc(answerRef,{content:'edited'}));
  await assertSucceeds(deleteDoc(answerRef));
});

test('Student Passport is owner-only', async () => {
  const owner = env.authenticatedContext('user-a').firestore();
  const other = env.authenticatedContext('user-b').firestore();
  const anon = env.unauthenticatedContext().firestore();
  const ref = doc(owner, 'student_passports', 'user-a');

  await assertSucceeds(setDoc(ref, { nationality: 'Example', privacy: 'private' }));
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(other, 'student_passports', 'user-a')));
  await assertFails(getDoc(doc(anon, 'student_passports', 'user-a')));
  await assertFails(setDoc(doc(other, 'student_passports', 'user-a'), { nationality: 'Tampered' }));
});

test('Application Journey is owner-only', async () => {
  const owner = env.authenticatedContext('user-a').firestore();
  const other = env.authenticatedContext('user-b').firestore();
  const ref = doc(owner, 'journeys', 'user-a', 'opportunities', 'opp-1');

  await assertSucceeds(setDoc(ref, {
    saved: true,
    started: true,
    status: 'preparing',
    notes: 'private'
  }));
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(other, 'journeys', 'user-a', 'opportunities', 'opp-1')));
  await assertFails(setDoc(doc(other, 'journeys', 'user-a', 'opportunities', 'opp-1'), { status: 'accepted' }));
  await assertFails(deleteDoc(doc(other, 'journeys', 'user-a', 'opportunities', 'opp-1')));
  await assertSucceeds(deleteDoc(ref));
});

test('Saved Community posts are owner-only and cannot spoof identity', async () => {
  const owner = env.authenticatedContext('user-a').firestore();
  const other = env.authenticatedContext('user-b').firestore();
  const anon = env.unauthenticatedContext().firestore();
  const ref = doc(owner, 'users', 'user-a', 'savedPosts', 'post-1');

  await assertSucceeds(setDoc(ref, {
    uid:'user-a',
    userId:'user-a',
    postId:'post-1',
    savedAtMillis:123
  }));
  await assertSucceeds(getDoc(ref));
  const ownerList=await assertSucceeds(getDocs(collection(owner,'users','user-a','savedPosts')));
  assert.equal(ownerList.size,1);
  await assertFails(getDocs(collection(other,'users','user-a','savedPosts')));
  await assertFails(getDoc(doc(other, 'users', 'user-a', 'savedPosts', 'post-1')));
  await assertFails(getDoc(doc(anon, 'users', 'user-a', 'savedPosts', 'post-1')));
  await assertFails(setDoc(doc(other, 'users', 'user-a', 'savedPosts', 'post-2'), {
    uid:'user-a',
    userId:'user-a',
    postId:'post-2'
  }));
  await assertFails(setDoc(doc(owner, 'users', 'user-a', 'savedPosts', 'post-2'), {
    uid:'user-b',
    userId:'user-b',
    postId:'post-2'
  }));
  await assertSucceeds(deleteDoc(ref));
});

test('Settings preferences are owner-only, validated, and cannot spoof identity', async () => {
  const owner = env.authenticatedContext('user-a').firestore();
  const other = env.authenticatedContext('user-b').firestore();
  const anon = env.unauthenticatedContext().firestore();
  const ref = doc(owner, 'users', 'user-a', 'settings', 'preferences');
  const valid = {
    uid:'user-a',
    userId:'user-a',
    documentType:'preferences',
    schemaVersion:1,
    theme:'dark',
    compactFeed:false,
    reducedMotion:true,
    language:'en',
    region:'Sri Lanka',
    timeZone:'Asia/Colombo',
    notificationOpportunityDeadlines:true,
    notificationJourneyReminders:true,
    notificationCommunityActivity:false,
    updatedAt:123
  };

  await assertSucceeds(setDoc(ref, valid));
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(other, 'users', 'user-a', 'settings', 'preferences')));
  await assertFails(getDoc(doc(anon, 'users', 'user-a', 'settings', 'preferences')));
  await assertFails(setDoc(doc(other, 'users', 'user-a', 'settings', 'preferences'), valid));
  await assertFails(setDoc(ref, { ...valid, uid:'user-b', userId:'user-b' }));
  await assertFails(setDoc(ref, { ...valid, theme:'light' }));
  await assertFails(setDoc(ref, { ...valid, unexpectedField:true }));
  await assertSucceeds(updateDoc(ref, { region:'Canada', timeZone:'America/Toronto' }));
  await assertSucceeds(deleteDoc(ref));
});

test('Notification read state is private to the authenticated owner', async () => {
  const owner = env.authenticatedContext('user-a').firestore();
  const other = env.authenticatedContext('user-b').firestore();
  const anon = env.unauthenticatedContext().firestore();
  const ref = doc(owner, 'users', 'user-a', 'notificationState', 'read');
  const valid = {
    uid:'user-a',
    userId:'user-a',
    documentType:'notification_read_state',
    schemaVersion:1,
    readIds:['activity:canonical-a','deadline:opp-1:2026-10-01:soon'],
    updatedAt:123
  };

  await assertSucceeds(setDoc(ref, valid));
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(other, 'users', 'user-a', 'notificationState', 'read')));
  await assertFails(getDoc(doc(anon, 'users', 'user-a', 'notificationState', 'read')));
  await assertFails(setDoc(doc(other, 'users', 'user-a', 'notificationState', 'read'), valid));
  await assertFails(setDoc(ref, { ...valid, uid:'user-b', userId:'user-b' }));
  await assertFails(setDoc(ref, { ...valid, readIds:Array.from({length:601},(_,i)=>`id-${i}`) }));
  await assertFails(setDoc(ref, { ...valid, extra:true }));
  await assertSucceeds(updateDoc(ref, { readIds:['activity:canonical-a'] }));
  await assertSucceeds(deleteDoc(ref));
});

test('Activity notifications are readable only by their canonical or legacy recipient', async () => {
  const owner = env.authenticatedContext('user-a').firestore();
  const other = env.authenticatedContext('user-b').firestore();
  const anon = env.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(owner, 'notifications', 'canonical-a')));
  await assertSucceeds(getDoc(doc(owner, 'notifications', 'legacy-a')));
  await assertFails(getDoc(doc(other, 'notifications', 'canonical-a')));
  await assertFails(getDoc(doc(anon, 'notifications', 'canonical-a')));

  const canonical = await assertSucceeds(getDocs(query(
    collection(owner, 'notifications'),
    where('userId', '==', 'user-a')
  )));
  assert.equal(canonical.size, 1);

  const legacy = await assertSucceeds(getDocs(query(
    collection(owner, 'notifications'),
    where('recipientId', '==', 'user-a')
  )));
  assert.equal(legacy.size, 1);

  await assertFails(getDocs(query(
    collection(other, 'notifications'),
    where('userId', '==', 'user-a')
  )));
});

test('Notification recipients can only acknowledge existing activity records', async () => {
  const owner = env.authenticatedContext('user-a').firestore();
  const other = env.authenticatedContext('user-b').firestore();
  const ref = doc(owner, 'notifications', 'canonical-a');

  await assertSucceeds(updateDoc(ref, {
    read:true,
    isRead:true,
    readAt:456,
    updatedAt:456
  }));
  await assertFails(updateDoc(ref, { text:'tampered' }));
  await assertFails(updateDoc(ref, { userId:'user-b' }));
  await assertFails(updateDoc(doc(other, 'notifications', 'canonical-a'), { read:true }));
  await assertFails(setDoc(doc(owner, 'notifications', 'forged'), {
    userId:'user-a',
    type:'reply',
    read:false
  }));
  await assertFails(deleteDoc(ref));
});

test('Students can submit a valid private report only as themselves for public content', async () => {
  const user = env.authenticatedContext('user-a').firestore();
  const other = env.authenticatedContext('user-b').firestore();
  const anon = env.unauthenticatedContext().firestore();
  const reportRef = doc(user, 'reports', 'report-a');
  const valid = {
    targetType:'post',
    postId:'public-post',
    targetTitle:'Public Community post',
    targetAuthorId:'author-a',
    targetExcerpt:'Public content for moderation testing',
    reporterUid:'user-a',
    userId:'user-a',
    reason:'Spam',
    details:'Repeated promotional links',
    status:'open',
    sourcePlatform:'web',
    createdAtMillis:123,
    createdAt:123,
    updatedAt:123
  };

  await assertSucceeds(setDoc(reportRef, valid));
  await assertFails(getDoc(reportRef));
  await assertFails(getDoc(doc(other, 'reports', 'report-a')));
  await assertFails(getDoc(doc(anon, 'reports', 'report-a')));
  await assertFails(setDoc(doc(other, 'reports', 'forged-owner'), { ...valid, reporterUid:'user-a', userId:'user-a' }));
  await assertFails(setDoc(doc(user, 'reports', 'forged-private'), { ...valid, postId:'private-post' }));
  await assertFails(setDoc(doc(user, 'reports', 'bad-reason'), { ...valid, reason:'I disagree' }));
  await assertFails(setDoc(doc(user, 'reports', 'extra-field'), { ...valid, adminApproved:true }));
});

test('Only admin can read and resolve canonical or legacy reports', async () => {
  const user = env.authenticatedContext('user-a').firestore();
  const admin = env.authenticatedContext('admin-user', { admin:true }).firestore();

  const reportRef = doc(admin, 'reports', 'report-a');
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'reports', 'report-a'), {
      targetType:'post',
      postId:'public-post',
      targetTitle:'Public Community post',
      targetAuthorId:'author-a',
      targetExcerpt:'Public content',
      reporterUid:'user-a',
      userId:'user-a',
      reason:'Spam',
      details:'',
      status:'open',
      sourcePlatform:'web',
      createdAtMillis:123,
      createdAt:123,
      updatedAt:123
    });
  });

  await assertSucceeds(getDoc(reportRef));
  await assertFails(updateDoc(doc(user, 'reports', 'report-a'), { status:'dismissed' }));
  await assertSucceeds(updateDoc(reportRef, {
    status:'resolved',
    resolution:'reviewed_no_hide',
    reviewedAt:456,
    reviewedByAdminUid:'admin-user',
    updatedAt:456
  }));
  await assertFails(updateDoc(reportRef, { reporterUid:'admin-user' }));
  await assertFails(deleteDoc(reportRef));

  await assertSucceeds(getDoc(doc(admin, 'support_requests', 'legacy-report')));
  await assertFails(getDoc(doc(user, 'support_requests', 'legacy-report')));
  await assertSucceeds(updateDoc(doc(admin, 'support_requests', 'legacy-report'), {
    status:'dismissed',
    resolution:'no_action',
    reviewedAt:456,
    reviewedByAdminUid:'admin-user',
    updatedAt:456
  }));
});

test('Admin can hide a reported public post but ordinary users cannot modify moderation fields', async () => {
  const user = env.authenticatedContext('user-a').firestore();
  const admin = env.authenticatedContext('admin-user', { admin:true }).firestore();

  await assertSucceeds(getDoc(doc(user,'posts','public-post')));
  await assertFails(getDoc(doc(user,'posts','private-post')));
  await assertFails(updateDoc(doc(user,'posts','public-post'), { status:'hidden', visibility:'private' }));

  await assertSucceeds(updateDoc(doc(admin,'posts','public-post'), {
    status:'hidden',
    visibility:'private',
    moderationStatus:'hidden',
    moderatedAt:456,
    moderatedByAdminUid:'admin-user',
    updatedAt:456
  }));

  await assertFails(getDoc(doc(user,'posts','public-post')));
  await assertSucceeds(getDoc(doc(admin,'posts','public-post')));
});

test('Moderation audit is admin-only and immutable', async () => {
  const user = env.authenticatedContext('user-a').firestore();
  const admin = env.authenticatedContext('admin-user', { admin:true }).firestore();
  const ref = doc(admin,'moderation_audit','audit-1');

  await assertSucceeds(setDoc(ref,{
    action:'hide_reported_post',
    reportId:'report-a',
    reportSource:'reports',
    postId:'public-post',
    adminUid:'admin-user',
    reason:'Spam',
    createdAt:123
  }));
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(user,'moderation_audit','audit-1')));
  await assertFails(setDoc(doc(user,'moderation_audit','audit-2'),{
    action:'resolve_report',
    reportId:'report-a',
    reportSource:'reports',
    postId:'public-post',
    adminUid:'user-a',
    reason:'Spam',
    createdAt:123
  }));
  await assertFails(updateDoc(ref,{ action:'dismiss_report' }));
  await assertFails(deleteDoc(ref));
});

test('Ordinary users can read only published public opportunities', async () => {
  const userDb = env.authenticatedContext('user-a').firestore();
  const anonDb = env.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(userDb, 'opportunities', 'public-opportunity')));
  await assertSucceeds(getDoc(doc(anonDb, 'opportunities', 'public-opportunity')));
  await assertFails(getDoc(doc(userDb, 'opportunities', 'draft-opportunity')));
  await assertFails(getDoc(doc(anonDb, 'opportunities', 'draft-opportunity')));
});

test('Public opportunity query must constrain status and visibility', async () => {
  const db = env.authenticatedContext('user-a').firestore();

  const safeQuery = query(
    collection(db, 'opportunities'),
    where('status', '==', 'published'),
    where('visibility', '==', 'public')
  );
  const result = await assertSucceeds(getDocs(safeQuery));
  assert.equal(result.size, 1);

  await assertFails(getDocs(collection(db, 'opportunities')));
});

test('Ordinary users cannot create or modify opportunities', async () => {
  const db = env.authenticatedContext('user-a').firestore();
  await assertFails(setDoc(doc(db, 'opportunities', 'user-created'), {
    title: 'Forged scholarship',
    status: 'published',
    visibility: 'public',
    verificationStatus: 'verified'
  }));
  await assertFails(updateDoc(doc(db, 'opportunities', 'public-opportunity'), {
    verificationStatus: 'pending'
  }));
});

test('Admin custom claim can manage and read private opportunities', async () => {
  const adminDb = env.authenticatedContext('admin-user', { admin: true }).firestore();

  await assertSucceeds(getDoc(doc(adminDb, 'opportunities', 'draft-opportunity')));
  await assertSucceeds(setDoc(doc(adminDb, 'opportunities', 'admin-created'), {
    title: 'Admin-created draft',
    status: 'draft',
    visibility: 'private',
    verificationStatus: 'pending'
  }));
  await assertSucceeds(updateDoc(doc(adminDb, 'opportunities', 'admin-created'), {
    status: 'published',
    visibility: 'public',
    verificationStatus: 'verified'
  }));
});

test('ADMIN role claim also grants admin access', async () => {
  const adminDb = env.authenticatedContext('role-admin', { role: 'ADMIN' }).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'opportunities', 'draft-opportunity')));
});

test('Opportunity audit is admin-only and immutable', async () => {
  const adminDb = env.authenticatedContext('admin-user', { admin: true }).firestore();
  const userDb = env.authenticatedContext('user-a').firestore();
  const auditRef = doc(adminDb, 'opportunity_audit', 'audit-1');

  await assertSucceeds(setDoc(auditRef, {
    action: 'verify',
    opportunityId: 'public-opportunity',
    adminUid: 'admin-user'
  }));
  await assertSucceeds(getDoc(auditRef));
  await assertFails(getDoc(doc(userDb, 'opportunity_audit', 'audit-1')));
  await assertFails(setDoc(doc(userDb, 'opportunity_audit', 'audit-2'), { action: 'verify' }));
  await assertFails(updateDoc(auditRef, { action: 'changed' }));
  await assertFails(deleteDoc(auditRef));
});
