import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const docker = '/Applications/Docker.app/Contents/Resources/bin/docker';
const container = 'supabase_db_latin-quest-qa';
const sql = input => execFileSync(docker, ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
// Hardcoded local container and loopback URL: never accept a production target.
const status = JSON.parse(execFileSync('npx', ['--yes', 'supabase@2.117.0', 'status', '--workdir', 'tests/local', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
if (status.API_URL !== 'http://127.0.0.1:55321') throw new Error('Refusing non-QA database');
sql('create schema if not exists qa_setup; create table if not exists qa_setup.applied(name text primary key);');
const applied = new Set(sql('select name from qa_setup.applied').trim().split('\n'));
// July 12 baseline already contains the May/June migrations. Avoid replaying
// those historical policies. Keep source migration files unchanged.
const files = readdirSync('supabase/migrations').filter(f => f === '00000000_baseline.sql' || f.slice(0,8) > '20260712')
  .sort((a,b) => a.split('_')[0].padEnd(14,'0').localeCompare(b.split('_')[0].padEnd(14,'0')) || a.localeCompare(b));
for (const file of files) {
  if (applied.has(file)) continue;
  console.log(`Applying local schema: ${file}`);
  try {
    sql(`begin; set local check_function_bodies = off;\n${readFileSync('supabase/migrations/' + file, 'utf8')}\ninsert into qa_setup.applied values ('${file}'); commit;`);
  } catch (error) { console.error(error.stderr?.toString()); process.exit(1); }
}
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existing, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw listError;
for (const [name, role] of [['teacher', 'teacher'], ['admin', 'admin'], ['pupil1', 'student'], ['pupil2', 'student']]) {
  const email = `qa.${name}@hallifordschool.co.uk`;
  if (!existing.users.some(u => u.email === email)) {
    const { error } = await admin.auth.admin.createUser({ email, password: 'Local-QA-Only!7294', email_confirm: true, user_metadata: { display_name: `QA ${name}` } });
    if (error) throw error;
  }
  sql(`update public.profiles set role='${role}' where email='${email}';`);
}
sql(readFileSync('tests/local/seed.sql', 'utf8'));
console.log('Local QA schema and dummy accounts ready. No production data copied.');
