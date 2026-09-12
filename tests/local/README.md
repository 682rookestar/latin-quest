# Local Latin Quest QA — Docker Desktop

This environment contains dummy users only. It is not linked to a cloud Supabase project. The production `.env.local` is not modified: the QA launcher overrides the database settings in the child process and refuses any API URL except `http://127.0.0.1:55321`.

## Start

1. Open Docker Desktop.
2. Run `npm run qa:start`.
3. Run `npm run qa:setup` (safe to rerun; it does not reset saved QA attempts).
4. Run `npm run qa:app`.

On a Mac where Docker is not on PATH, first run `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"`.

- Application: http://127.0.0.1:3100
- Local database console: http://127.0.0.1:55323
- Captured test emails: http://127.0.0.1:55324

## Dummy accounts — local use only

Password for the four dummy accounts: `Local-QA-Only!7294`

- `qa.pupil1@hallifordschool.co.uk`
- `qa.pupil2@hallifordschool.co.uk`
- `qa.teacher@hallifordschool.co.uk`
- `qa.admin@hallifordschool.co.uk`

These are synthetic accounts created only in Docker, not real school accounts. Teacher/admin accounts still require MFA enrolment; this setup does not bypass staff authorization. Email is captured by the local mailbox. AI API credentials are blanked by the QA launcher; paid AI report generation is outside this local setup.

The initial fixture has one class and one 20-question multiple-choice exercise. This is a foundation for browser/database tests, not full curriculum coverage. The local schema uses the repository's July baseline plus later migrations, not a production backup; any schema drift must be reviewed before claiming full production equivalence.

## Initial verification

A dummy pupil signed in through the browser and completed all 20 questions. Each question appeared exactly once. The browser showed 100%, and the local database independently confirmed one saved attempt with 20 correct answers and 20 distinct question IDs. This verifies the basic browser → server → database → result path, not yet all activity types, interruptions, staff dashboards or classroom load.

## Repeat-attempt and double-click verification

A second browser run used **Try again** and alternated correct and incorrect answers. All 20 distinct questions appeared exactly once. Double-clicking Check, Next, and the final Finish button did not skip questions or create an extra saved attempt in this run. Incorrect-answer feedback displayed `girl`, not a dash. The result screen showed **50%, 10 of 20 correct**; an independent local database query confirmed score 50, total 20, correct 10, and 20 distinct saved answers. The first 100% attempt remained unchanged, with exactly two attempts in the fixture database.

These are observed browser results, not proof of server-side replay protection or coverage of all timing conditions. Connection loss, all other activity types, staff dashboards, and concurrent classroom traffic still need separate testing.

## Service-outage and activity-input verification

Stopped only `supabase_rest_latin-quest-qa` while the dummy pupil had an answer selected. Check eventually displayed a session/class-access error, did not mark the answer incorrect, and did not advance the question. After restarting the container, pressing Check without reselecting the answer returned Correct on the same question. The API was restored after testing. This tests a backend service outage, not a disconnected browser or loss of the save response after a database commit. The error wording is misleading for this failure mode.

The runner regression suite now has 18 passing tests, including all eight option-based activity variants, typed translation/free-text gap answers with macrons preserved across a failed check, and word-sort JSON serialization and selection reset. These component tests mock server actions; they do not establish curriculum-answer accuracy or end-to-end database coverage for each activity.

## Interrupted final save

Completed 20 correct answers in the browser, then stopped only the local REST API before clicking Finish. The UI showed saving progress followed by the recoverable “Your answers are ready to save” screen. The database still contained the original two attempts: no partial attempt was created. Restarted the API and clicked Retry saving results. The browser showed 100%, 20 of 20 correct, with all answers in the review. An independent database query confirmed exactly one additional attempt with score 100, total 20, correct 20 and 20 distinct answer records. The API was left running.

