import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('../app/js/services/student-passport-service.js', 'utf8');
const withoutImports = source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '');
const pureSection = withoutImports.slice(0, withoutImports.indexOf('function demoKey'));
const api = new Function(
  pureSection.replace(/\bexport\s+/g, '') +
  '; return { emptyStudentPassport, normalizeStudentPassport, studentPassportOnboardingProgress, shouldShowPassportOnboarding, studentPassportCompleteness };'
)();

test('brand-new Passport shows onboarding', () => {
  const passport = api.emptyStudentPassport('student-1');
  assert.equal(api.shouldShowPassportOnboarding(passport), true);
  assert.equal(api.studentPassportOnboardingProgress(passport).completed, 0);
});

test('completed onboarding never reopens', () => {
  const passport = { ...api.emptyStudentPassport('student-1'), onboardingStatus:'completed' };
  assert.equal(api.shouldShowPassportOnboarding(passport), false);
});

test('skipped onboarding respects the student choice', () => {
  const passport = { ...api.emptyStudentPassport('student-1'), onboardingStatus:'skipped' };
  assert.equal(api.shouldShowPassportOnboarding(passport), false);
});

test('existing useful Passport data is not forced back into onboarding', () => {
  const passport = {
    ...api.emptyStudentPassport('student-1'),
    currentCountry:'Kenya',
    nationality:'Kenyan',
    currentEducationLevel:'Undergraduate'
  };
  assert.equal(api.shouldShowPassportOnboarding(passport), false);
});

test('essential progress is country-neutral and counts six fields', () => {
  const passport = {
    ...api.emptyStudentPassport('student-1'),
    currentCountry:'Brazil',
    nationality:'Brazilian',
    currentEducationLevel:'Undergraduate',
    targetEducationLevel:'Master',
    mainField:'Economics',
    fundingPreference:'Fully funded only'
  };
  const progress = api.studentPassportOnboardingProgress(passport);
  assert.equal(progress.total, 6);
  assert.equal(progress.completed, 6);
  assert.equal(progress.ready, true);
  assert.equal(progress.percent, 100);
});
