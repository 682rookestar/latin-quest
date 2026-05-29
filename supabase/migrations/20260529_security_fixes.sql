-- ============================================================
-- 1. Drop unsafe UPDATE policies
--    attempts and skill_progress should only be written via
--    insert or security-definer RPCs, never updated directly.
-- ============================================================
DROP POLICY IF EXISTS attempts_update_self ON public.attempts;
DROP POLICY IF EXISTS skill_progress_update_self ON public.skill_progress;

-- ============================================================
-- 2. Tighten profiles_read
--    Students may only read their own profile.
--    Teachers and admins may read all profiles.
-- ============================================================
DROP POLICY IF EXISTS profiles_read ON public.profiles;

CREATE POLICY "profiles_read"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_teacher(auth.uid())
    OR is_admin(auth.uid())
  );

-- ============================================================
-- 3. Badge award via RPC only
--    Drop the direct-insert policy so students can no longer
--    self-award badges through the API. The RPC below enforces
--    the mastery threshold server-side.
-- ============================================================
DROP POLICY IF EXISTS students_insert_own_badges ON public.chapter_badges;

-- ============================================================
-- 4. award_chapter_badge_if_earned RPC
--    SECURITY DEFINER so it can write chapter_badges even
--    without a direct INSERT policy.
--    Returns true only when a *new* badge is awarded.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_chapter_badge_if_earned(p_chapter uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_avg     numeric;
BEGIN
  -- Must be authenticated
  IF v_student IS NULL THEN RETURN false; END IF;

  -- Check average mastery for this student + chapter
  SELECT AVG(mastery) INTO v_avg
  FROM skill_progress
  WHERE student_id = v_student
    AND chapter_id = p_chapter;

  -- Require at least 4/5 average mastery
  IF v_avg IS NULL OR v_avg < 4 THEN RETURN false; END IF;

  -- Insert badge; silently skip if already earned
  INSERT INTO chapter_badges (student_id, chapter_id)
  VALUES (v_student, p_chapter)
  ON CONFLICT (student_id, chapter_id) DO NOTHING;

  -- FOUND is true only when a row was actually inserted
  RETURN FOUND;
END;
$$;
