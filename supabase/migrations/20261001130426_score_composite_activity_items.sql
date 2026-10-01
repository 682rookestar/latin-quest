-- Composite activities, such as word sorting, contain several independently
-- markable items inside one exercise question. Keep one answer row for the
-- question, but calculate attempt and mastery totals from server-supplied
-- point counts. Calls made by an older deployment remain one point per answer.
create or replace function public.submit_exercise_attempt(
  p_student uuid,
  p_exercise_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exercise record;
  v_attempt_id uuid;
  v_correct integer;
  v_total integer;
  v_answer_count integer;
  v_valid_questions integer;
  v_score_pct integer;
  v_badge boolean := false;
  v_skill_row record;
  v_avg numeric;
begin
  if p_student is null or not exists (
    select 1 from public.profiles where id = p_student and role = 'student'
  ) then
    raise exception 'invalid_student';
  end if;

  select id, chapter_id, skill_id, is_boss
    into v_exercise
    from public.exercises
   where id = p_exercise_id;
  if not found then raise exception 'exercise_not_found'; end if;

  if not exists (select 1 from public.class_members where student_id = p_student) then
    raise exception 'student_not_enrolled';
  end if;

  if not exists (
    select 1
      from public.class_members cm
     where cm.student_id = p_student
       and not exists (
         select 1 from public.class_chapter_locks ccl
          where ccl.class_id = cm.class_id
            and ccl.chapter_id = v_exercise.chapter_id
       )
  ) then
    raise exception 'chapter_locked';
  end if;

  if jsonb_typeof(p_answers) <> 'array' then raise exception 'invalid_answers'; end if;
  v_answer_count := jsonb_array_length(p_answers);
  if v_answer_count < 1 or v_answer_count > 100 then raise exception 'invalid_answer_count'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_answers) a
     where jsonb_typeof(a -> 'question_id') <> 'string'
        or jsonb_typeof(a -> 'student_answer') <> 'string'
        or jsonb_typeof(a -> 'is_correct') <> 'boolean'
        or (a ? 'points_earned' and (
          jsonb_typeof(a -> 'points_earned') <> 'number'
          or (a ->> 'points_earned') !~ '^\d+$'
        ))
        or (a ? 'points_possible' and (
          jsonb_typeof(a -> 'points_possible') <> 'number'
          or (a ->> 'points_possible') !~ '^\d+$'
        ))
        or coalesce((a ->> 'points_possible')::integer, 1) not between 1 and 100
        or coalesce((a ->> 'points_earned')::integer,
          case when (a ->> 'is_correct')::boolean then 1 else 0 end
        ) not between 0 and coalesce((a ->> 'points_possible')::integer, 1)
  ) then
    raise exception 'invalid_answer_shape';
  end if;

  if (
    select count(distinct a ->> 'question_id') from jsonb_array_elements(p_answers) a
  ) <> v_answer_count then
    raise exception 'duplicate_question';
  end if;

  select count(*) into v_valid_questions
    from jsonb_array_elements(p_answers) a
    join public.exercise_questions eq on eq.id = (a ->> 'question_id')::uuid
    join public.exercises source_ex on source_ex.id = eq.exercise_id
   where (
     (not v_exercise.is_boss and source_ex.id = p_exercise_id)
     or (v_exercise.is_boss and source_ex.chapter_id = v_exercise.chapter_id and source_ex.is_boss = false)
   );
  if v_valid_questions <> v_answer_count then raise exception 'question_not_in_exercise'; end if;

  select
    sum(coalesce((a ->> 'points_earned')::integer,
      case when (a ->> 'is_correct')::boolean then 1 else 0 end)),
    sum(coalesce((a ->> 'points_possible')::integer, 1))
    into v_correct, v_total
    from jsonb_array_elements(p_answers) a;

  v_score_pct := round(v_correct::numeric / v_total * 100);

  insert into public.attempts
    (student_id, exercise_id, completed_at, score_pct, total_questions, correct_questions)
  values
    (p_student, p_exercise_id, now(), v_score_pct, v_total, v_correct)
  returning id into v_attempt_id;

  insert into public.attempt_answers
    (attempt_id, question_id, student_answer, is_correct)
  select
    v_attempt_id,
    (a ->> 'question_id')::uuid,
    left(a ->> 'student_answer', 5000),
    (a ->> 'is_correct')::boolean
  from jsonb_array_elements(p_answers) a;

  for v_skill_row in
    select
      source_ex.skill_id as skill_id,
      sum(coalesce((a ->> 'points_possible')::integer, 1)) as attempts,
      sum(coalesce((a ->> 'points_earned')::integer,
        case when (a ->> 'is_correct')::boolean then 1 else 0 end)) as correct
    from jsonb_array_elements(p_answers) a
    join public.exercise_questions eq on eq.id = (a ->> 'question_id')::uuid
    join public.exercises source_ex on source_ex.id = eq.exercise_id
   where source_ex.skill_id is not null
   group by source_ex.skill_id
  loop
    perform public.upsert_skill_progress(
      p_student,
      v_exercise.chapter_id,
      v_skill_row.skill_id,
      v_skill_row.attempts::integer,
      v_skill_row.correct::integer
    );
  end loop;

  select avg(mastery) into v_avg
    from public.skill_progress
   where student_id = p_student and chapter_id = v_exercise.chapter_id;

  if v_avg is not null and v_avg >= 4 then
    insert into public.chapter_badges (student_id, chapter_id)
    values (p_student, v_exercise.chapter_id)
    on conflict (student_id, chapter_id) do nothing;
    v_badge := found;
  end if;

  return jsonb_build_object(
    'score_pct', v_score_pct,
    'correct', v_correct,
    'total', v_total,
    'badge_earned', v_badge
  );
end;
$$;

revoke all on function public.submit_exercise_attempt(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_exercise_attempt(uuid, uuid, jsonb) to service_role;
