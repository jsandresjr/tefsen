import { db } from '../firebase-client.js';
import { SCHEMA } from '../config/schema.js';
import { getAdminCapability } from './opportunity-admin-service.js';
import {
  validatePostReportDraft,
  normalizeModerationReport,
  moderationActionCopy
} from './moderation-model.js';
import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp,
  setDoc, where, writeBatch
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const C = SCHEMA.collections;
const SUPPORT_REQUESTS = C.supportRequests || 'support_requests';
const MODERATION_AUDIT = C.moderationAudit || 'moderation_audit';

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function publicPostSnapshot(raw = {}, id = '') {
  if (!raw || String(raw.status || '').toLowerCase() !== 'published' || String(raw.visibility || '').toLowerCase() !== 'public') {
    return null;
  }
  const title = clean(raw.title || raw.questionTitle || raw.headline || 'Community post', 180);
  const content = clean(raw.content || raw.description || raw.body || raw.text, 300);
  return {
    postId:clean(id,180),
    targetTitle:title,
    targetAuthorId:clean(raw.authorId || raw.userId || raw.uid,180),
    targetExcerpt:content
  };
}

export async function submitPostReport(mode, userId, postId, reason, details = '') {
  if (!userId) throw new Error('Sign in to report content.');

  const validation = validatePostReportDraft({ postId, reason, details });
  if (!validation.valid) throw new Error(validation.errors[0]?.message || 'Check the report.');

  if (mode === 'demo') {
    return {
      id:`demo-report-${Date.now()}`,
      status:'open',
      ...validation.value
    };
  }

  const postRef = doc(db, C.posts, validation.value.postId);
  const postSnap = await getDoc(postRef);
  const target = postSnap.exists() ? publicPostSnapshot(postSnap.data(), postSnap.id) : null;
  if (!target) throw new Error('This post is no longer available for reporting.');

  const reportRef = doc(collection(db, C.reports));
  const nowMillis = Date.now();
  const payload = {
    targetType:'post',
    ...target,
    reporterUid:String(userId),
    userId:String(userId),
    reason:validation.value.reason,
    details:validation.value.details,
    status:'open',
    sourcePlatform:'web',
    createdAtMillis:nowMillis,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  };
  await setDoc(reportRef,payload);
  return normalizeModerationReport(payload,reportRef.id,'reports');
}

async function readCanonicalReports() {
  try {
    const snap = await getDocs(query(collection(db,C.reports),limit(150)));
    return snap.docs.map(row=>normalizeModerationReport(row.data(),row.id,'reports'));
  } catch {
    return [];
  }
}

async function readLegacyReports() {
  try {
    const snap = await getDocs(query(
      collection(db,SUPPORT_REQUESTS),
      where('type','==','post_report'),
      limit(100)
    ));
    return snap.docs.map(row=>normalizeModerationReport(row.data(),row.id,'support_requests'));
  } catch {
    return [];
  }
}

export async function listAdminReports(mode,user,profile) {
  if (!(await getAdminCapability(mode,user,profile))) throw new Error('Admin authorization is required.');
  if (mode === 'demo') return [];
  const [canonical,legacy] = await Promise.all([readCanonicalReports(),readLegacyReports()]);
  const seen = new Set();
  return [...canonical,...legacy].filter(report=>{
    const key=`${report.source}:${report.id}`;
    if(!report.id || !report.postId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function reportDocument(report) {
  const collectionName = report?.source === 'support_requests' ? SUPPORT_REQUESTS : C.reports;
  return doc(db,collectionName,String(report?.id || ''));
}

export async function reviewReport(mode,user,profile,report,action) {
  if (!(await getAdminCapability(mode,user,profile))) throw new Error('Admin authorization is required.');
  if (mode === 'demo') return { ...report, ...moderationActionCopy(action) };
  if (!report?.id || !report?.postId) throw new Error('Report is missing required target information.');

  const outcome = moderationActionCopy(action);
  const reportRef = reportDocument(report);
  const auditRef = doc(collection(db,MODERATION_AUDIT));
  const batch = writeBatch(db);

  if (action === 'hide_post') {
    batch.update(doc(db,C.posts,String(report.postId)),{
      status:'hidden',
      visibility:'private',
      moderationStatus:'hidden',
      moderatedAt:serverTimestamp(),
      moderatedByAdminUid:String(user.uid),
      updatedAt:serverTimestamp()
    });
  }

  batch.update(reportRef,{
    status:outcome.status,
    resolution:outcome.resolution,
    reviewedAt:serverTimestamp(),
    reviewedByAdminUid:String(user.uid),
    updatedAt:serverTimestamp()
  });

  batch.set(auditRef,{
    action:outcome.auditAction,
    reportId:String(report.id),
    reportSource:report.source === 'support_requests' ? 'support_requests' : 'reports',
    postId:String(report.postId),
    adminUid:String(user.uid),
    reason:clean(report.reason,80),
    createdAt:serverTimestamp()
  });

  await batch.commit();
  return { ...report, status:outcome.status, resolution:outcome.resolution };
}
