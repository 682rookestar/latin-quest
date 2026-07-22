# Record of Processing Activities and Data Map

Status: Draft

| Activity | Data subjects/data | Purpose | Role/basis | Recipients | Retention |
|---|---|---|---|---|---|
| Account creation and authentication | Pupils, teachers; name, email, ID, role, auth events, IP | Account access and security | School controller/Latin Quest processor for school accounts; legitimate interests and legal obligation where Latin Quest is controller | Supabase, Vercel and infrastructure subprocessors | Active service plus deletion/backup cycle |
| Class enrolment | Pupils, teachers; class ID, join attempts, timestamps | Authorise pupil and teacher relationship | School basis/instructions; legitimate interests for abuse prevention | Supabase | Membership while class active; failed attempts short-term |
| Exercise delivery and marking | Pupils; question IDs, submitted answers, correctness, timestamps | Provide learning and feedback | School basis/instructions | Supabase and Vercel runtime | While school uses service, then contract deletion cycle |
| Progress and personalisation | Pupils; attempts, scores, mastery, badges | Show progress and prioritise practice | School basis/instructions | Pupil, owning teacher, authorised admin, Supabase | As above |
| Class leaderboard | Pupils; display name, rank, badges/mastery total | Motivation and class comparison | School basis/instructions; necessity to be confirmed per school | Pupils in same class | Generated from current records |
| Teacher reporting/export | Pupils and teachers; name, email, attempts, progress | School assessment/reporting | School basis/instructions | Owning teacher; spreadsheet software chosen by school | Platform data per schedule; downloaded copy controlled by school |
| Administration/support | All users; account data, messages and relevant logs | Support, rights and incident response | Legitimate interests/legal obligation or school instructions | Authorised admins, Vercel/Supabase support when approved | Ticket/incident schedule |

## Data flow

1. A user's browser connects to Vercel's CDN and application runtime.
2. Authentication and application requests are sent to Supabase.
3. Supabase Auth maintains the account/session; Postgres stores class and learning
   records in the selected London region.
4. Authorised teachers request their class data through RLS-protected queries.
5. Export requests are executed by Vercel and returned as an Excel download.
6. Vendor operational logs, security systems and support may involve approved
   international subprocessors.

## Technical and organisational measures

- TLS in transit and vendor-managed encryption at rest.
- Supabase row-level security with class-owner scope.
- Service-role secrets confined to server code and deployment secrets.
- Server-authoritative exercise submission and atomic progress updates.
- Expiring, rotatable join codes with rate limiting.
- Role-based admin and teacher routes.
- Secure session cookies managed by Supabase SSR.
- Baseline HTTP security headers and London Vercel Function region.
- Documented rights, incident, retention and supplier-review procedures.
- Planned automated RLS, scoring, access and export tests.