The full unit suite at this stage passed 105 tests with one optional suite skipped. Some security tests characterize known gaps, so this is not a security clearance. This outage occurred before a database commit; lost responses after a successful commit and server-side replay/idempotency remain unverified. Closing or refreshing the page during an unfinished attempt is not covered by this recovery result.

## Reload recovery and two-tab concurrency

**Recovery gap:** completed three questions, reached Question 4, then reloaded the same exercise URL. The app restarted at Question 1 with a freshly shuffled set. The unfinished answers were not restored. The runner keeps progress in React state and has no session/local storage persistence or unload warning. Saved attempts were unaffected. A recovery design should preserve a per-tab draft, bind it to the signed-in user and exercise, expire it safely, and revalidate answers server-side; browser storage must never become authoritative for scores.

**Two-tab test passed in this run:** opened two attempts under the same dummy pupil account. Each displayed 20 distinct questions once. One tab answered everything correctly, the other everything incorrectly. Issued both Finish clicks concurrently; screens showed 100% (20/20) and 0% (0/20). The database contained exactly two additional attempts, each with 20 distinct answers and the corresponding score. Existing attempts remained intact. This is a two-tab isolation test, not a classroom load benchmark or proof of replay protection, aggregate mastery correctness, or cross-user isolation.

## Refresh recovery implementation (not deployed)

The runner now retains one unfinished exercise per browser tab using sessionStorage, bound to the server-provided pupil ID and exercise ID. It preserves the question order, completed answers and current selection, expires drafts after 24 hours of inactivity, rejects malformed/other-account drafts and removes the draft after successful saving. Refresh restores the current question but requires checking its answer again. This is refresh recovery, not guaranteed recovery after closing the tab or moving devices. Starting a different exercise in the same tab replaces the draft.

A browser check confirmed Question 4 and its selected wrong answer survived reload; checking again returned the expected answer from the server. The final end-to-end browser save verification was interrupted by browser-control timeouts and closure of the local session. A component regression covers remount with reshuffled incoming props, completion with all 20 original IDs, and draft removal after successful saving. No correctness flags or final scores are trusted from browser storage. Refresh during an uncertain save shows a warning to check saved history before manually retrying; server-side idempotency remains separate work.

## Recovered save: completed end-to-end

The subsequent browser test completed successfully: three correct answers, a wrong selection on Question 4, reload, recheck the restored selection, then complete the remaining questions correctly. All 20 distinct prompts appeared once. The result was 95% (19/20), independently confirmed in Docker as `95|20|19|20|20` (score, total, correct, answer rows, distinct IDs). This supersedes the earlier incomplete final-save verification. A follow-up browser reload check hit local browser-control timeouts; component coverage verifies draft removal on success.

Access hardening now rejects failed/null chapter-lock lookups in the page and server actions, plus malformed submission payloads. Partial completion and replay remain known gaps: resolving those requires a server-issued question set and an atomic, durable idempotency record, not merely a disabled Finish button. No changes in this section have been deployed to production.

## Signed attempts and duplicate-save protection (local only)

Each server-rendered exercise now issues a signed, 24-hour ticket bound to the pupil, exercise, original ordered question IDs and a unique attempt UUID. The runner pins it alongside the question set and retains it in the refresh draft. Submit rejects missing/altered/expired tickets and partial, reordered or substituted question sets, then rechecks access and marks answers from canonical database data. Try again reloads to obtain a new ticket. Drafts from before tickets were introduced cannot be submitted and restart when reloaded.

`submit_exercise_attempt_once` stores a server-only receipt in the same transaction as the score. An advisory transaction lock serializes requests with the same ticket. Identical retries return the original result; changed raw answers or a different owner/exercise are rejected. RLS is enabled and anon/authenticated have neither table access nor function execution permission. Receipt rows follow profile/exercise deletion through cascading foreign keys. This does not prevent pupils learning answers from the intentional Check feedback, or legitimately starting new attempts.

Verified locally:

