import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const revoke = args.includes('--revoke');
const uidArg = args.find(value => value.startsWith('--uid='));
const emailArg = args.find(value => value.startsWith('--email='));

if (!uidArg && !emailArg) {
  console.error('Usage: npm run admin:claim -- --uid=<uid> [--apply|--revoke]');
  console.error('   or: npm run admin:claim -- --email=<email> [--apply|--revoke]');
  process.exit(2);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();

const user = uidArg
  ? await auth.getUser(uidArg.slice('--uid='.length))
  : await auth.getUserByEmail(emailArg.slice('--email='.length));

const existing = user.customClaims || {};
const next = { ...existing };

if (revoke) {
  delete next.admin;
  if (String(next.role || '').toUpperCase() === 'ADMIN') delete next.role;
} else {
  next.admin = true;
}

console.log('Firebase user:', user.uid, user.email || '(no email)');
console.log('Existing custom claims:', existing);
console.log('Proposed custom claims:', next);

if (!apply && !revoke) {
  console.log('\nDry run only. Re-run with --apply to grant admin access.');
  process.exit(0);
}

if (revoke && !args.includes('--apply')) {
  console.error('\nRevocation also requires --apply.');
  process.exit(2);
}

await auth.setCustomUserClaims(user.uid, next);
await auth.revokeRefreshTokens(user.uid);

console.log(revoke ? 'Admin claim revoked.' : 'Admin claim granted.');
console.log('The user must sign out/in (or refresh their ID token) before the Web admin UI sees the new claim.');
