// Official-source starter catalogue used only when the production
// Firestore opportunities collection has no published/public records.
//
// These records are intentionally small and source-first. They let a new
// Tefsen deployment provide useful discovery immediately without pretending
// that an empty Firestore collection is a finished catalogue.
//
// Source details were checked on 2026-09-23. The official provider page remains
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
  },
  {
    id: 'starter-knight-hennessy-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'Knight-Hennessy Scholars — 2027 Cohort',
    provider: 'Stanford University — Knight-Hennessy Scholars',
    country: 'United States',
    opportunityType: 'Scholarship',
    fundingType: 'Fully funded',
    studyLevels: ['Master', 'PhD', 'Professional graduate degree'],
    subjects: ['Stanford graduate fields'],
    eligibleNationalities: [],
    benefits: [
      'Up to three years of financial support for eligible Stanford graduate study',
      'Leadership-development programming and the Knight-Hennessy scholar community'
    ],
    requirements: [
      'Apply separately to Knight-Hennessy Scholars and an eligible full-time Stanford graduate degree program',
      'Meet the published Knight-Hennessy degree-date eligibility rule for the 2027 cohort',
      'Meet the admission requirements and deadline for the selected Stanford graduate program'
    ],
    requiredDocuments: ['Resume', 'Transcripts', 'Recommendation letters', 'Short answers and essay'],
    languageRequirements: [],
    deadline: '2026-10-06',
    deadlineNote: 'Knight-Hennessy applications for the 2027 cohort close 6 October 2026 at 1:00 PM Pacific Time. The Stanford graduate-program application is separate and may have an earlier deadline.',
    summary: 'Knight-Hennessy Scholars supports graduate study at Stanford for applicants from around the world. Candidates must complete both the Knight-Hennessy application and a separate eligible Stanford graduate-program application.',
    officialSourceUrl: 'https://knight-hennessy.stanford.edu/admission',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-pearson-toronto-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'Lester B. Pearson International Scholarship — 2027 Entry',
    provider: 'University of Toronto',
    country: 'Canada',
    opportunityType: 'Scholarship',
    fundingType: 'Full scholarship',
    studyLevels: ['Undergraduate'],
    subjects: ['Eligible first-entry undergraduate programs'],
    eligibleNationalities: ['International students'],
    benefits: [
      'Tuition for four years',
      'Books and incidental fees',
      'Full residence support for four years'
    ],
    requirements: [
      'International student requiring a Canadian study permit',
      'Final-year secondary-school student in 2026/2027 or graduated no earlier than June 2026',
      'Must begin studies at the University of Toronto in September 2027',
      'Must be nominated by the current secondary school'
    ],
    requiredDocuments: ['School nomination', 'University of Toronto admission application', 'Pearson scholarship application and required documents'],
    languageRequirements: [],
    deadline: '2026-11-06',
    deadlineNote: 'School nomination deadline: 9 October 2026. University of Toronto admission application deadline for Pearson consideration: 16 October 2026. Pearson scholarship application and documents: 6 November 2026.',
    summary: 'The Lester B. Pearson International Scholarship is a four-year University of Toronto award for exceptional international students nominated by their secondary school.',
    officialSourceUrl: 'https://future.utoronto.ca/pearson-scholarships',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-ubc-international-scholars-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'UBC International Scholars Program — 2027 Entry',
    provider: 'University of British Columbia',
    country: 'Canada',
    opportunityType: 'Scholarship',
    fundingType: 'Need-and-merit-based funding',
    studyLevels: ['Undergraduate'],
    subjects: ['Eligible UBC undergraduate programs'],
    eligibleNationalities: ['International students'],
    benefits: [
      'Need-and-merit-based award consideration through the International Scholars Program',
      'Dedicated advising and scholar-development support'
    ],
    requirements: [
      'International student entering UBC directly from an accredited secondary school',
      'Applying for a first undergraduate degree',
      'Demonstrate superior academic achievement and significant financial need',
      'Meet UBC admission and English-language requirements',
      'School nomination and teacher reference are required'
    ],
    requiredDocuments: ['UBC admission application', 'International Scholars award application', 'School nomination', 'Teacher reference', 'Financial information'],
    languageRequirements: ['Meet the UBC English Language Admission Standard or an eligible Vantage pathway requirement'],
    deadline: '2026-11-15',
    deadlineNote: 'For international applicants seeking International Scholars Program consideration, the UBC application and award application are due 15 November 2026 at 11:59 PM Pacific Time.',
    summary: 'UBC’s International Scholars Program supports high-achieving international undergraduates who demonstrate leadership, community contribution and significant financial need.',
    officialSourceUrl: 'https://you.ubc.ca/financial-planning/scholarships-awards-international-students/international-scholars',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-swiss-government-excellence-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'Swiss Government Excellence Scholarships 2027–2028',
    provider: 'Swiss Confederation — Federal Commission for Scholarships for Foreign Students',
    country: 'Switzerland',
    opportunityType: 'Scholarship',
    fundingType: 'Funded scholarship',
    studyLevels: ['PhD', 'Research', 'Arts'],
    subjects: ['Research fields and selected arts programmes'],
    eligibleNationalities: [],
    benefits: [
      'Government scholarship support for eligible research or arts study',
      'Exact benefits and conditions depend on scholarship type and country of origin'
    ],
    requirements: [
      'Scholarship availability and eligibility depend on country of origin',
      'Research applicants must prepare a research project and identify an academic supervisor in Switzerland',
      'Apply through the official Swiss Government Excellence Scholarships process'
    ],
    requiredDocuments: [],
    languageRequirements: [],
    deadline: '',
    deadlineNote: 'Applications opened 20 August 2026. Closing dates and available scholarship types vary by country of origin; use the official country-specific information before applying.',
    summary: 'The Swiss Confederation offers Government Excellence Scholarships to promote international research cooperation and selected arts study. Country-specific eligibility and deadlines apply.',
    officialSourceUrl: 'https://www.sbfi.admin.ch/en/swiss-government-excellence-scholarships',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-hong-kong-phd-fellowship-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'Hong Kong PhD Fellowship Scheme 2027–2028',
    provider: 'Research Grants Council of Hong Kong',
    country: 'Hong Kong',
    opportunityType: 'Scholarship',
    fundingType: 'Funded PhD fellowship',
    studyLevels: ['PhD'],
    subjects: ['All eligible PhD fields at participating Hong Kong universities'],
    eligibleNationalities: [],
    benefits: [
      'Annual stipend',
      'Annual conference and research-related travel allowance',
      'Up to three years of fellowship support, with additional university support possible where applicable'
    ],
    requirements: [
      'Apply as a new full-time PhD student to an eligible Hong Kong university',
      'Submit the HKPFS initial application and the selected university application',
      'Meet the admission requirements of the chosen university and programme'
    ],
    requiredDocuments: [],
    languageRequirements: [],
    deadline: '2026-12-01',
    deadlineNote: 'Initial HKPFS application closes 1 December 2026 at 12:00 noon Hong Kong Time. University programme deadlines and full-application requirements must also be checked.',
    summary: 'The Research Grants Council invites applicants from around the world to compete for 400 Hong Kong PhD Fellowships for the 2027/28 academic year.',
    officialSourceUrl: 'https://www.ugc.edu.hk/eng/rgc/funding_opport/hkpfs/',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-gks-undergraduate-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'Global Korea Scholarship — Undergraduate 2027',
    provider: 'National Institute for International Education — Republic of Korea',
    country: 'South Korea',
    opportunityType: 'Scholarship',
    fundingType: 'Government-funded scholarship',
    studyLevels: ['Undergraduate'],
    subjects: ['Eligible universities and departments listed in the official 2027 GKS-U call'],
    eligibleNationalities: ['International students from eligible GKS countries'],
    benefits: [
      'Government scholarship package described in the official 2027 GKS-U application guidelines'
    ],
    requirements: [
      'Meet the nationality, age, academic and other eligibility rules in the 2027 GKS-U guidelines',
      'Apply through an eligible Embassy Track or University Track route',
      'Use the official university-information files for eligible institutions and departments'
    ],
    requiredDocuments: ['Documents listed in the official 2027 GKS-U application guidelines'],
    languageRequirements: [],
    deadline: '',
    deadlineNote: 'The 2027 GKS-U call was announced 9 September 2026. Application deadlines differ by Embassy Track, University Track and local submitting institution; check the official 2027 guidelines for the exact deadline.',
    summary: 'The Korean Government’s 2027 Global Korea Scholarship for Undergraduate Degrees is open through designated embassy and university tracks. Exact deadlines and documentation depend on the application route.',
    officialSourceUrl: 'https://www.studyinkorea.go.kr/ko/notice/scholarshipsRead.do?bbsId=BBSMSTR_000000000461&nttId=4522',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-clarendon-oxford-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'Clarendon Scholarships — Oxford 2027 Entry',
    provider: 'University of Oxford — Clarendon Fund',
    country: 'United Kingdom',
    opportunityType: 'Scholarship',
    fundingType: 'Fully funded',
    studyLevels: ['Master', 'PhD'],
    subjects: ['All eligible Oxford graduate subject areas'],
    eligibleNationalities: [],
    benefits: [
      'Course fees in full',
      'Grant for living expenses for the period of fee liability'
    ],
    requirements: [
      'Apply for a new eligible Oxford Master’s or DPhil course',
      'Submit the graduate-course application by the relevant December or January funding deadline',
      'No separate Clarendon scholarship application is required'
    ],
    requiredDocuments: ['Oxford graduate-course application documents'],
    languageRequirements: [],
    deadline: '',
    deadlineNote: 'There is no separate Clarendon deadline. Applicants must submit their Oxford graduate application by the relevant December 2026 or January 2027 funding deadline for their course.',
    summary: 'Oxford’s Clarendon Fund offers more than 200 fully funded graduate scholarships each year, with no nationality or subject-area restriction for eligible applicants.',
    officialSourceUrl: 'https://www.ox.ac.uk/admissions/graduate/fees-and-funding/funding/clarendon/applicants',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-gates-cambridge-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'Gates Cambridge Scholarship — 2027–2028',
    provider: 'Gates Cambridge / University of Cambridge',
    country: 'United Kingdom',
    opportunityType: 'Scholarship',
    fundingType: 'Full-cost scholarship',
    studyLevels: ['Master', 'PhD'],
    subjects: ['Eligible University of Cambridge postgraduate courses'],
    eligibleNationalities: ['Applicants from countries outside the United Kingdom'],
    benefits: [
      'University fees and maintenance support',
      'Student visa and immigration health surcharge support',
      'Travel support at the beginning and end of the course',
      'Additional discretionary funding may be available'
    ],
    requirements: [
      'Applicant must be from outside the United Kingdom',
      'Apply for an eligible Cambridge postgraduate degree and request Gates Cambridge consideration',
      'Meet the course and funding deadline that applies to the selected programme'
    ],
    requiredDocuments: ['Cambridge postgraduate application', 'Gates Cambridge statement', 'Gates Cambridge reference', 'Research proposal for PhD applicants where required'],
    languageRequirements: [],
    deadline: '',
    deadlineNote: 'For 2027/28 entry, US citizens resident in the US have a Gates Cambridge deadline of 14 October 2026. Other applicants must meet the funding deadline for their course; Cambridge lists main funding deadlines of 8 December 2026 and 6 January 2027.',
    summary: 'Gates Cambridge offers full-cost postgraduate scholarships to outstanding applicants from outside the UK across eligible University of Cambridge courses.',
    officialSourceUrl: 'https://www.student-funding.cam.ac.uk/fund/gates-cambridge-scholarship-2026',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  },
  {
    id: 'starter-melbourne-graduate-research-2027',
    catalogSource: 'starter',
    sourceCheckedAt: '2026-09-23',
    title: 'University of Melbourne Graduate Research Scholarships',
    provider: 'University of Melbourne',
    country: 'Australia',
    opportunityType: 'Scholarship',
    fundingType: 'Full fee offset and stipend scholarships available',
    studyLevels: ['Master by Research', 'PhD'],
    subjects: ['Graduate research across University of Melbourne study areas'],
    eligibleNationalities: [],
    benefits: [
      'Full fee offset for eligible scholarship recipients',
      'Living allowance for stipend scholarship recipients',
      'Relocation grant',
      'Overseas Student Health Cover for eligible international recipients'
    ],
    requirements: [
      'Apply for and meet the requirements of an eligible University of Melbourne graduate research degree, or be currently enrolled',
      'New applicants are automatically considered when they apply by the closing date for their graduate research course',
      'Stipend and fee-offset awards are selected competitively based on academic results and research potential'
    ],
    requiredDocuments: ['Graduate research course application and supporting documents required by the selected programme'],
    languageRequirements: [],
    deadline: '',
    deadlineNote: 'Open for automatic consideration. New applicants must apply for their graduate research course by the closing date that applies to that course.',
    summary: 'The University of Melbourne automatically considers eligible graduate-research applicants for Melbourne Research Scholarships and Research Training Program scholarships, including awards with fee offsets and stipends.',
    officialSourceUrl: 'https://scholarships.unimelb.edu.au/awards/graduate-research-scholarships',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-09-23',
    status: 'published',
    visibility: 'public'
  }

]);
