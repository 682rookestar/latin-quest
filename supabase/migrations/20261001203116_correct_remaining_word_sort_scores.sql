-- Correct every legacy all-or-nothing word-sort attempt not handled by the
-- initial 7J correction. The total_questions = 1 predicate makes this
-- idempotent and excludes attempts already using item-level scoring.
create temporary table corrected_remaining_word_sort_attempts on commit drop as
select
  a.id as attempt_id,
  a.student_id,
  e.chapter_id,
  e.skill_id,
  a.correct_questions as old_correct,
  a.total_questions as old_total,
  count(*) filter (
    where aa.student_answer::jsonb ->> (word ->> 'word') = word ->> 'type'
  )::integer as new_correct,
  count(*)::integer as new_total
from public.attempts a
join public.exercises e
  on e.id = a.exercise_id
 and e.game_type = 'word_type_sort'
join public.attempt_answers aa on aa.attempt_id = a.id
join public.exercise_questions q on q.id = aa.question_id
cross join lateral jsonb_array_elements(q.metadata -> 'words') word
where a.total_questions = 1
group by a.id, a.student_id, e.chapter_id, e.skill_id;

do $$
begin
  if exists (
    select 1 from corrected_remaining_word_sort_attempts
    where new_total < 1 or new_correct < 0 or new_correct > new_total
  ) then
    raise exception 'Invalid corrected word-sort totals';
  end if;
end;
$$;

update public.attempts a
set
  correct_questions = correction.new_correct,
  total_questions = correction.new_total,
  score_pct = round(correction.new_correct::numeric / correction.new_total * 100)
from corrected_remaining_word_sort_attempts correction
where a.id = correction.attempt_id;

with progress_delta as (
  select
    student_id,
    chapter_id,
    skill_id,
    sum(new_correct - old_correct)::integer as correct_delta,
    sum(new_total - old_total)::integer as attempts_delta
  from corrected_remaining_word_sort_attempts
  where skill_id is not null
  group by student_id, chapter_id, skill_id
)
update public.skill_progress progress
set
  correct = progress.correct + delta.correct_delta,
  attempts = progress.attempts + delta.attempts_delta,
  mastery = least(
    5,
    greatest(
      0,
      ((progress.correct + delta.correct_delta) * 5)
        / nullif(progress.attempts + delta.attempts_delta, 0)
    )
  )
from progress_delta delta
where progress.student_id = delta.student_id
  and progress.chapter_id = delta.chapter_id
  and progress.skill_id = delta.skill_id;

insert into public.chapter_badges (student_id, chapter_id)
select progress.student_id, progress.chapter_id
from public.skill_progress progress
where progress.student_id in (
  select distinct student_id from corrected_remaining_word_sort_attempts
)
group by progress.student_id, progress.chapter_id
having avg(progress.mastery) >= 4
on conflict (student_id, chapter_id) do nothing;
