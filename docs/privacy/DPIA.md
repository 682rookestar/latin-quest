# Data Protection Impact Assessment — Latin Quest

Status: Draft requiring operator and school approval  
Owner: [PRIVACY OWNER]  
Review date: Before first school use, after material changes, and at least annually

## 1. Screening decision

A full DPIA is required because Latin Quest is an online educational service
designed for children and systematically records answers, attainment, mastery and
class rankings. Children may have limited choice where a school introduces the
service, and poor access controls or inaccurate scoring could cause privacy,
educational, emotional or reputational harm.

## 2. Processing description

Latin Quest authenticates pupils and teachers, enrols pupils into classes using a
teacher-controlled code, serves learning activities, records submitted answers,
calculates progress and badges, shows a class leaderboard, provides teacher views,
and creates downloadable reports.

Data subjects include pupils, teachers, administrators and people who contact
support. Data includes identity/contact data, class relationships, submitted
answers, attainment, authentication events, IP addresses and security logs.

The main database is configured in Supabase's AWS London region. The application
is hosted by Vercel with its Function region pinned to London. Both suppliers and
their subprocessors may process limited information internationally.

## 3. Roles and consultation

For school-directed use, the school is expected to act as controller and Latin
Quest as processor. Latin Quest may act as controller for independently determined
security, service administration and legal-compliance purposes. This allocation
must be confirmed contractually rather than assumed.

Consultation record:

| Party | Consultation required | Outcome |
|---|---|---|
| Operator/security owner | Yes | [PENDING] |
| Participating school DPO/privacy lead | Yes | [PENDING] |
| Teachers | Recommended | [PENDING] |
| Pupils of representative ages | Recommended | [PENDING] |
| Parents/carers | Where appropriate | [PENDING] |

## 4. Necessity and proportionality

| Processing | Necessity | Minimisation/control |
|---|---|---|
| Name and email | Identify and secure accounts | Do not collect DOB, address or phone number |
| Class membership | Authorise teacher access and learning context | Teachers limited to classes they own |
| Answers and scores | Mark work and identify learning needs | No special-category data requested; answer length limited |
| Mastery and adaptive ordering | Personalise practice | Used only for learning; no significant automated decisions |
| Leaderboard | Optional motivation | Review necessity with schools; show limited information only |
| Excel export | School reporting | Owner-only access; schools control downloaded copies |
| Security logs | Detect abuse and investigate incidents | Time-limited access and retention |

Less intrusive alternatives considered include pupil aliases, removing email from
teacher exports, disabling leaderboards per class, aggregated analytics, and
shorter answer retention. Schools should be offered configuration choices where
these alternatives better serve pupils' interests.

## 5. Risk assessment

Scoring: likelihood and impact are rated Low, Medium or High after existing
controls. Actions marked Open must be completed or formally accepted.

| Risk | People affected | Existing mitigation | Residual risk | Action/status |
|---|---|---|---|---|
| Teacher accesses unrelated pupils | Pupils | Owner-scoped UI and RLS migration | Low | Deploy and verify migration — Open |
| Pupil forges scores or badges | Pupils, teachers | Server-only submission RPC, validation and transactions | Low | Deploy migration and penetration-test — Open |
| Join code is guessed/shared | Pupils | Long codes, expiry, rotation and rate limiting | Medium | Add monitoring and school guidance — Open |
| Leaderboard causes embarrassment or unwanted disclosure | Pupils | Class-only visibility and limited fields | Medium | Add class-level disable/pseudonym option — Open |
| Export is sent to the wrong recipient or retained locally | Pupils | Owner-only download | Medium | Add export guidance/audit log — Open |
| Incorrect marking affects educational judgement | Pupils | Canonical scoring and review feedback | Medium | Automated curriculum/scoring regression tests — Open |
| Account takeover | All users | Supabase authentication, secure cookies and TLS; 12-character application minimum and mandatory TOTP MFA for teachers/admins implemented | Low | Deploy auth migration; enable leaked-password protection and matching 12-character provider policy — Open |
| International processing is not transparent or safeguarded | All users | Revised notice, supplier DPAs and transfer mechanisms | Medium | Complete vendor/transfer review — Open |
| Excessive retention | Pupils | Cascading account deletion and schedule | Medium | Implement annual review and evidence deletions — Open |
| Special-category data entered into free text | Pupils | Not requested; notice warns against entry | Medium | Add input guidance and incident process — Open |
| Service failure loses or duplicates progress | Pupils | Atomic database transaction | Low | Add offline/idempotency automated tests — Open |
| Administrator misuses broad access | All users | Restricted admin role | Medium | MFA, audit logging and periodic access review — Open |

## 6. Children's Code assessment summary

The service is child-directed and should apply the Code as the design baseline.
Current strengths include limited data collection, no advertising, no geolocation,
no public social features and owner-scoped teacher access. Remaining priorities
are configurable leaderboards, documented child consultation, age-appropriate
notices, audit logging, retention evidence and privacy/security testing.

## 7. Decision

The planned processing can proceed only after High-risk access and score-integrity
controls are deployed and verified, supplier contracts and transfers are reviewed,
and a school/operator owner signs this DPIA. Unmitigated High residual risk must be
escalated for specialist advice and, where legally required, prior ICO consultation.

Sign-off:

| Role | Name | Decision/date |
|---|---|---|
| Operator | [NAME] | [PENDING] |
| Privacy lead/DPO | [NAME] | [PENDING] |
| School controller | [NAME/SCHOOL] | [PENDING] |
