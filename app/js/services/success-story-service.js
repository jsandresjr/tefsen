const FUNDING_OPTIONS = new Set([
  '',
  'Fully funded',
  'Partial funding',
  'Self funded / offer only',
  'Other'
]);

function cleanSingle(value, max) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanNarrative(value, max) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

const SENSITIVE_PATTERNS = [
  { key:'application_id', label:'application ID or application number', pattern:/\b(application|applicant)\s*(id|number|no\.?|reference|ref)\b/i },
  { key:'passport_number', label:'passport number', pattern:/\bpassport\s*(number|no\.?|id)\b/i },
  { key:'visa_number', label:'visa number', pattern:/\bvisa\s*(number|no\.?|id)\b/i },
  { key:'booking_reference', label:'booking reference', pattern:/\b(booking|reservation)\s*(reference|ref|number|no\.?)\b/i },
  { key:'financial_account', label:'financial account or card number', pattern:/\b(bank\s*account|account\s*number|card\s*number|credit\s*card|debit\s*card)\b/i },
  { key:'identity_number', label:'government identity number', pattern:/\b(national\s*(id|identity)|identity\s*(number|no\.?))\b/i },
  { key:'home_address', label:'home or residential address', pattern:/\b(home|residential)\s*address\b/i }
];

export function detectSensitiveSuccessStoryText(values = {}) {
  const haystack = [
    values.title,
    values.content,
    values.opportunityName,
    values.university
  ].filter(Boolean).join('\n');

  return SENSITIVE_PATTERNS
    .filter(item => item.pattern.test(haystack))
    .map(item => ({ key:item.key, label:item.label }));
}

export function validateSuccessStoryDraft(input = {}) {
  const opportunityName = cleanSingle(input.opportunityName, 180);
  const university = cleanSingle(input.university, 180);
  const subject = cleanSingle(input.subject, 120);
  const country = cleanSingle(input.country, 120);
  const studyLevel = cleanSingle(input.studyLevel, 100);
  const intake = cleanSingle(input.intake, 80);
  const fundingType = cleanSingle(input.fundingType, 100);
  const content = cleanNarrative(input.content, 3000);
  const suppliedTitle = cleanSingle(input.title, 180);
  const title = suppliedTitle || (opportunityName ? `I received ${opportunityName}` : '');

  const value = {
    title,
    content,
    university,
    opportunityName,
    country,
    subject,
    studyLevel,
    intake,
    fundingType
  };

  const errors = [];
  const warnings = [];

  if (university.length < 2) errors.push({ field:'university', message:'Add the university or institution.' });
  if (opportunityName.length < 2) errors.push({ field:'opportunityName', message:'Add the scholarship, program or offer name.' });
  if (subject.length < 2) errors.push({ field:'subject', message:'Add the study subject or field.' });
  if (title.length < 8) errors.push({ field:'title', message:'Use a clear headline of at least 8 characters.' });
  if (content.length < 40) errors.push({ field:'content', message:'Share at least 40 characters so the story gives other students useful context.' });

  if (fundingType && !FUNDING_OPTIONS.has(fundingType)) {
    errors.push({ field:'fundingType', message:'Choose one of the listed funding options.' });
  }

  if (!country) warnings.push({ field:'country', message:'Country is optional, but adding it can make the story easier to understand.' });
  if (!studyLevel) warnings.push({ field:'studyLevel', message:'Study level is optional.' });
  if (!intake) warnings.push({ field:'intake', message:'Intake/year is optional.' });
  if (!fundingType) warnings.push({ field:'fundingType', message:'Funding can be left unspecified.' });

  const sensitive = detectSensitiveSuccessStoryText(value);
  for (const item of sensitive) {
    errors.push({
      field:'content',
      code:item.key,
      message:`Remove the ${item.label} before publishing. Success stories are public.`
    });
  }

  return {
    valid:errors.length === 0,
    errors,
    warnings,
    sensitive,
    value
  };
}

export function buildSuccessStoryModel(post = {}) {
  if (String(post.postType || '') !== 'success_story') return null;

  const data = post.successData && typeof post.successData === 'object'
    ? post.successData
    : {};

  const facts = [
    ['University', cleanSingle(data.university,180)],
    ['Scholarship / program / offer', cleanSingle(data.opportunityName,180)],
    ['Country', cleanSingle(data.country,120)],
    ['Subject', cleanSingle(data.subject,120)],
    ['Study level', cleanSingle(data.studyLevel,100)],
    ['Intake / year', cleanSingle(data.intake,80)],
    ['Funding', cleanSingle(data.fundingType,100)]
  ].filter(([,value]) => Boolean(value));

  const status = String(post.status || 'published').toLowerCase();
  const visibility = String(post.visibility || 'public').toLowerCase();

  return {
    id:String(post.id || ''),
    title:cleanSingle(post.title || 'Student success story',180) || 'Student success story',
    content:cleanNarrative(post.content,3000),
    authorId:String(post.authorId || ''),
    authorName:cleanSingle(post.authorName || 'Tefsen User',80) || 'Tefsen User',
    authorPhotoUrl:String(post.authorPhotoUrl || ''),
    role:String(post.role || 'student'),
    verified:Boolean(post.verified),
    createdAt:post.createdAt || null,
    subject:cleanSingle(data.subject || post.communitySubject || post.subject || '',120),
    university:cleanSingle(data.university || post.communityUniversity || '',180),
    intake:cleanSingle(data.intake || post.communityIntake || '',80),
    country:cleanSingle(data.country || '',120),
    opportunityName:cleanSingle(data.opportunityName || '',180),
    fundingType:cleanSingle(data.fundingType || '',100),
    facts,
    tags:Array.isArray(post.tags) ? post.tags.slice(0,6) : [],
    likeCount:Math.max(0,Number(post.likeCount || 0)),
    commentCount:Math.max(0,Number(post.commentCount || 0)),
    isPublic:status === 'published' && visibility === 'public',
    trustNotice:'This is a student-shared experience. It does not prove current eligibility, funding, admission requirements or future outcomes.',
    sourceNotice:'Verify current scholarship, university, funding, deadline, visa and enrollment requirements on the official provider or institution source.',
    privacyNotice:'Only information the student chose to publish is shown here. Private Tefsen Journey data and private documents are not part of this story.'
  };
}
