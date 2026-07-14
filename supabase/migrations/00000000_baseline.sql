-- =============================================================================
-- BASELINE MIGRATION
-- Captures the full public schema as it existed on 2026-07-12.
-- Run before any subsequent timestamped migrations.
-- All statements are written to be idempotent (IF NOT EXISTS / OR REPLACE)
-- so this can also be applied safely against the existing live database.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS (needed by RLS policies defined later)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(p_user uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = p_user),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher(p_user uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role = 'teacher' FROM public.profiles WHERE id = p_user),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class uuid, p_user uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.classes
    WHERE id = p_class AND teacher_id = p_user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(p_class uuid, p_user uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.class_members
    WHERE class_id = p_class AND student_id = p_user
  );
$$;


-- ---------------------------------------------------------------------------
-- 2. TABLES (in FK dependency order)
-- ---------------------------------------------------------------------------

-- profiles — extends auth.users; role is guarded by trigger + CHECK
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        NOT NULL,
  email        text        NOT NULL,
  display_name text,
  role         text        NOT NULL DEFAULT 'student',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey      PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey   FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['admin', 'teacher', 'student']))
);

-- chapters
CREATE TABLE IF NOT EXISTS public.chapters (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  number          integer     NOT NULL,
  title           text        NOT NULL,
  subtitle        text,
  description     text,
  grammar_summary text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapters_pkey       PRIMARY KEY (id),
  CONSTRAINT chapters_number_key UNIQUE (number)
);

-- skills (standalone — no chapter FK; chapter context is in skill_progress)
CREATE TABLE IF NOT EXISTS public.skills (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  code         text NOT NULL,
  display_name text NOT NULL,
  category     text,
  description  text,
  CONSTRAINT skills_pkey     PRIMARY KEY (id),
  CONSTRAINT skills_code_key UNIQUE (code)
);

-- grammar_topics
CREATE TABLE IF NOT EXISTS public.grammar_topics (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  chapter_id  uuid        NOT NULL,
  name        text        NOT NULL,
  category    text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grammar_topics_pkey           PRIMARY KEY (id),
  CONSTRAINT grammar_topics_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters (id) ON DELETE CASCADE
);

-- vocab_items
CREATE TABLE IF NOT EXISTS public.vocab_items (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  chapter_id      uuid        NOT NULL,
  latin           text        NOT NULL,
  english         text        NOT NULL,
  part_of_speech  text,
  stem            text,
  declension      text,
  gender          text,
  conjugation     text,
  principal_parts text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vocab_items_pkey           PRIMARY KEY (id),
  CONSTRAINT vocab_items_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters (id) ON DELETE CASCADE
);

-- exercises
CREATE TABLE IF NOT EXISTS public.exercises (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  chapter_id       uuid        NOT NULL,
  skill_id         uuid,
  title            text        NOT NULL,
  description      text,
  game_type        text        NOT NULL,
  difficulty       integer              DEFAULT 1,
  position         integer              DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  grammar_topic_id uuid,
  is_boss          boolean     NOT NULL DEFAULT false,
  CONSTRAINT exercises_pkey                PRIMARY KEY (id),
  CONSTRAINT exercises_chapter_id_fkey      FOREIGN KEY (chapter_id)       REFERENCES public.chapters       (id) ON DELETE CASCADE,
  CONSTRAINT exercises_skill_id_fkey        FOREIGN KEY (skill_id)         REFERENCES public.skills         (id),
  CONSTRAINT exercises_grammar_topic_id_fkey FOREIGN KEY (grammar_topic_id) REFERENCES public.grammar_topics (id)
);

-- exercise_questions
CREATE TABLE IF NOT EXISTS public.exercise_questions (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  exercise_id    uuid        NOT NULL,
  position       integer     NOT NULL DEFAULT 0,
  prompt         text        NOT NULL,
  correct_answer text        NOT NULL,
  options        jsonb,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercise_questions_pkey            PRIMARY KEY (id),
  CONSTRAINT exercise_questions_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises (id) ON DELETE CASCADE
);

