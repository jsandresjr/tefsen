import test from 'node:test';
import assert from 'node:assert/strict';
import {
  postLimits,validateTextPost,draftStorageKey,saveDraft,loadDraft,clearDraft,
  normalizeSearch,chooseSearchMode,rankPeople,filterPosts
} from '../js/services/text-first-workflow.mjs';
import {avatarCropRect} from '../js/services/avatar-crop-math.mjs';
import {validatePhotoSource,MAX_PROFILE_SOURCE_BYTES} from '../js/services/profile-photo-policy.mjs';

function fakeStorage(){
  const map=new Map();
  return {setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k)};
}
test('free/paid/admin limits and text guards',()=>{
  assert.deepEqual(postLimits({subscribed:false}),{maxChars:300,dailyPosts:20});
  assert.deepEqual(postLimits({subscribed:true}),{maxChars:1000,dailyPosts:40});
  assert.equal(postLimits({admin:true}).dailyPosts,Infinity);
  assert.equal(validateTextPost(' ',postLimits()).valid,false);
  assert.equal(validateTextPost('A'.repeat(300),postLimits()).valid,true);
  assert.equal(validateTextPost('A'.repeat(301),postLimits()).valid,false);
  assert.equal(validateTextPost('A'.repeat(1000),postLimits({subscribed:true})).valid,true);
  assert.equal(validateTextPost('A'.repeat(1001),postLimits({subscribed:true})).valid,false);
});
test('drafts remain private to their owning account and clear explicitly',()=>{
  const storage=fakeStorage();
  assert.notEqual(draftStorageKey('user-a'),draftStorageKey('user-b'));
  assert.equal(saveDraft(storage,'user-a','unfinished thought'),true);
  assert.equal(loadDraft(storage,'user-a'),'unfinished thought');
  assert.equal(loadDraft(storage,'user-b'),'');
  clearDraft(storage,'user-a');
  assert.equal(loadDraft(storage,'user-a'),'');
});
test('people mode, @ normalization and exact/prefix ranking',()=>{
  const people=[
    {uid:'b',username:'alicefan',fullName:'Alice Fan'},
    {uid:'c',username:'other',fullName:'Alice'},
    {uid:'a',username:'alice',fullName:'Person'}
  ];
  assert.equal(normalizeSearch(' @ALICE '),'alice');
  assert.equal(chooseSearchMode(' @alice','posts'),'people');
  assert.equal(chooseSearchMode('lesson','posts'),'posts');
  assert.deepEqual(rankPeople(people,'@alice').map(x=>x.uid),['a','c','b']);
  assert.equal(rankPeople([{username:'other',fullName:'Sri Lanka Student'}],'sri lanka').length,1);
});
test('post search excludes unrelated text',()=>{
  assert.deepEqual(filterPosts([{id:'one',content:'A study tip'},{id:'two',content:'A movie'}],'study').map(x=>x.id),['one']);
});
test('photo source supports exactly 5 MiB but refuses oversize and unknown',()=>{
  assert.equal(validatePhotoSource({size:MAX_PROFILE_SOURCE_BYTES,type:'image/jpeg'}),true);
  assert.throws(()=>validatePhotoSource({size:MAX_PROFILE_SOURCE_BYTES+1,type:'image/jpeg'}));
  assert.throws(()=>validatePhotoSource({type:'image/png'}));
  assert.throws(()=>validatePhotoSource({size:0,type:'image/png'}));
  assert.throws(()=>validatePhotoSource({size:500,type:'application/pdf'}));
});

test('avatar crop always covers output and clamps drag/zoom',()=>{
  const cover=avatarCropRect(100,200,200,1);
  assert.equal(cover.width,200);
  assert.equal(cover.height,400);
  assert.equal(cover.x,0);
  assert.equal(cover.y,-100);
  const zoomed=avatarCropRect(100,200,200,2,1000,-1000);
  assert.equal(zoomed.zoom,2);
  assert.equal(zoomed.x,0);
  assert.equal(zoomed.y,200-zoomed.height);
  assert.throws(()=>avatarCropRect(0,300,200));
});
