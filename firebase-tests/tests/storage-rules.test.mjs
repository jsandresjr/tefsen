import { after, before, beforeEach, test } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';
import {
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
  listAll
} from 'firebase/storage';

let env;

function bytes(size=4) {
  return new Uint8Array(size);
}

function postMetadata(uid,postId,slot) {
  return {
    contentType:'image/jpeg',
    customMetadata:{
      ownerUid:uid,
      postId,
      slot
    }
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId:'demo-tefsen-web-v1',
    storage:{
      rules:await readFile(new URL('../storage.web-v1.test.rules',import.meta.url),'utf8'),
      host:'127.0.0.1',
      port:9198
    }
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
});

test('profile images are public-readable but owner-write only', async () => {
  const owner=env.authenticatedContext('user-a').storage();
  const other=env.authenticatedContext('user-b').storage();
  const anon=env.unauthenticatedContext().storage();
  const path='profile_images/user-a.jpg';

  await assertSucceeds(uploadBytes(ref(owner,path),bytes(32),{contentType:'image/png'}));
  await assertSucceeds(getBytes(ref(anon,path)));
  await assertFails(uploadBytes(ref(other,path),bytes(32),{contentType:'image/png'}));
  await assertFails(deleteObject(ref(other,path)));
  await assertSucceeds(deleteObject(ref(owner,path)));
});

test('profile image upload rejects non-images and files larger than 5 MiB', async () => {
  const owner=env.authenticatedContext('user-a').storage();
  await assertFails(uploadBytes(
    ref(owner,'profile_images/user-a.jpg'),
    bytes(10),
    {contentType:'application/pdf'}
  ));
  await assertFails(uploadBytes(
    ref(owner,'profile_images/user-a.jpg'),
    bytes(5*1024*1024+1),
    {contentType:'image/jpeg'}
  ));
});

test('post images are restricted to two deterministic owner slots', async () => {
  const owner=env.authenticatedContext('user-a').storage();
  const other=env.authenticatedContext('user-b').storage();

  await assertSucceeds(uploadBytes(
    ref(owner,'post_images/user-a/post-1/1'),
    bytes(64),
    postMetadata('user-a','post-1','1')
  ));
  await assertSucceeds(uploadBytes(
    ref(owner,'post_images/user-a/post-1/2'),
    bytes(64),
    postMetadata('user-a','post-1','2')
  ));

  await assertFails(uploadBytes(
    ref(owner,'post_images/user-a/post-1/3'),
    bytes(64),
    postMetadata('user-a','post-1','3')
  ));
  await assertFails(uploadBytes(
    ref(other,'post_images/user-a/post-1/1'),
    bytes(64),
    postMetadata('user-a','post-1','1')
  ));
});

test('post image metadata must bind owner post and slot', async () => {
  const owner=env.authenticatedContext('user-a').storage();
  const base=ref(owner,'post_images/user-a/post-1/1');

  await assertFails(uploadBytes(base,bytes(32),postMetadata('user-b','post-1','1')));
  await assertFails(uploadBytes(base,bytes(32),postMetadata('user-a','post-2','1')));
  await assertFails(uploadBytes(base,bytes(32),postMetadata('user-a','post-1','2')));
  await assertFails(uploadBytes(base,bytes(32),{contentType:'image/jpeg'}));
});

test('post images reject non-images and files above 6 MiB', async () => {
  const owner=env.authenticatedContext('user-a').storage();
  const path='post_images/user-a/post-1/1';

  await assertFails(uploadBytes(
    ref(owner,path),
    bytes(12),
    {
      contentType:'application/octet-stream',
      customMetadata:{ownerUid:'user-a',postId:'post-1',slot:'1'}
    }
  ));
  await assertFails(uploadBytes(
    ref(owner,path),
    bytes(6*1024*1024+1),
    postMetadata('user-a','post-1','1')
  ));
});

test('public media can be fetched but folder listing stays unavailable', async () => {
  const owner=env.authenticatedContext('user-a').storage();
  const anon=env.unauthenticatedContext().storage();
  const path='post_images/user-a/post-1/1';

  await assertSucceeds(uploadBytes(
    ref(owner,path),
    bytes(20),
    postMetadata('user-a','post-1','1')
  ));
  await assertSucceeds(getBytes(ref(anon,path)));
  await assertFails(listAll(ref(anon,'post_images/user-a/post-1')));
  await assertFails(listAll(ref(anon,'profile_images')));
});

test('unknown storage paths and anonymous writes are denied', async () => {
  const owner=env.authenticatedContext('user-a').storage();
  const anon=env.unauthenticatedContext().storage();

  await assertFails(uploadBytes(
    ref(owner,'misc/user-a/file.jpg'),
    bytes(10),
    {contentType:'image/jpeg'}
  ));
  await assertFails(uploadBytes(
    ref(anon,'profile_images/user-a.jpg'),
    bytes(10),
    {contentType:'image/jpeg'}
  ));
  await assertFails(uploadBytes(
    ref(anon,'post_images/user-a/post-1/1'),
    bytes(10),
    postMetadata('user-a','post-1','1')
  ));
});

test('post-image owner can delete deterministic slots', async () => {
  const owner=env.authenticatedContext('user-a').storage();
  const path='post_images/user-a/post-1/1';
  await assertSucceeds(uploadBytes(
    ref(owner,path),
    bytes(10),
    postMetadata('user-a','post-1','1')
  ));
  await assertSucceeds(deleteObject(ref(owner,path)));
});
