-- Require an AAL2 (MFA-verified) session whenever a teacher or administrator
-- exercises staff privileges. Student self-service remains available at AAL1.
CREATE OR REPLACE FUNCTION public.current_user_has_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.current_user_has_aal2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_aal2() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user = auth.uid()
     AND public.current_user_has_aal2()
     AND COALESCE(
       (SELECT role = 'admin' FROM public.profiles WHERE id = p_user),
       false
     );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user = auth.uid()
     AND public.current_user_has_aal2()
     AND COALESCE(
       (SELECT role = 'teacher' FROM public.profiles WHERE id = p_user),
       false
     );
$$;

CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user = auth.uid()
     AND public.current_user_has_aal2()
     AND EXISTS (
       SELECT 1 FROM public.classes
        WHERE id = p_class AND teacher_id = p_user
     );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_student uuid, p_teacher uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_teacher = auth.uid()
     AND public.current_user_has_aal2()
     AND EXISTS (
       SELECT 1
         FROM public.class_members cm
         JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.student_id = p_student
          AND c.teacher_id = p_teacher
     );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_of_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated;

-- The application server is the only permitted caller; it authenticates the
-- pupil and calculates correctness before invoking this transaction.
REVOKE ALL ON FUNCTION public.submit_exercise_attempt(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_exercise_attempt(uuid, uuid, jsonb)
  TO service_role;

DROP POLICY IF EXISTS classes_read ON public.classes;
CREATE POLICY classes_read ON public.classes
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR (teacher_id = auth.uid() AND public.current_user_has_aal2())
  OR public.is_class_member(id, auth.uid())
);

-- Email-confirmation-safe pupil enrolment. The signup page validates the code
-- before creating the auth user; this trigger validates it again and records
-- membership even when Supabase correctly withholds a session pending email
-- confirmation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'student';
  v_invite_id uuid;
  v_join_code text := upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'join_code', ''), '\s', '', 'g'));
  v_class_id uuid;
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
       SET accepted_at = now(), accepted_by = new.id
     WHERE id = v_invite_id;
  ELSIF v_join_code <> '' THEN
    SELECT id INTO v_class_id
      FROM public.classes
     WHERE upper(join_code) = v_join_code
       AND (join_code_expires_at IS NULL OR join_code_expires_at > now())
     LIMIT 1;

    IF v_class_id IS NOT NULL THEN
      INSERT INTO public.class_members (class_id, student_id)
      VALUES (v_class_id, new.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END;
$$;