-- attempts
CREATE TABLE IF NOT EXISTS public.attempts (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  student_id       uuid        NOT NULL,
  exercise_id      uuid        NOT NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  score_pct        integer,
  total_questions  integer              DEFAULT 0,
  correct_questions integer             DEFAULT 0,
  CONSTRAINT attempts_pkey           PRIMARY KEY (id),
  CONSTRAINT attempts_student_id_fkey  FOREIGN KEY (student_id)  REFERENCES public.profiles  (id) ON DELETE CASCADE,
  CONSTRAINT attempts_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises (id) ON DELETE CASCADE
);

-- attempt_answers
CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  attempt_id     uuid        NOT NULL,
  question_id    uuid        NOT NULL,
  student_answer text,
  is_correct     boolean     NOT NULL,
  time_ms        integer,
  answered_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attempt_answers_pkey             PRIMARY KEY (id),
  CONSTRAINT attempt_answers_attempt_id_fkey   FOREIGN KEY (attempt_id)   REFERENCES public.attempts          (id) ON DELETE CASCADE,
  CONSTRAINT attempt_answers_question_id_fkey  FOREIGN KEY (question_id)  REFERENCES public.exercise_questions (id) ON DELETE CASCADE
);

-- classes
CREATE TABLE IF NOT EXISTS public.classes (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  teacher_id           uuid        NOT NULL,
  name                 text        NOT NULL,
  join_code            text        NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  join_code_expires_at timestamptz,
  join_code_rotated_at timestamptz          DEFAULT now(),
  CONSTRAINT classes_pkey          PRIMARY KEY (id),
  CONSTRAINT classes_join_code_key UNIQUE (join_code),
  CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles (id) ON DELETE CASCADE
);

-- class_members
CREATE TABLE IF NOT EXISTS public.class_members (
  class_id   uuid        NOT NULL,
  student_id uuid        NOT NULL,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_members_pkey          PRIMARY KEY (class_id, student_id),
  CONSTRAINT class_members_class_id_fkey   FOREIGN KEY (class_id)   REFERENCES public.classes  (id) ON DELETE CASCADE,
  CONSTRAINT class_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles (id) ON DELETE CASCADE
);

-- class_chapter_locks
CREATE TABLE IF NOT EXISTS public.class_chapter_locks (
  class_id   uuid        NOT NULL,
  chapter_id uuid        NOT NULL,
  locked_by  uuid,
  locked_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_chapter_locks_pkey           PRIMARY KEY (class_id, chapter_id),
  CONSTRAINT class_chapter_locks_class_id_fkey   FOREIGN KEY (class_id)   REFERENCES public.classes  (id) ON DELETE CASCADE,
  CONSTRAINT class_chapter_locks_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters (id) ON DELETE CASCADE,
  CONSTRAINT class_chapter_locks_locked_by_fkey  FOREIGN KEY (locked_by)  REFERENCES auth.users      (id) ON DELETE SET NULL
);

