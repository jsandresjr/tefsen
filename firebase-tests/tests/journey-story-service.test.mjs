import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildJourneyStoryModel,
  validateJourneyStoryDraft
} from '../../app/js/services/journey-story-service.js';

const validDraft={
  subject:'Computer Science',
  university:'Global Tech University',
  intake:'Fall 2027',
  title:'My scholarship application Journey',
  content:'I am sharing the milestones I chose to make public so other students can understand the general shape of my experience.',
  publicMilestones:[
    {stage:'Applied',month:'2027-01',note:'I submitted after checking the official provider instructions.'},
    {stage:'Interview',month:'2027-03',note:'I prepared examples from my studies and previous projects.'},
    {stage:'Offer received',month:'2027-05',note:'I reviewed the official offer conditions before making plans.'}
  ]
};

test('valid Journey story draft is normalized and accepted',()=>{
  const result=validateJourneyStoryDraft(validDraft);
  assert.equal(result.valid,true);
  assert.equal(result.value.subject,'Computer Science');
  assert.equal(result.value.publicMilestones.length,3);
  assert.equal(result.value.publicMilestones[0].stage,'Applied');
});

test('Journey story requires subject title introduction and at least one milestone',()=>{
  const result=validateJourneyStoryDraft({
    subject:'',
    title:'',
    content:'short',
    publicMilestones:[]
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(error=>error.field==='subject'),true);
  assert.equal(result.errors.some(error=>error.field==='title'),true);
  assert.equal(result.errors.some(error=>error.field==='content'),true);
  assert.equal(result.errors.some(error=>error.field==='stage1'),true);
});

test('milestone requires a stage name',()=>{
  const result=validateJourneyStoryDraft({
    ...validDraft,
    publicMilestones:[{stage:'',month:'2027-01',note:'This public note has enough useful context.'}]
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(error=>error.field==='stage1'),true);
});

test('milestone month must use YYYY-MM',()=>{
  const result=validateJourneyStoryDraft({
    ...validDraft,
    publicMilestones:[{stage:'Applied',month:'January 2027',note:'This public note has enough useful context.'}]
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(error=>error.field==='month1'),true);
});

test('short milestone note is rejected when a note is supplied',()=>{
  const result=validateJourneyStoryDraft({
    ...validDraft,
    publicMilestones:[{stage:'Applied',month:'2027-01',note:'Tiny'}]
  });
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(error=>error.field==='note1'),true);
});

test('publisher caps public milestones at four',()=>{
  const result=validateJourneyStoryDraft({
    ...validDraft,
    publicMilestones:[
      {stage:'One',month:'2027-01',note:'Useful public note one.'},
      {stage:'Two',month:'2027-02',note:'Useful public note two.'},
      {stage:'Three',month:'2027-03',note:'Useful public note three.'},
      {stage:'Four',month:'2027-04',note:'Useful public note four.'},
      {stage:'Five',month:'2027-05',note:'This should not be published by the form model.'}
    ]
  });
  assert.equal(result.valid,true);
  assert.equal(result.value.publicMilestones.length,4);
  assert.equal(result.value.publicMilestones.some(item=>item.stage==='Five'),false);
});

test('obvious sensitive application and identity details are blocked',()=>{
  const result=validateJourneyStoryDraft({
    ...validDraft,
    content:'I want to share my application ID because it helped me remember the process.',
    publicMilestones:[
      {stage:'Applied',month:'2027-01',note:'My passport number was written on the document I uploaded.'}
    ]
  });
  assert.equal(result.valid,false);
  assert.equal(result.sensitive.some(item=>item.key==='application_id'),true);
  assert.equal(result.sensitive.some(item=>item.key==='passport_number'),true);
});

test('university and intake remain optional public context',()=>{
  const result=validateJourneyStoryDraft({
    ...validDraft,
    university:'',
    intake:''
  });
  assert.equal(result.valid,true);
  assert.equal(result.warnings.some(item=>item.field==='university'),true);
  assert.equal(result.warnings.some(item=>item.field==='intake'),true);
});

test('reader model exposes only normalized public Journey story fields',()=>{
  const model=buildJourneyStoryModel({
    id:'journey-story-1',
    postType:'journey_story',
    status:'published',
    visibility:'public',
    title:validDraft.title,
    content:validDraft.content,
    authorId:'u1',
    authorName:'Student One',
    communitySubject:validDraft.subject,
    communityUniversity:validDraft.university,
    communityIntake:validDraft.intake,
    publicMilestones:validDraft.publicMilestones,
    privateNotes:'must never become part of reader model',
    checklist:[{text:'private'}],
    targetDate:'2027-01-15'
  });
  assert.equal(model.isPublic,true);
  assert.equal(model.subject,'Computer Science');
  assert.equal(model.university,'Global Tech University');
  assert.equal(model.intake,'Fall 2027');
  assert.equal(model.milestones.length,3);
  assert.equal('privateNotes' in model,false);
  assert.equal('checklist' in model,false);
  assert.equal('targetDate' in model,false);
});

test('reader model marks hidden Journey story non-public',()=>{
  const model=buildJourneyStoryModel({
    postType:'journey_story',
    status:'hidden',
    visibility:'public',
    publicMilestones:[{stage:'Applied'}]
  });
  assert.equal(model.isPublic,false);
});

test('reader privacy notice explicitly excludes private Journey workspace data',()=>{
  const model=buildJourneyStoryModel({
    postType:'journey_story',
    status:'published',
    visibility:'public',
    publicMilestones:[{stage:'Applied'}]
  });
  assert.match(model.privacyNotice,/Private Tefsen Journey stages, checklists, target dates, notes and post-acceptance planning/i);
  assert.match(model.trustNotice,/not a recommended sequence/i);
  assert.match(model.sourceNotice,/official university or provider sources/i);
});

test('non-Journey posts do not get a Journey reader model',()=>{
  assert.equal(buildJourneyStoryModel({postType:'discussion'}),null);
});
