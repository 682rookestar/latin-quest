-- Restrict identifiable pupil data to the pupil, their class teacher, or an
-- administrator. Also make exercise submission callable only by the trusted
-- server and validate every question before committing progress.

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(
  p_student uuid,
  p_teacher uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
     WHERE cm.student_id = p_student
       AND c.teacher_id = p_teacher
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_of_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS profiles_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_teacher_of_student(id, auth.uid())
  );

DROP POLICY IF EXISTS attempts_read ON public.attempts;
DROP POLICY IF EXISTS attempts_insert_self ON public.attempts;
CREATE POLICY attempts_read ON public.attempts
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_teacher_of_student(student_id, auth.uid())
  );

DROP POLICY IF EXISTS answers_read ON public.attempt_answers;
DROP POLICY IF EXISTS answers_insert_self ON public.attempt_answers;
CREATE POLICY answers_read ON public.attempt_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM public.attempts a
       WHERE a.id = attempt_answers.attempt_id
         AND (
           a.student_id = auth.uid()
           OR public.is_admin(auth.uid())
           OR public.is_teacher_of_student(a.student_id, auth.uid())
         )
    )
  );

DROP POLICY IF EXISTS classes_read ON public.classes;
CREATE POLICY classes_read ON public.classes
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR teacher_id = auth.uid()
    OR public.is_class_member(id, auth.uid())
  );

DROP POLICY IF EXISTS class_members_read ON public.class_members;
CREATE POLICY class_members_read ON public.class_members
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR student_id = auth.uid()
    OR public.is_class_teacher(class_id, auth.uid())
  );

DROP POLICY IF EXISTS class_chapter_locks_read ON public.class_chapter_locks;
CREATE POLICY class_chapter_locks_read ON public.class_chapter_locks
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR public.is_class_teacher(class_id, auth.uid())
    OR public.is_class_member(class_id, auth.uid())
  );

DROP POLICY IF EXISTS teachers_read_all_badges ON public.chapter_badges;
CREATE POLICY teachers_read_authorised_badges ON public.chapter_badges
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR public.is_teacher_of_student(student_id, auth.uid())
  );

DROP POLICY IF EXISTS skill_progress_read ON public.skill_progress;
DROP POLICY IF EXISTS skill_progress_upsert_self ON public.skill_progress;
CREATE POLICY skill_progress_read ON public.skill_progress
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_teacher_of_student(student_id, auth.uid())
  );

