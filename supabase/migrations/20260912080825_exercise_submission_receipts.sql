-- Server-only atomic duplicate-submission protection.
create table if not exists public.exercise_submission_receipts (
  ticket_id uuid primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  answers jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.exercise_submission_receipts enable row level security;
revoke all on public.exercise_submission_receipts from public, anon, authenticated;
grant select, insert, delete on public.exercise_submission_receipts to service_role;
create index if not exists exercise_receipts_student_idx on public.exercise_submission_receipts(student_id);
create index if not exists exercise_receipts_exercise_idx on public.exercise_submission_receipts(exercise_id);

create or replace function public.submit_exercise_attempt_once(
  p_ticket uuid, p_student uuid, p_exercise_id uuid, p_answers jsonb, p_results jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  previous public.exercise_submission_receipts%rowtype;
  result jsonb;
  raw_answers jsonb;
begin
  if p_ticket is null or p_student is null or p_exercise_id is null then
    raise exception 'invalid_attempt';
  end if;
  -- Serialize retries for this ticket. The receipt and score commit together.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ticket::text, 0));
  select jsonb_agg(jsonb_build_object('question_id', a->>'question_id', 'student_answer', a->>'student_answer') order by ord)
    into raw_answers from jsonb_array_elements(p_answers) with ordinality as rows(a, ord);
  select * into previous from public.exercise_submission_receipts where ticket_id = p_ticket;
  if found then
    if previous.student_id <> p_student or previous.exercise_id <> p_exercise_id or previous.answers is distinct from raw_answers then
      raise exception 'attempt_payload_conflict';
    end if;
    return previous.result;
  end if;
  result := public.submit_exercise_attempt(p_student, p_exercise_id, p_answers)
    || jsonb_build_object('results', p_results);
  insert into public.exercise_submission_receipts(ticket_id, student_id, exercise_id, answers, result)
    values(p_ticket, p_student, p_exercise_id, raw_answers, result);
  return result;
end;
$$;
revoke all on function public.submit_exercise_attempt_once(uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.submit_exercise_attempt_once(uuid, uuid, uuid, jsonb, jsonb) to service_role;
