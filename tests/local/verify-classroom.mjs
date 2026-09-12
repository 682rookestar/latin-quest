import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const exec = promisify(execFile);
const docker = '/Applications/Docker.app/Contents/Resources/bin/docker';
const statusCommand = process.env.SUPABASE_CLI || 'npx';
const statusArgs = [...(process.env.SUPABASE_CLI ? [] : ['--yes', 'supabase@2.117.0']), 'status', '--workdir', 'tests/local', '-o', 'json'];
const status = JSON.parse(execFileSync(statusCommand, statusArgs, {encoding:'utf8', stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL, 'http://127.0.0.1:55321', 'Refusing a non-local backend');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {auth:{persistSession:false, autoRefreshToken:false}});
async function sql(query) {
  const {stdout} = await exec(docker, ['exec', 'supabase_db_latin-quest-qa', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', query]);
  return stdout.trim();
}
const {data, error} = await admin.auth.admin.listUsers({page:1, perPage:1000});
if (error) throw error;
const pupils = [];
for (let i=0; i<30; i++) {
  const email = `qa.load${String(i+1).padStart(2,'0')}@hallifordschool.co.uk`;
  let user = data.users.find(u => u.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({email, password:randomUUID() + '!aA9', email_confirm:true, user_metadata:{display_name:`QA load pupil ${i+1}`}});
    if (created.error) throw created.error;
    user = created.data.user;
  }
  assert.match(user.id, /^[0-9a-f-]{36}$/);
  pupils.push(user.id);
}
await sql(`insert into public.class_members(class_id,student_id) values ${pupils.map(id=>`('30000000-0000-4000-8000-000000000001','${id}')`).join(',')} on conflict do nothing;`);
const ids = pupils.map(id=>`'${id}'`).join(',');
const counts = async () => JSON.parse(await sql(`select coalesce(jsonb_object_agg(student_id,n),'{}') from (select student_id,count(*) n from public.attempts where student_id in (${ids}) group by student_id) x`));
const before = await counts();
const runStart = await sql('select now()');
const started = performance.now();
const timings = [];
const tickets = [];
await Promise.all(pupils.map(async(pupil,i) => {
  const ticket = randomUUID(); tickets.push(ticket);
  const correct = i % 21;
  const answers = Array.from({length:20}, (_,j)=>({question_id:`50000000-0000-4000-8000-${String(j+1).padStart(12,'0')}`,student_answer:j<correct?'girl':'boy',is_correct:j<correct}));
  const results = answers.map(a=>({question_id:a.question_id,is_correct:a.is_correct,correct_answer:'girl'}));
  const start = performance.now();
  const response = JSON.parse(await sql(`set role service_role; select public.submit_exercise_attempt_once('${ticket}','${pupil}','40000000-0000-4000-8000-000000000001','${JSON.stringify(answers)}'::jsonb,'${JSON.stringify(results)}'::jsonb);`));
  timings.push(performance.now()-start);
  assert.equal(response.score_pct, correct*5);
  assert.equal(response.correct, correct);
  assert.equal(response.total, 20);
}));
const elapsed = performance.now()-started;
const after = await counts();
for (const pupil of pupils) assert.equal(Number(after[pupil])-Number(before[pupil]||0),1,'Each pupil must have exactly one new attempt');
const integrity = await sql(`select count(*) from (select a.id from public.attempts a left join public.attempt_answers aa on aa.attempt_id=a.id where a.student_id in (${ids}) and a.started_at >= '${runStart}'::timestamptz group by a.id having count(aa.*)=20 and count(distinct aa.question_id)=20 and count(*) filter(where aa.is_correct)=a.correct_questions) x`);
assert.equal(Number(integrity),30,'All 30 attempts must have 20 distinct answers and matching correctness');
const savedScores = JSON.parse(await sql(`select jsonb_object_agg(student_id,score_pct) from public.attempts where student_id in (${ids}) and started_at >= '${runStart}'::timestamptz`));
for (let i=0;i<pupils.length;i++) assert.equal(savedScores[pupils[i]],(i%21)*5,'Saved score must belong to the correct pupil');
for (const pupil of pupils.slice(0,2)) {
  const visibleOthers = await sql(`begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${pupil}","role":"authenticated","aal":"aal1"}',true); select count(*) from public.attempts where student_id <> '${pupil}'; rollback;`);
  assert.equal(visibleOthers.split('\n').at(-1),'0','Pupil must not see other pupils attempts');
}
const receipts = await sql(`select count(*) from public.exercise_submission_receipts where ticket_id in (${tickets.map(id=>`'${id}'`).join(',')})`);
assert.equal(Number(receipts),30);
timings.sort((a,b)=>a-b);
console.log(JSON.stringify({passed:true,pupils:30,attempts:30,answers:600,concurrentSaveWallMs:Math.round(elapsed),medianMs:Math.round(timings[15]),p95Ms:Math.round(timings[28]),scope:'Docker database RPC only; not browser, Next.js, Auth throughput or production capacity'},null,2));
