import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Validate the full migration against a temporary reconstruction inside ONE
// transaction, then roll back. No existing QA workflow/history is removed.
const status = JSON.parse(execFileSync('npx', ['--yes', 'supabase@2.117.0', 'status', '--workdir', 'tests/local', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
if (status.API_URL !== 'http://127.0.0.1:55321') throw new Error('Refusing a non-local database');
const migration = readFileSync('supabase/migrations/20261016172832_student_temporary_passwords.sql', 'utf8');
const reconstruct = `
DO $$ DECLARE v_name text; v_identity text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['join_class_by_code','get_class_leaderboard','get_standard_progress','locked_chapters_for_me'] LOOP
    SELECT pg_get_function_identity_arguments(p.oid) INTO v_identity
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'latin_quest_private' AND p.proname = 'legacy_' || v_name;
    IF v_identity IS NULL THEN RAISE EXCEPTION 'Expected the local password migration to be applied'; END IF;
    EXECUTE format('DROP FUNCTION public.%I(%s)', v_name, v_identity);
    EXECUTE format('ALTER FUNCTION latin_quest_private.%I(%s) SET SCHEMA public', 'legacy_' || v_name, v_identity);
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', 'legacy_' || v_name, v_identity, v_name);
  END LOOP;
END $$;
DROP FUNCTION public.student_password_status();
DROP FUNCTION public.begin_student_password_operation(uuid,uuid,text,uuid);
DROP FUNCTION public.finish_student_password_operation(uuid,uuid,boolean);
DROP SCHEMA latin_quest_private CASCADE;
`;
execFileSync('/Applications/Docker.app/Contents/Resources/bin/docker', ['exec', '-i', 'supabase_db_latin-quest-qa', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], {
  input: `BEGIN; SET LOCAL client_min_messages = warning;\n${reconstruct}\n${migration}\nROLLBACK;`,
  encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
});
console.log('Full temporary-password migration validated successfully; all changes rolled back. Local QA history retained.');
