import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
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
  });
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
