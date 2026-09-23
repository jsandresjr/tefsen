import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_REASONS,
  validatePostReportDraft,
  normalizeModerationReport,
  buildModerationQueue,
  moderationActionCopy
} from '../../app/js/services/moderation-model.js';

test('post report validation accepts only supported reasons', () => {
  const valid = validatePostReportDraft({postId:'p1',reason:REPORT_REASONS[0],details:'Useful context'});
  assert.equal(valid.valid,true);
  const invalid = validatePostReportDraft({postId:'p1',reason:'Because I disagree'});
  assert.equal(invalid.valid,false);
});

test('report details are bounded without losing the target', () => {
  const result = validatePostReportDraft({postId:'p1',reason:'Other',details:'x'.repeat(1500)});
  assert.equal(result.value.details.length,1000);
  assert.equal(result.value.postId,'p1');
});

test('legacy support requests normalize into the moderation model', () => {
  const report = normalizeModerationReport({
    type:'post_report',requesterId:'u1',postId:'p1',reason:'Spam',status:'open'
  },'legacy-1','support_requests');
  assert.equal(report.source,'support_requests');
  assert.equal(report.reporterUid,'u1');
  assert.equal(report.postId,'p1');
});

test('moderation queue prioritizes open and in-review reports before closed ones', () => {
  const model = buildModerationQueue([
    {id:'r3',postId:'p3',status:'resolved',createdAtMillis:300},
    {id:'r1',postId:'p1',status:'open',createdAtMillis:100},
    {id:'r2',postId:'p2',status:'in_review',createdAtMillis:200}
  ]);
  assert.deepEqual(model.reports.map(row=>row.id),['r1','r2','r3']);
  assert.equal(model.counts.open,1);
  assert.equal(model.counts.inReview,1);
  assert.equal(model.counts.resolved,1);
});

test('moderation actions map to explicit report outcomes', () => {
  assert.deepEqual(moderationActionCopy('hide_post'),{
    status:'resolved',resolution:'content_hidden',auditAction:'hide_reported_post'
  });
  assert.deepEqual(moderationActionCopy('dismiss'),{
    status:'dismissed',resolution:'no_action',auditAction:'dismiss_report'
  });
  assert.throws(()=>moderationActionCopy('delete_everything'));
});