-- The previous two-argument function trusted an is_correct value supplied by
-- any authenticated caller. Remove access before replacing it with a
-- server-only function that also receives the already-authenticated pupil id.
REVOKE ALL ON FUNCTION public.submit_exercise_attempt(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exercise_attempt(uuid, jsonb) FROM authenticated;
DROP FUNCTION IF EXISTS public.submit_exercise_attempt(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.submit_exercise_attempt(
  p_student uuid,
  p_exercise_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exercise record;
  v_attempt_id uuid;
  v_correct integer;
  v_total integer;
  v_valid_questions integer;
  v_score_pct integer;
  v_badge boolean := false;
  v_skill_row record;
  v_avg numeric;
BEGIN
  IF p_student IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_student AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'invalid_student';
  END IF;

  SELECT id, chapter_id, skill_id, is_boss
    INTO v_exercise
    FROM public.exercises
   WHERE id = p_exercise_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'exercise_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_members WHERE student_id = p_student
  ) THEN
    RAISE EXCEPTION 'student_not_enrolled';
  END IF;

  -- A chapter is unavailable only when every class the pupil belongs to has
  -- locked it, matching locked_chapters_for_me().
  IF NOT EXISTS (
    SELECT 1
      FROM public.class_members cm
     WHERE cm.student_id = p_student
       AND NOT EXISTS (
         SELECT 1
           FROM public.class_chapter_locks ccl
          WHERE ccl.class_id = cm.class_id
            AND ccl.chapter_id = v_exercise.chapter_id
       )
  ) THEN
    RAISE EXCEPTION 'chapter_locked';
  END IF;

  IF jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;

  v_total := jsonb_array_length(p_answers);
  IF v_total < 1 OR v_total > 100 THEN
    RAISE EXCEPTION 'invalid_answer_count';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_answers) a
     WHERE jsonb_typeof(a -> 'question_id') <> 'string'
        OR jsonb_typeof(a -> 'student_answer') <> 'string'
        OR jsonb_typeof(a -> 'is_correct') <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'invalid_answer_shape';
  END IF;

  IF (
    SELECT count(DISTINCT a ->> 'question_id')
      FROM jsonb_array_elements(p_answers) a
  ) <> v_total THEN
    RAISE EXCEPTION 'duplicate_question';
  END IF;

  SELECT count(*)
    INTO v_valid_questions
    FROM jsonb_array_elements(p_answers) a
    JOIN public.exercise_questions eq
      ON eq.id = (a ->> 'question_id')::uuid
    JOIN public.exercises source_ex
      ON source_ex.id = eq.exercise_id
   WHERE (
     (NOT v_exercise.is_boss AND source_ex.id = p_exercise_id)
     OR
     (v_exercise.is_boss
       AND source_ex.chapter_id = v_exercise.chapter_id
       AND source_ex.is_boss = false)
   );

  IF v_valid_questions <> v_total THEN
    RAISE EXCEPTION 'question_not_in_exercise';
  END IF;

  SELECT count(*)
    INTO v_correct
    FROM jsonb_array_elements(p_answers) a
   WHERE (a ->> 'is_correct')::boolean = true;

  v_score_pct := round(v_correct::numeric / v_total * 100);

  INSERT INTO public.attempts
    (student_id, exercise_id, completed_at, score_pct,
     total_questions, correct_questions)
  VALUES
    (p_student, p_exercise_id, now(), v_score_pct,
     v_total, v_correct)
  RETURNING id INTO v_attempt_id;

  INSERT INTO public.attempt_answers
    (attempt_id, question_id, student_answer, is_correct)
  SELECT
    v_attempt_id,
    (a ->> 'question_id')::uuid,
    left(a ->> 'student_answer', 5000),
    (a ->> 'is_correct')::boolean
  FROM jsonb_array_elements(p_answers) a;

  FOR v_skill_row IN
    SELECT
      source_ex.skill_id AS skill_id,
      count(*) AS attempts,
      count(*) FILTER (WHERE (a ->> 'is_correct')::boolean = true) AS correct
    FROM jsonb_array_elements(p_answers) a
    JOIN public.exercise_questions eq
      ON eq.id = (a ->> 'question_id')::uuid
    JOIN public.exercises source_ex
      ON source_ex.id = eq.exercise_id
   WHERE source_ex.skill_id IS NOT NULL
   GROUP BY source_ex.skill_id
  LOOP
    PERFORM public.upsert_skill_progress(
      p_student,
      v_exercise.chapter_id,
      v_skill_row.skill_id,
      v_skill_row.attempts::integer,
      v_skill_row.correct::integer
    );
  END LOOP;

  SELECT avg(mastery)
    INTO v_avg
    FROM public.skill_progress
   WHERE student_id = p_student
     AND chapter_id = v_exercise.chapter_id;

  IF v_avg IS NOT NULL AND v_avg >= 4 THEN
    INSERT INTO public.chapter_badges (student_id, chapter_id)
    VALUES (p_student, v_exercise.chapter_id)
    ON CONFLICT (student_id, chapter_id) DO NOTHING;
    v_badge := FOUND;
  END IF;

  RETURN jsonb_build_object(
    'score_pct', v_score_pct,
    'correct', v_correct,
    'total', v_total,
    'badge_earned', v_badge
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_exercise_attempt(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exercise_attempt(uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_exercise_attempt(uuid, uuid, jsonb) TO service_role;
