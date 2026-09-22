// Official-source starter catalogue used only when the production
// Firestore opportunities collection has no published/public records.
//
// These records are intentionally small and source-first. They let a new
// Tefsen deployment provide useful discovery immediately without pretending
// that an empty Firestore collection is a finished catalogue.
//
// Source details were checked on 2026-09-22. The official provider page remains
// authoritative and must be re-checked before applying.

export const STARTER_OPPORTUNITIES = Object.freeze([
  {
    id: 'starter-chevening-sri-lanka-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-22',
    title: 'Chevening Scholarship — Sri Lanka 2027–2028',
    provider: 'Chevening / UK Foreign, Commonwealth & Development Office',
    country: 'United Kingdom',
    opportunityType: 'Scholarship',
    fundingType: 'Fully funded',
    studyLevels: ['Master'],
    subjects: ['Eligible one-year taught master’s courses'],
    eligibleNationalities: ['Sri Lankan'],
    benefits: [
      'Scholarship funding for eligible UK master’s study',
      'Use the official Chevening award page for the current funding package'
    ],
    requirements: [
      'Country-specific Chevening eligibility applies',
      'Applicants must also meet their chosen UK course and university requirements',
      'Apply only through the official Chevening application process'
    ],
    requiredDocuments: [],
    languageRequirements: [],
    deadline: '2026-10-06',
    deadlineNote: 'Applications close 6 October 2026 at 11:00 UTC.',
    summary: 'Applications for 2027–2028 Chevening Scholarships are open for Sri Lankan applicants. Review the official country page and eligibility guidance before applying.',
    officialSourceUrl: 'https://www.chevening.org/scholarship/sri-lanka/',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-22',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-commonwealth-masters-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-22',
    title: 'Commonwealth Master’s Scholarships 2027–2028',
    provider: 'Commonwealth Scholarship Commission in the UK',
    country: 'United Kingdom',
    opportunityType: 'Scholarship',
    fundingType: 'Fully funded',
    studyLevels: ['Master'],
    subjects: ['CSC development themes'],
    eligibleNationalities: [],
    benefits: [
      'Approved tuition fees',
      'Approved airfare',
      'Living allowance',
      'Additional support may apply depending on circumstances'
    ],
    requirements: [
      'Applicants must be from an eligible low- or middle-income Commonwealth country',
      'Applicants must meet the published academic and residency requirements',
      'Applicants must be unable to afford UK study without the scholarship'
    ],
    requiredDocuments: ['Academic transcripts and other documents listed by the CSC'],
    languageRequirements: [],
    deadline: '2026-10-20',
    deadlineNote: 'Applications close 20 October 2026 at 16:00 BST.',
    summary: 'Commonwealth Master’s Scholarships support full-time taught master’s study in the UK for eligible candidates from low- and middle-income Commonwealth countries. Sri Lanka is listed as an eligible country for this round.',
    officialSourceUrl: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-22',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-erasmus-mundus-joint-masters',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-22',
    title: 'Erasmus Mundus Joint Masters',
    provider: 'European Commission — Erasmus+',
    country: 'Europe / Multiple countries',
    opportunityType: 'Scholarship',
    fundingType: 'Full scholarships available',
    studyLevels: ['Master'],
    subjects: ['Varies by programme'],
    eligibleNationalities: [],
    benefits: [
      'Participation costs for selected scholarship recipients',
      'Contribution to travel',
      'Contribution to visa costs',
      'Living allowance'
    ],
    requirements: [
      'Apply directly to the institution running the selected Erasmus Mundus programme',
      'Entry and academic requirements vary by programme'
    ],
    requiredDocuments: [],
    languageRequirements: [],
    deadline: '',
    deadlineNote: 'Most programmes accept applications between October and January; exact dates vary by programme.',
    summary: 'International joint master’s programmes delivered by multiple higher-education institutions. Students worldwide can apply and full scholarships are available for top-ranked applicants.',
    officialSourceUrl: 'https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-22',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-daad-master-study-scholarships',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-22',
    title: 'DAAD Study Scholarships — Master Studies',
    provider: 'German Academic Exchange Service (DAAD)',
    country: 'Germany',
    opportunityType: 'Scholarship',
    fundingType: 'Funded scholarship',
    studyLevels: ['Master'],
    subjects: ['Multiple academic disciplines'],
    eligibleNationalities: [],
    benefits: [
      'Monthly scholarship support',
      'Travel allowance in many programmes',
      'Additional benefits vary by the official call'
    ],
    requirements: [
      'A completed first academic degree is required for the master-study programme',
      'Country, subject and programme-specific conditions apply',
      'Use the DAAD scholarship database for the current call and deadline'
    ],
    requiredDocuments: [],
    languageRequirements: [],
    deadline: '',
    deadlineNote: 'Deadline varies by country and scholarship call. Check the current DAAD database entry.',
    summary: 'DAAD funds international graduates for postgraduate study in Germany through multiple scholarship calls. Eligibility, deadlines and benefits depend on the specific call and applicant country.',
    officialSourceUrl: 'https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?daad=&detail=50026200',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-22',
    status: 'published',
    visibility: 'public'
  }
]);
