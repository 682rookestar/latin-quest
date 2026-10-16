# Teacher-issued temporary pupil passwords

Release scope: teacher-issued temporary pupil passwords and the required password-change flow. The Chapter 1 visual pilot is excluded. Deployment status is recorded in the Vercel deployment history; publishing this feature does not itself reset any pupil password or alter learning records.

## How it works

1. A teacher signs in with MFA and opens **Teacher admin**.
2. They select **Reset password** beside a pupil in one of their active classes and confirm the reset.
3. A random 16-character temporary password is shown only in that result. The teacher copies it and shares it privately with the pupil or an authorised adult. Leaving/reloading the page loses the displayed secret; it cannot be retrieved from the database. A replacement reset invalidates the earlier credential.
4. The pupil signs in with their usual email address and the temporary password. Existing authenticator factors remain required.
5. The pupil must enter the temporary password and choose/confirm a different password of 12–128 characters before using learning activities. Supabase's configured password checks still apply. The temporary credential expires after 24 hours for completing this process; an expired reset needs a new teacher-issued password.

Email delivery and recovery links are not used by this teacher flow. The existing administrator recovery-link flow is unchanged. Email verification is not bypassed. Teachers can neither retrieve the pupil's chosen password nor see it after the change.

## Security and failure handling

- Server-side teacher role, active-account, MFA, active-class ownership and pupil-role checks are mandatory. The database repeats the active-class check before starting an operation.
- Password hashes remain managed by Supabase Auth. The private workflow table stores no plaintext password, password hash or JWT.
- Teacher resets have an audit record, expiry, per-pupil and per-teacher rate limits. The displayed secret is not put in URLs, logs, audit records, localStorage or sessionStorage. Copying it uses the teacher's clipboard.
- Global session revocation uses the supported Supabase Auth admin API. Database session-age checks also block old JWTs immediately from learning data after a reset/change.
- Required-change gates exist in middleware, the password action, restrictive RLS policies, and guarded pupil-facing RPCs. Own profile identity remains readable for routing. Changing browser metadata cannot clear the gate.
- A short database operation lease serialises Auth changes across concurrent requests. A stale operation cannot complete a newer reset. Failed or uncertain changes remain restricted; teachers can retry after a lease expires (two minutes).
- Wrong temporary-password checks are rate-limited. If a form reports an error, re-enter its password fields; secrets are not saved for recovery.
- Scores, attempts, mastery, badges and class membership are not changed by this feature.

## Verification commands

Use the Docker-only setup described in `tests/local/README.md`. No command below targets the linked/live database.

```sh
npm run qa:start
npm run qa:setup
npm run qa:app
npm test
npm run test:e2e -- tests/e2e/student-temporary-password.spec.ts tests/e2e/exercise-session-resilience.spec.ts tests/e2e/privacy-and-access.spec.ts --workers=1
node tests/local/verify-password-migration.mjs
npx --yes supabase@2.117.0 db advisors --local --workdir tests/local --type security --level warn
npm run build
```

The password browser tests create synthetic school-domain accounts/classes only in Docker and retain those fixtures. Test snapshots may contain dummy credentials and must not be published. The manually captured teacher screenshot masks the dummy temporary password.

### Verification report — 16 October 2026

Story: an MFA-verified teacher resets an owned pupil through the teacher UI; Supabase Auth updates the credential, the private database workflow restricts access, and the pupil replaces the temporary password before completing a normal activity.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Teacher UI → server | Passed | Real teacher sign-in, authenticator enrolment/verification and Reset password click returned a masked-in-screenshot 16-character secret. |
| Server → Auth/database | Passed | Old password rejected; old sessions lost learning access; a successful audit record contained no temporary password. |
| Pupil sign-in → required change | Passed | Direct exercise navigation returned to the mandatory password form. Wrong temporary credentials, expired resets and direct RPC/table bypass attempts were rejected. |
| New password → normal learning | Passed | Temporary password stopped working; the new password opened learning. A complete 20-question attempt saved 100% alongside the unchanged earlier 80% dummy result. |
| Existing learning records | Passed | Seeded scores, mastery, badges and class membership were still present immediately after the reset. |
| MFA/concurrency | Passed | Existing pupil MFA remained required before and after the change, including direct database access. Another teacher, overlapping operations and stale completion were rejected. |
| Regression | Passed | 12 browser checks across password, session-resilience and privacy/access suites; the expanded four password checks passed again with the complete activity/save assertion. 159 unit tests passed; one existing optional suite remained skipped. |
| Build/migration/security | Passed | Production build succeeded. Full migration replay succeeded in a rollback-only local transaction. Local security advisors reported no warnings/errors. |

Screenshots are in `.codex-artifacts/password-reset/`. These are local Chromium/Docker results, not evidence of a live deployment or full school-device/browser coverage.

The isolated password-only release snapshot also passed all 143 applicable unit tests (one existing optional test skipped) and a production build, with all visual-pilot changes excluded.

API references: [Supabase admin password updates](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [session revocation](https://supabase.com/docs/reference/javascript/auth-admin-signout), [session lifetime and access-token limitations](https://supabase.com/docs/guides/auth/sessions).

## Password-only release boundary — do not publish the visuals

Apply `supabase/migrations/20261016172832_student_temporary_passwords.sql` **before** deploying the password app code. The new app fails closed if the required status RPC is absent. Verify production schema drift before applying the migration; the local database is not a production clone.

Runtime files for a password-only release:

- `app/teacher/admin/actions.ts`
- `app/teacher/admin/page.tsx`
- `app/teacher/admin/ResetStudentPasswordButton.tsx`
- `app/account/page.tsx`
- `app/account/change-password/actions.ts`
- `app/account/change-password/page.tsx`
- `app/account/change-password/TemporaryPasswordForm.tsx`
- `app/login/page.tsx`
- `app/mfa/verify/page.tsx`
- `lib/student-password.ts`
- `lib/student-password-reset.ts`
- `lib/temporary-password.ts`
- `lib/supabase/middleware.ts`
- `next.config.js` (loopback redirect-normalisation fix is QA-only)
- The migration above.

Include the password-specific tests and this guide in source control as appropriate. Do not sweep the whole dirty worktree into a release: it also contains the unreleased visual work and unrelated teacher-guide artifacts. In particular, exclude the current changes to `app/globals.css`, `app/layout.tsx`, chapter/exercise pages, `components/ExerciseRunner.tsx`, `lib/security.ts`, all chapter-quest components/helpers and `public/quests/` from a password-only release.

Future migrations must retain the password-access guard on new private pupil data and pupil-facing privileged RPCs. Do not expose the `latin_quest_private` schema through the Data API.
