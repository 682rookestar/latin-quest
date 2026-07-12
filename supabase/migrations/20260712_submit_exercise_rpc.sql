-- submit_exercise_attempt
-- Writes an attempt, its per-question answers, skill-progress rollup, and
-- (optionally) a chapter badge all inside a single transaction.
--
-- The TypeScript server action scores every answer from canonical DB data
-- before calling this function.  The client never influences is_correct.
--
-- p_exercise_id : the exercise being submitted
-- p_answers     : JSON array of {question_id, student_answer, is_correct}

CREATE OR REPLACE FUNCTION public.submit_exercise_attempt(
  p_exercise_id uuid,
  p_answers     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student    uuid := auth.uid();
  v_exercise   record;
  v_attempt_id uuid;
  v_correct    int;
  v_total      int;
  v_score_pct  int;
  v_badge      boolean := false;
  v_skill_row  record;
BEGIN
  -- Must be signed in
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Validate exercise exists
  SELECT id, chapter_id, skill_id, is_boss
    INTO v_exercise
    FROM exercises
   WHERE id = p_exercise_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'exercise_not_found';
  END IF;

  v_total := jsonb_array_length(p_answers);
  IF v_total = 0 THEN
    RAISE EXCEPTION 'empty_submission';
  END IF;

  -- Count server-computed correct answers
  SELECT COUNT(*)
    INTO v_correct
    FROM jsonb_array_elements(p_answers) AS a
   WHERE (a ->> 'is_correct')::boolean = true;

  v_score_pct := ROUND(v_correct::numeric / GREATEST(1, v_total) * 100);

  -- Write attempt
  INSERT INTO attempts
    (student_id, exercise_id, completed_at, score_pct, total_questions, correct_questions)
  VALUES
    (v_student, p_exercise_id, now(), v_score_pct, v_total, v_correct)
  RETURNING id INTO v_attempt_id;

  -- Write individual answers
  INSERT INTO attempt_answers (attempt_id, question_id, student_answer, is_correct)
  SELECT
    v_attempt_id,
    (a ->> 'question_id')::uuid,
    a ->> 'student_answer',
    (a ->> 'is_correct')::boolean
  FROM jsonb_array_elements(p_answers) AS a;

  -- Skill-progress rollup: group answers by effective skill_id.
  -- Boss rounds store the originating skill in metadata.__skill_id.
  FOR v_skill_row IN
    SELECT
      COALESCE(
        NULLIF(eq.metadata ->> '__skill_id', '')::uuid,
        ex.skill_id
      )                                                              AS skill_id,
      COUNT(*)                                                       AS attempts,
      COUNT(*) FILTER (WHERE (a ->> 'is_correct')::boolean = true)  AS correct
    FROM jsonb_array_elements(p_answers) AS a
    JOIN exercise_questions eq ON eq.id = (a ->> 'question_id')::uuid
    JOIN exercises          ex ON ex.id = eq.exercise_id
   WHERE COALESCE(NULLIF(eq.metadata ->> '__skill_id', '')::uuid, ex.skill_id) IS NOT NULL
   GROUP BY COALESCE(NULLIF(eq.metadata ->> '__skill_id', '')::uuid, ex.skill_id)
  LOOP
    PERFORM upsert_skill_progress(
      v_student,
      v_exercise.chapter_id,
      v_skill_row.skill_id,
      v_skill_row.attempts::int,
      v_skill_row.correct::int
    );
  END LOOP;

  -- Award chapter badge if all skills in the chapter are mastered
  SELECT award_chapter_badge_if_earned(v_exercise.chapter_id) INTO v_badge;

  RETURN jsonb_build_object(
    'score_pct',    v_score_pct,
    'correct',      v_correct,
    'total',        v_total,
    'badge_earned', v_badge
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_exercise_attempt(uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_exercise_attempt(uuid, jsonb) TO authenticated;