-- class_join_attempts (rate-limiting table for join_class_by_code)
CREATE TABLE IF NOT EXISTS public.class_join_attempts (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  student_id   uuid        NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded    boolean     NOT NULL DEFAULT false,
  CONSTRAINT class_join_attempts_pkey           PRIMARY KEY (id),
  CONSTRAINT class_join_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- chapter_badges
CREATE TABLE IF NOT EXISTS public.chapter_badges (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid        NOT NULL,
  chapter_id uuid        NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_badges_pkey                     PRIMARY KEY (id),
  CONSTRAINT chapter_badges_student_id_chapter_id_key UNIQUE (student_id, chapter_id),
  CONSTRAINT chapter_badges_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users      (id) ON DELETE CASCADE,
  CONSTRAINT chapter_badges_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters (id) ON DELETE CASCADE
);

-- skill_progress (composite PK: student + chapter + skill)
CREATE TABLE IF NOT EXISTS public.skill_progress (
  student_id        uuid        NOT NULL,
  chapter_id        uuid        NOT NULL,
  skill_id          uuid        NOT NULL,
  attempts          integer     NOT NULL DEFAULT 0,
  correct           integer     NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  mastery           integer     NOT NULL DEFAULT 0,
  CONSTRAINT skill_progress_pkey            PRIMARY KEY (student_id, chapter_id, skill_id),
  CONSTRAINT skill_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT skill_progress_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters (id) ON DELETE CASCADE,
  CONSTRAINT skill_progress_skill_id_fkey   FOREIGN KEY (skill_id)   REFERENCES public.skills   (id)
);

-- teacher_invites
CREATE TABLE IF NOT EXISTS public.teacher_invites (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  email               text        NOT NULL,
  invited_by          uuid        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  accepted_at         timestamptz,
  accepted_by         uuid,
  action_link         text,
  action_link_sent_at timestamptz,
  CONSTRAINT teacher_invites_pkey         PRIMARY KEY (id),
  CONSTRAINT teacher_invites_invited_by_fkey  FOREIGN KEY (invited_by)  REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT teacher_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users (id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------------
-- 3. INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS attempt_answers_attempt_id_idx
  ON public.attempt_answers USING btree (attempt_id);

CREATE INDEX IF NOT EXISTS attempts_exercise_id_idx
  ON public.attempts USING btree (exercise_id);

CREATE INDEX IF NOT EXISTS attempts_student_id_idx
  ON public.attempts USING btree (student_id);

CREATE INDEX IF NOT EXISTS chapter_badges_student_idx
  ON public.chapter_badges USING btree (student_id);

CREATE INDEX IF NOT EXISTS class_join_attempts_student_time_idx
  ON public.class_join_attempts USING btree (student_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS class_members_student_id_idx
  ON public.class_members USING btree (student_id);

CREATE INDEX IF NOT EXISTS classes_teacher_id_idx
  ON public.classes USING btree (teacher_id);

CREATE INDEX IF NOT EXISTS exercise_questions_exercise_id_idx
  ON public.exercise_questions USING btree (exercise_id);

CREATE INDEX IF NOT EXISTS idx_exercise_questions_exercise_id_random
  ON public.exercise_questions USING btree (exercise_id);

CREATE INDEX IF NOT EXISTS exercises_chapter_id_idx
  ON public.exercises USING btree (chapter_id);

CREATE INDEX IF NOT EXISTS grammar_topics_chapter_id_idx
  ON public.grammar_topics USING btree (chapter_id);

CREATE INDEX IF NOT EXISTS teacher_invites_email_idx
  ON public.teacher_invites USING btree (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS teacher_invites_email_pending_uq
  ON public.teacher_invites USING btree (lower(email))
  WHERE (accepted_at IS NULL);

CREATE INDEX IF NOT EXISTS vocab_items_chapter_id_idx
  ON public.vocab_items USING btree (chapter_id);

CREATE INDEX IF NOT EXISTS vocab_items_part_of_speech_idx
  ON public.vocab_items USING btree (part_of_speech);


-- ---------------------------------------------------------------------------
-- 4. FUNCTIONS
-- ---------------------------------------------------------------------------

-- generate_join_code — cryptographically random, unambiguous alphabet
CREATE OR REPLACE FUNCTION public.generate_join_code()
  RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
  attempt int := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..10 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    IF NOT EXISTS(SELECT 1 FROM public.classes WHERE join_code = candidate) THEN
      RETURN candidate;
    END IF;
    attempt := attempt + 1;
    IF attempt > 20 THEN
      RAISE EXCEPTION 'Could not allocate a unique join code';
    END IF;
  END LOOP;
END;
$function$;

-- upsert_skill_progress — called by submit_exercise_attempt
CREATE OR REPLACE FUNCTION public.upsert_skill_progress(
  p_student  uuid,
  p_chapter  uuid,
  p_skill    uuid,
  p_attempts integer,
  p_correct  integer
)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  total_attempts int;
  total_correct  int;
BEGIN
  INSERT INTO public.skill_progress
    (student_id, chapter_id, skill_id, attempts, correct, last_attempted_at, mastery)
  VALUES
    (p_student, p_chapter, p_skill, p_attempts, p_correct, now(),
     least(5, greatest(0, (p_correct * 5) / nullif(p_attempts, 0))))
  ON CONFLICT (student_id, chapter_id, skill_id) DO UPDATE
    SET attempts          = skill_progress.attempts + excluded.attempts,
        correct           = skill_progress.correct  + excluded.correct,
        last_attempted_at = now()
  RETURNING skill_progress.attempts, skill_progress.correct
    INTO total_attempts, total_correct;

  UPDATE public.skill_progress
     SET mastery = least(5, greatest(0, (total_correct * 5) / nullif(total_attempts, 0)))
   WHERE student_id = p_student AND chapter_id = p_chapter AND skill_id = p_skill;
END;
$function$;

-- award_chapter_badge_if_earned — called after skill progress update
CREATE OR REPLACE FUNCTION public.award_chapter_badge_if_earned(p_chapter uuid)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_student uuid := auth.uid();
  v_avg     numeric;
BEGIN
  IF v_student IS NULL THEN RETURN false; END IF;

  SELECT AVG(mastery) INTO v_avg
    FROM skill_progress
   WHERE student_id = v_student
     AND chapter_id = p_chapter;

  IF v_avg IS NULL OR v_avg < 4 THEN RETURN false; END IF;

  INSERT INTO chapter_badges (student_id, chapter_id)
  VALUES (v_student, p_chapter)
  ON CONFLICT (student_id, chapter_id) DO NOTHING;

  RETURN FOUND;
END;
$function$;

-- submit_exercise_attempt — SECURITY DEFINER RPC called by ExerciseRunner
-- Accepts server-scored answers, writes attempt + answers atomically,
-- updates skill progress, and awards chapter badge if earned.
CREATE OR REPLACE FUNCTION public.submit_exercise_attempt(
  p_exercise_id uuid,
  p_answers     jsonb   -- [{question_id, student_answer, is_correct}]
)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
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
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

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

  SELECT COUNT(*)
    INTO v_correct
    FROM jsonb_array_elements(p_answers) AS a
   WHERE (a ->> 'is_correct')::boolean = true;

  v_score_pct := ROUND(v_correct::numeric / GREATEST(1, v_total) * 100);

  INSERT INTO attempts
    (student_id, exercise_id, completed_at, score_pct, total_questions, correct_questions)
  VALUES
    (v_student, p_exercise_id, now(), v_score_pct, v_total, v_correct)
  RETURNING id INTO v_attempt_id;

  INSERT INTO attempt_answers (attempt_id, question_id, student_answer, is_correct)
  SELECT
    v_attempt_id,
    (a ->> 'question_id')::uuid,
    a ->> 'student_answer',
    (a ->> 'is_correct')::boolean
  FROM jsonb_array_elements(p_answers) AS a;

  FOR v_skill_row IN
    SELECT
      COALESCE(
        NULLIF(eq.metadata ->> '__skill_id', '')::uuid,
        ex.skill_id
      )                                                             AS skill_id,
      COUNT(*)                                                      AS attempts,
      COUNT(*) FILTER (WHERE (a ->> 'is_correct')::boolean = true) AS correct
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

  SELECT award_chapter_badge_if_earned(v_exercise.chapter_id) INTO v_badge;

  RETURN jsonb_build_object(
    'score_pct',    v_score_pct,
    'correct',      v_correct,
    'total',        v_total,
    'badge_earned', v_badge
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_exercise_attempt(uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_exercise_attempt(uuid, jsonb) TO authenticated;

-- guard_profiles_role — trigger function, blocks non-admin role changes
CREATE OR REPLACE FUNCTION public.guard_profiles_role()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF new.role IS DISTINCT FROM old.role THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only admins can change a profile role';
    END IF;
  END IF;
  RETURN new;
END;
$function$;

-- handle_new_user — fires on auth.users INSERT; promotes if invite exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_role      text := 'student';
  v_invite_id uuid;
BEGIN
  SELECT id INTO v_invite_id
    FROM public.teacher_invites
   WHERE lower(email) = lower(new.email)
     AND accepted_at IS NULL
     AND expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_invite_id IS NOT NULL THEN
    v_role := 'teacher';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    v_role
  );

  IF v_invite_id IS NOT NULL THEN
    UPDATE public.teacher_invites
       SET accepted_at = now(),
           accepted_by = new.id
     WHERE id = v_invite_id;
  END IF;

  RETURN new;
END;
$function$;

-- join_class_by_code — rate-limited class join via join code
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_code text)
  RETURNS TABLE(class_id uuid, class_name text)
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user     uuid := auth.uid();
  v_code     text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_class_id uuid;
  v_name     text;
  v_expires  timestamptz;
  v_recent   int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.class_join_attempts
   WHERE student_id = v_user
     AND attempted_at < now() - INTERVAL '5 minutes';

  SELECT count(*) INTO v_recent
    FROM public.class_join_attempts
   WHERE student_id = v_user
     AND attempted_at > now() - INTERVAL '60 seconds';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.class_join_attempts (student_id, attempted_at, succeeded)
    VALUES (v_user, now(), false);

  IF length(v_code) = 0 THEN
    RETURN;
  END IF;

  SELECT id, name, join_code_expires_at
    INTO v_class_id, v_name, v_expires
    FROM public.classes
   WHERE join_code = v_code;

  IF v_class_id IS NULL THEN
    RETURN;
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN;
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
    VALUES (v_class_id, v_user)
    ON CONFLICT DO NOTHING;

  UPDATE public.class_join_attempts
     SET succeeded = true
   WHERE id = (
     SELECT id FROM public.class_join_attempts
      WHERE student_id = v_user
      ORDER BY attempted_at DESC
      LIMIT 1
   );

  class_id   := v_class_id;
  class_name := v_name;
  RETURN NEXT;
END;
$function$;

-- validate_join_code — preview a code before joining (no side effects)
CREATE OR REPLACE FUNCTION public.validate_join_code(p_code text)
  RETURNS TABLE(class_id uuid, class_name text)
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
BEGIN
  IF length(v_code) = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT c.id, c.name
      FROM public.classes c
     WHERE c.join_code = v_code
       AND (c.join_code_expires_at IS NULL OR c.join_code_expires_at > now());
END;
$function$;

-- locked_chapters_for_me — returns chapter ids locked for the calling student
CREATE OR REPLACE FUNCTION public.locked_chapters_for_me()
  RETURNS TABLE(chapter_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT c.id
    FROM public.chapters c
   WHERE auth.uid() IS NOT NULL
     AND NOT coalesce((SELECT role FROM public.profiles WHERE id = auth.uid()), 'student')
         IN ('teacher', 'admin')
     AND EXISTS (SELECT 1 FROM public.class_members WHERE student_id = auth.uid())
     AND NOT EXISTS (
       SELECT 1
         FROM public.class_members cm
         LEFT JOIN public.class_chapter_locks ccl
           ON ccl.class_id = cm.class_id
          AND ccl.chapter_id = c.id
        WHERE cm.student_id = auth.uid()
          AND ccl.class_id IS NULL
     );
$function$;

-- get_standard_progress — per-chapter topic pass counts for calling student
CREATE OR REPLACE FUNCTION public.get_standard_progress()
  RETURNS TABLE(
    chapter_id     uuid,
    chapter_number integer,
    total_topics   integer,
    passed_topics  integer,
    badge_earned   boolean
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT
    c.id                                                        AS chapter_id,
    c.number                                                    AS chapter_number,
    COUNT(DISTINCT e.grammar_topic_id)::integer                 AS total_topics,
    COUNT(DISTINCT
      CASE WHEN a.score_pct >= 60 THEN e.grammar_topic_id END
    )::integer                                                  AS passed_topics,
    EXISTS (
      SELECT 1 FROM chapter_badges cb
       WHERE cb.chapter_id = c.id
         AND cb.student_id = auth.uid()
    )                                                           AS badge_earned
  FROM chapters c
  LEFT JOIN exercises e
    ON e.chapter_id = c.id AND e.grammar_topic_id IS NOT NULL
  LEFT JOIN attempts a
    ON a.exercise_id = e.id
   AND a.student_id  = auth.uid()
   AND a.completed_at IS NOT NULL
  GROUP BY c.id, c.number
  ORDER BY c.number;
$function$;

-- get_class_leaderboard — ranked view of every class the caller belongs to
CREATE OR REPLACE FUNCTION public.get_class_leaderboard()
  RETURNS TABLE(
    class_id      uuid,
    class_name    text,
    rank          bigint,
    student_id    uuid,
    display_name  text,
    badges        bigint,
    total_mastery bigint,
    is_me         boolean
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT
    cl.id                                             AS class_id,
    cl.name                                           AS class_name,
    RANK() OVER (
      PARTITION BY cl.id
      ORDER BY
        COUNT(DISTINCT cb.chapter_id) DESC,
        COALESCE(SUM(sp.mastery), 0) DESC,
        p.display_name
    )                                                 AS rank,
    p.id                                              AS student_id,
    p.display_name,
    COUNT(DISTINCT cb.chapter_id)                     AS badges,
    COALESCE(SUM(sp.mastery), 0)                      AS total_mastery,
    (p.id = auth.uid())                               AS is_me
  FROM class_members cm_me
  JOIN class_members cm_peer ON cm_peer.class_id = cm_me.class_id
  JOIN profiles p             ON p.id = cm_peer.student_id
  JOIN classes  cl            ON cl.id = cm_me.class_id
  LEFT JOIN chapter_badges cb ON cb.student_id = p.id
  LEFT JOIN skill_progress sp ON sp.student_id = p.id
  WHERE cm_me.student_id = auth.uid()
    AND p.role = 'student'
  GROUP BY cl.id, cl.name, p.id, p.display_name
  ORDER BY cl.name, rank;
$function$;

-- rotate_join_code — generates a new code for a class
CREATE OR REPLACE FUNCTION public.rotate_join_code(
  p_class      uuid,
  p_expires_in interval DEFAULT '30 days'::interval
)
  RETURNS TABLE(join_code text, join_code_expires_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_new_code text;
  v_expiry   timestamptz := now() + p_expires_in;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (public.is_class_teacher(p_class, auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_new_code := public.generate_join_code();

  UPDATE public.classes
     SET join_code            = v_new_code,
         join_code_expires_at = v_expiry,
         join_code_rotated_at = now()
   WHERE id = p_class;

  join_code            := v_new_code;
  join_code_expires_at := v_expiry;
  RETURN NEXT;
END;
$function$;

-- set_chapter_lock — lock/unlock a chapter for a class
CREATE OR REPLACE FUNCTION public.set_chapter_lock(
  p_class   uuid,
  p_chapter uuid,
  p_locked  boolean
)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (public.is_class_teacher(p_class, auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_locked THEN
    INSERT INTO public.class_chapter_locks (class_id, chapter_id, locked_by)
      VALUES (p_class, p_chapter, auth.uid())
      ON CONFLICT (class_id, chapter_id)
      DO UPDATE SET locked_by = excluded.locked_by, locked_at = now();
  ELSE
    DELETE FROM public.class_chapter_locks
     WHERE class_id = p_class AND chapter_id = p_chapter;
  END IF;

  RETURN p_locked;
END;
$function$;

-- create_teacher_invite — admin-only; idempotent on pending email
CREATE OR REPLACE FUNCTION public.create_teacher_invite(p_email text)
  RETURNS TABLE(invite_id uuid, invite_email text, invite_expires_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_email   text      := lower(trim(p_email));
  v_id      uuid;
  v_expires timestamptz := now() + INTERVAL '14 days';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'invalid email';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE lower(p.email) = v_email
       AND p.role IN ('teacher', 'admin')
  ) THEN
    RAISE EXCEPTION 'already_teacher';
  END IF;

  INSERT INTO public.teacher_invites (email, invited_by, expires_at)
       VALUES (v_email, auth.uid(), v_expires)
  ON CONFLICT (lower(email)) WHERE (accepted_at IS NULL)
  DO UPDATE SET
    expires_at = excluded.expires_at,
    invited_by = excluded.invited_by
  RETURNING teacher_invites.id INTO v_id;

  invite_id         := v_id;
  invite_email      := v_email;
  invite_expires_at := v_expires;
  RETURN NEXT;
END;
$function$;

-- revoke_teacher_invite — admin-only hard delete of a pending invite
CREATE OR REPLACE FUNCTION public.revoke_teacher_invite(p_invite uuid)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.teacher_invites WHERE id = p_invite;
END;
$function$;

-- transfer_class_ownership — admin reassigns a class to another teacher
CREATE OR REPLACE FUNCTION public.transfer_class_ownership(
  p_class     uuid,
  p_new_owner uuid
)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class) THEN
    RAISE EXCEPTION 'class_not_found';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_new_owner;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'new_owner_not_found';
  END IF;
  IF v_role NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'new_owner_not_teacher';
  END IF;

  UPDATE public.classes
     SET teacher_id = p_new_owner
   WHERE id = p_class;

  RETURN true;
END;
$function$;


-- ---------------------------------------------------------------------------
-- 5. TRIGGERS
-- ---------------------------------------------------------------------------

-- Fires on auth.users INSERT; creates a profile and promotes via invite.
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fires on profiles UPDATE; blocks non-admin role changes.
DROP TRIGGER IF EXISTS profiles_role_guard ON public.profiles;
CREATE TRIGGER profiles_role_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_role();


-- ---------------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_topics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_chapter_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_join_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_badges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_progress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_invites   ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_read        ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;

CREATE POLICY profiles_read ON public.profiles
  FOR SELECT USING (id = auth.uid() OR is_teacher(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- chapters (world-readable)
DROP POLICY IF EXISTS chapters_read ON public.chapters;
CREATE POLICY chapters_read ON public.chapters
  FOR SELECT USING (true);

-- skills
DROP POLICY IF EXISTS skills_read ON public.skills;
CREATE POLICY skills_read ON public.skills
  FOR SELECT USING (auth.role() = 'authenticated');

-- grammar_topics
DROP POLICY IF EXISTS grammar_read ON public.grammar_topics;
CREATE POLICY grammar_read ON public.grammar_topics
  FOR SELECT USING (auth.role() = 'authenticated');

-- vocab_items
DROP POLICY IF EXISTS vocab_read ON public.vocab_items;
CREATE POLICY vocab_read ON public.vocab_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- exercises
DROP POLICY IF EXISTS exercises_read ON public.exercises;
CREATE POLICY exercises_read ON public.exercises
  FOR SELECT USING (auth.role() = 'authenticated');

-- exercise_questions
DROP POLICY IF EXISTS questions_read ON public.exercise_questions;
CREATE POLICY questions_read ON public.exercise_questions
  FOR SELECT USING (auth.role() = 'authenticated');

-- attempts
DROP POLICY IF EXISTS attempts_read        ON public.attempts;
DROP POLICY IF EXISTS attempts_insert_self ON public.attempts;

CREATE POLICY attempts_read ON public.attempts
  FOR SELECT USING (is_teacher(auth.uid()) OR is_admin(auth.uid()) OR student_id = auth.uid());

CREATE POLICY attempts_insert_self ON public.attempts
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- attempt_answers
DROP POLICY IF EXISTS answers_read        ON public.attempt_answers;
DROP POLICY IF EXISTS answers_insert_self ON public.attempt_answers;

CREATE POLICY answers_read ON public.attempt_answers
  FOR SELECT USING (
    is_teacher(auth.uid()) OR is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = attempt_answers.attempt_id AND a.student_id = auth.uid())
  );

CREATE POLICY answers_insert_self ON public.attempt_answers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = attempt_answers.attempt_id AND a.student_id = auth.uid())
  );

-- classes
DROP POLICY IF EXISTS classes_read           ON public.classes;
DROP POLICY IF EXISTS classes_insert_teacher ON public.classes;
DROP POLICY IF EXISTS classes_update_teacher ON public.classes;
DROP POLICY IF EXISTS classes_delete_teacher ON public.classes;

CREATE POLICY classes_read ON public.classes
  FOR SELECT USING (
    is_teacher(auth.uid()) OR is_admin(auth.uid()) OR
    teacher_id = auth.uid() OR is_class_member(id, auth.uid())
  );

CREATE POLICY classes_insert_teacher ON public.classes
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
  );

CREATE POLICY classes_update_teacher ON public.classes
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY classes_delete_teacher ON public.classes
  FOR DELETE USING (teacher_id = auth.uid());

-- class_members
DROP POLICY IF EXISTS class_members_read              ON public.class_members;
DROP POLICY IF EXISTS class_members_delete_self_or_teacher ON public.class_members;

CREATE POLICY class_members_read ON public.class_members
  FOR SELECT USING (is_teacher(auth.uid()) OR is_admin(auth.uid()) OR student_id = auth.uid());

CREATE POLICY class_members_delete_self_or_teacher ON public.class_members
  FOR DELETE USING (student_id = auth.uid() OR is_class_teacher(class_id, auth.uid()));

-- class_chapter_locks
DROP POLICY IF EXISTS class_chapter_locks_read  ON public.class_chapter_locks;
DROP POLICY IF EXISTS class_chapter_locks_write ON public.class_chapter_locks;

CREATE POLICY class_chapter_locks_read ON public.class_chapter_locks
  FOR SELECT USING (
    is_teacher(auth.uid()) OR is_admin(auth.uid()) OR is_class_member(class_id, auth.uid())
  );

CREATE POLICY class_chapter_locks_write ON public.class_chapter_locks
  FOR ALL
  USING     (is_class_teacher(class_id, auth.uid()) OR is_admin(auth.uid()))
  WITH CHECK (is_class_teacher(class_id, auth.uid()) OR is_admin(auth.uid()));

-- class_join_attempts
DROP POLICY IF EXISTS students_read_own_join_attempts   ON public.class_join_attempts;
DROP POLICY IF EXISTS students_insert_own_join_attempts ON public.class_join_attempts;

CREATE POLICY students_read_own_join_attempts ON public.class_join_attempts
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY students_insert_own_join_attempts ON public.class_join_attempts
  FOR INSERT WITH CHECK (auth.uid() = student_id);

-- chapter_badges
DROP POLICY IF EXISTS students_read_own_badges  ON public.chapter_badges;
DROP POLICY IF EXISTS teachers_read_all_badges  ON public.chapter_badges;

CREATE POLICY students_read_own_badges ON public.chapter_badges
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY teachers_read_all_badges ON public.chapter_badges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
       WHERE profiles.id = auth.uid()
         AND profiles.role = ANY (ARRAY['teacher', 'admin'])
    )
  );

-- skill_progress
DROP POLICY IF EXISTS skill_progress_read         ON public.skill_progress;
DROP POLICY IF EXISTS skill_progress_upsert_self  ON public.skill_progress;

CREATE POLICY skill_progress_read ON public.skill_progress
  FOR SELECT USING (is_teacher(auth.uid()) OR is_admin(auth.uid()) OR student_id = auth.uid());

CREATE POLICY skill_progress_upsert_self ON public.skill_progress
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- teacher_invites
DROP POLICY IF EXISTS teacher_invites_admin_read   ON public.teacher_invites;
DROP POLICY IF EXISTS teacher_invites_admin_insert ON public.teacher_invites;
DROP POLICY IF EXISTS teacher_invites_admin_update ON public.teacher_invites;

CREATE POLICY teacher_invites_admin_read ON public.teacher_invites
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY teacher_invites_admin_insert ON public.teacher_invites
  FOR INSERT WITH CHECK (is_admin(auth.uid()) AND invited_by = auth.uid());

CREATE POLICY teacher_invites_admin_update ON public.teacher_invites
  FOR UPDATE USING (is_admin(auth.uid()));
