import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSuccessStoryModel,
  detectSensitiveSuccessStoryText,
  validateSuccessStoryDraft
} from '../../app/js/services/success-story-service.js';

const validDraft={
  university:'Global Tech University',
  opportunityName:'Global Scholars Award',
  country:'Canada',
  subject:'Computer Science',
  studyLevel:'Undergraduate',
  intake:'Fall 2027',
  fundingType:'Fully funded',
  title:'I received a Global Scholars Award',
  content:'I received the offer after preparing my documents early and checking every requirement on the official university page.'
};

test('valid success story draft is normalized and accepted',()=>{
  const result=validateSuccessStoryDraft(validDraft);
  assert.equal(result.valid,true);
  assert.equal(result.value.university,'Global Tech University');
  assert.equal(result.value.subject,'Computer Science');
  assert.equal(result.value.fundingType,'Fully funded');
});

test('headline falls back to opportunity name when omitted',()=>{
  const result=validateSuccessStoryDraft({...validDraft,title:''});
  assert.equal(result.valid,true);
  assert.equal(result.value.title,'I received Global Scholars Award');
});

test('story requires useful narrative context',()=>{
  const result=validateSuccessStoryDraft({...validDraft,content:'I got it.'});
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(error=>error.field==='content'),true);
});

test('story requires institution opportunity and subject',()=>{
  const result=validateSuccessStoryDraft({
    ...validDraft,
    university:'',
    opportunityName:'',
    subject:''
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(error=>error.field==='university'),true);
  assert.equal(result.errors.some(error=>error.field==='opportunityName'),true);
  assert.equal(result.errors.some(error=>error.field==='subject'),true);
});

test('funding type must use supported public labels',()=>{
  const result=validateSuccessStoryDraft({...validDraft,fundingType:'Guaranteed forever'});
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(error=>error.field==='fundingType'),true);
});

test('obvious sensitive identifier language is flagged before publishing',()=>{
  const sensitive=detectSensitiveSuccessStoryText({
    ...validDraft,
    content:'My application ID was ABC123 and my passport number was also included.'
  });
  assert.equal(sensitive.some(item=>item.key==='application_id'),true);
  assert.equal(sensitive.some(item=>item.key==='passport_number'),true);
});

test('sensitive story is blocked by validation',()=>{
  const result=validateSuccessStoryDraft({
    ...validDraft,
    content:'I received the offer. My bank account number is included here because the funding arrived there.'
  });
  assert.equal(result.valid,false);
  assert.equal(result.sensitive.some(item=>item.key==='financial_account'),true);
});

test('optional public context produces warnings instead of blocking',()=>{
  const result=validateSuccessStoryDraft({
    ...validDraft,
    country:'',
    studyLevel:'',
    intake:'',
    fundingType:''
  });
  assert.equal(result.valid,true);
  assert.equal(result.warnings.length >= 4,true);
});

test('success story reader model builds public facts and context links',()=>{
  const model=buildSuccessStoryModel({
    id:'story-1',
    postType:'success_story',
    status:'published',
    visibility:'public',
    title:validDraft.title,
    content:validDraft.content,
    authorId:'u1',
    authorName:'Student One',
    role:'student',
    successData:{
      university:validDraft.university,
      opportunityName:validDraft.opportunityName,
      country:validDraft.country,
      subject:validDraft.subject,
      studyLevel:validDraft.studyLevel,
      intake:validDraft.intake,
      fundingType:validDraft.fundingType
    },
    likeCount:4,
    commentCount:2
  });
  assert.equal(model.isPublic,true);
  assert.equal(model.university,'Global Tech University');
  assert.equal(model.subject,'Computer Science');
  assert.equal(model.intake,'Fall 2027');
  assert.equal(model.facts.length,7);
});

test('reader model does not treat hidden story as public',()=>{
  const model=buildSuccessStoryModel({
    postType:'success_story',
    status:'hidden',
    visibility:'public',
    successData:{university:'Global Tech University'}
  });
  assert.equal(model.isPublic,false);
});

test('reader trust language avoids guarantees and delegates requirements to official sources',()=>{
  const model=buildSuccessStoryModel({
    postType:'success_story',
    status:'published',
    visibility:'public',
    successData:{university:'Global Tech University'}
  });
  assert.match(model.trustNotice,/does not prove current eligibility/i);
  assert.match(model.sourceNotice,/official provider or institution source/i);
  assert.match(model.privacyNotice,/private Tefsen Journey data/i);
});

test('non-success posts do not get a success reader model',()=>{
  assert.equal(buildSuccessStoryModel({postType:'discussion'}),null);
});
