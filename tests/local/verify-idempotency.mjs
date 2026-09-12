import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const exec = promisify(execFile);
// Deliberately no configurable host: this can only reach the named QA container.
const docker = '/Applications/Docker.app/Contents/Resources/bin/docker';
async function sql(query) {
  const { stdout } = await exec(docker, ['exec', 'supabase_db_latin-quest-qa', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query]);
  return stdout.trim();
}
const pupil = await sql("select id from auth.users where email='qa.pupil1@hallifordschool.co.uk'");
assert.match(pupil, /^[0-9a-f-]{36}$/);
const exercise = '40000000-0000-4000-8000-000000000001';
const ticket = randomUUID();
const answers = Array.from({length:20}, (_, i) => ({ question_id: `50000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`, student_answer:'girl', is_correct:true }));
const results = answers.map(a => ({question_id:a.question_id, is_correct:true, correct_answer:'girl'}));
const count = () => sql(`select count(*) from public.attempts where student_id='${pupil}'`);
const before = Number(await count());
const call = (payload = answers) => `set role service_role; select public.submit_exercise_attempt_once('${ticket}','${pupil}','${exercise}','${JSON.stringify(payload)}'::jsonb,'${JSON.stringify(results)}'::jsonb);`;
const responses = await Promise.all(Array.from({length:8}, () => sql(call())));
assert.equal(new Set(responses).size, 1, 'Concurrent retries must return the same stored result');
assert.equal(Number(await count()), before + 1, 'Exactly one attempt must be written');
await sql(call()); // simulate a response lost after commit, followed by a retry
assert.equal(Number(await count()), before + 1);
await assert.rejects(sql(call(answers.map((a,i) => i === 0 ? {...a, student_answer:'boy'} : a))), /attempt_payload_conflict/);
assert.equal(Number(await count()), before + 1);
const permissions = await sql("select has_function_privilege('authenticated','public.submit_exercise_attempt_once(uuid,uuid,uuid,jsonb,jsonb)','execute'),has_table_privilege('authenticated','public.exercise_submission_receipts','select'),relrowsecurity from pg_class where oid='public.exercise_submission_receipts'::regclass");
assert.equal(permissions, 'f|f|t');
console.log('PASS: 8 concurrent saves + replay created exactly one attempt; changed payload rejected; pupil access denied; RLS enabled.');