- Eight concurrent identical submissions plus a post-commit replay created exactly one attempt and returned the same result.
- A changed-answer replay was rejected without another score.
- The local security advisor reported no issues.
- A browser run refreshed at Question 4, restored its ticket and question order, and saved 100% with 20 answers. Try again then saved a separate 0% attempt with 20 answers. Both receipts were independently verified in Docker.
- Repeat the database test using `npm run qa:verify-retries`; it deliberately adds one synthetic attempt per run.

Deployment order: apply `supabase/migrations/20260912080825_exercise_submission_receipts.sql` to the intended environment, then deploy the matching app code. Do not deploy the app first: its submission RPC requires this migration. No production deployment or migration has been performed. Classroom load, all activity types end-to-end, school devices and expired-login recovery remain separate tests.

## Thirty-pupil database concurrency test

`npm run qa:verify-classroom` creates/reuses 30 synthetic `qa.loadNN` pupil accounts in Docker, joins them to the dummy class, and sends 30 concurrent server-role submission RPCs with independently varied scores. It checks exactly one new attempt per pupil, 600 distinct-per-attempt answer records, correctness totals, receipt counts, and saved-score ownership. Two authenticated pupil identities are also checked through RLS to ensure they cannot select other pupils' attempts. Each run intentionally retains one additional dummy attempt per pupil. It never targets production and does not send invitation emails.

Latest extended run passed: 30 pupils, 30 attempts, 600 answers, 629 ms concurrent-save wall time, 540 ms median and 605 ms p95 including local Docker/psql overhead. An initial harness query referenced `created_at` instead of the real `started_at`; it was corrected before successful reruns. These timings cover only local database RPCs, not 30 browser sessions, Next.js server actions, authentication throughput, cloud-network latency or Vercel/Supabase production capacity. Full classroom end-to-end load remains outstanding.

If npx cannot resolve the registry, set `SUPABASE_CLI` to an already installed Supabase CLI executable; the script still refuses any backend URL other than the hardcoded local QA URL.

## Activity browser fixtures and current coverage

`tests/local/activity-fixtures.sql` supplies ten synthetic two-question exercises (IDs ending 10–19): vocabulary match, option gap, tense, case, adjective, adverb, picture, translation, word sorting and typed gap. It also supplies a synthetic boss exercise (ID ending 20), which samples from the chapter's normal non-boss question pool through the real boss route. They test interaction branches, not curriculum accuracy. Apply only to the local QA container.

Browser coverage passed for all ten synthetic activity fixtures. Each fixture was completed with one correct and one wrong answer, displayed the expected 50% / 1 of 2 result, and was independently confirmed in Postgres with score 50, one correct answer, two total answers, two saved rows and two distinct question IDs. Covered branches: vocabulary match, option gap, tense, case, adjective, adverb, picture, translation, word sorting and typed gap. The typed-gap test also verified that `amāt` is accepted as correct against canonical `amat`, that an incorrect `amant` displays expected `amat`, and that the save interstitial appears after Finish.

Boss-round browser coverage passed after adding the local boss fixture. The route sampled 15 questions from the chapter, mixed baseline multiple-choice and fixture question types, excluded word sort and picture questions as intended, and completed with 100% / 15 of 15. Postgres confirmed score 100, 15 correct answers, 15 total answers, 15 saved rows and 15 distinct question IDs.

During the browser run the local Next dev server stopped, causing Check to show the recoverable “couldn’t check” message without marking the answer incorrect. After the QA app was restarted, the exercise restored and completed correctly. Mythica's local containers were temporarily stopped to reduce local load during testing and then restarted. This is local-environment evidence only; no production services were touched.

## Stop the environment

Stop the application with Ctrl+C, then `npm run qa:stop`. This retains the local database. Do not use `--linked`, `db push`, or a production URL with QA scripts. Do not expose these local services to the internet or put real pupil data into them.
