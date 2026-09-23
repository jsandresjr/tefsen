export const REPORT_REASONS = Object.freeze([
  'Spam',
  'Harassment',
  'Harmful or unsafe content',
  'Misinformation concern',
  'Copyright concern',
  'Other'
]);

const REPORT_REASON_SET = new Set(REPORT_REASONS);

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function validatePostReportDraft({ postId = '', reason = '', details = '' } = {}) {
  const value = {
    postId:clean(postId, 180),
    reason:clean(reason, 80),
    details:String(details || '').trim().slice(0, 1000)
  };
  const errors = [];
  if (!value.postId) errors.push({ field:'postId', message:'The reported post is missing.' });
  if (!REPORT_REASON_SET.has(value.reason)) errors.push({ field:'reason', message:'Choose a valid report reason.' });
  return { valid:errors.length === 0, errors, value };
}

export function normalizeModerationReport(raw = {}, id = '', source = 'reports') {
  const statusRaw = clean(raw.status || 'open', 40).toLowerCase();
  const allowedStatus = new Set(['open','in_review','resolved','dismissed']);
  return {
    id:clean(id || raw.id, 180),
    source:source === 'support_requests' ? 'support_requests' : 'reports',
    targetType:'post',
    postId:clean(raw.postId || raw.targetId, 180),
    targetTitle:clean(raw.targetTitle || raw.postTitle || 'Reported Community post', 180),
    targetAuthorId:clean(raw.targetAuthorId || raw.postAuthorId, 180),
    targetExcerpt:clean(raw.targetExcerpt || raw.postExcerpt, 300),
    reporterUid:clean(raw.reporterUid || raw.requesterId || raw.userId, 180),
    reason:REPORT_REASON_SET.has(clean(raw.reason,80)) ? clean(raw.reason,80) : 'Other',
    details:String(raw.details || '').trim().slice(0,1000),
    status:allowedStatus.has(statusRaw) ? statusRaw : 'open',
    resolution:clean(raw.resolution, 80),
    sourcePlatform:clean(raw.sourcePlatform || 'web', 40),
    createdAt:raw.createdAt || raw.timestamp || null,
    createdAtMillis:Number(raw.createdAtMillis || 0),
    reviewedAt:raw.reviewedAt || null,
    reviewedByAdminUid:clean(raw.reviewedByAdminUid, 180)
  };
}

function reportTime(report = {}) {
  if (Number(report.createdAtMillis || 0) > 0) return Number(report.createdAtMillis);
  const date = report.createdAt instanceof Date ? report.createdAt : null;
  if (date) return date.getTime();
  if (typeof report.createdAt === 'string') {
    const parsed = new Date(report.createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  if (report.createdAt?.toDate) {
    try { return report.createdAt.toDate().getTime(); } catch {}
  }
  return 0;
}

export function buildModerationQueue(reports = []) {
  const normalized = (Array.isArray(reports) ? reports : [])
    .filter(report => report?.id && report?.postId);

  const priority = { open:0, in_review:1, resolved:2, dismissed:3 };
  normalized.sort((a,b) => {
    const byStatus = (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
    if (byStatus) return byStatus;
    return reportTime(b) - reportTime(a);
  });

  return {
    reports:normalized,
    active:normalized.filter(row => ['open','in_review'].includes(row.status)),
    resolved:normalized.filter(row => ['resolved','dismissed'].includes(row.status)),
    counts:{
      total:normalized.length,
      open:normalized.filter(row => row.status === 'open').length,
      inReview:normalized.filter(row => row.status === 'in_review').length,
      resolved:normalized.filter(row => row.status === 'resolved').length,
      dismissed:normalized.filter(row => row.status === 'dismissed').length,
      legacy:normalized.filter(row => row.source === 'support_requests').length
    }
  };
}

export function moderationActionCopy(action) {
  if (action === 'hide_post') return { status:'resolved', resolution:'content_hidden', auditAction:'hide_reported_post' };
  if (action === 'resolve') return { status:'resolved', resolution:'reviewed_no_hide', auditAction:'resolve_report' };
  if (action === 'dismiss') return { status:'dismissed', resolution:'no_action', auditAction:'dismiss_report' };
  throw new Error('Unsupported moderation action.');
}
