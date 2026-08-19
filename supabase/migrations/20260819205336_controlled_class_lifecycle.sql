-- Controlled class lifecycle.
-- Classes are recoverable for 30 days; only an MFA-authenticated admin can
-- permanently delete them, through a service-role-only server action.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz;

CREATE INDEX IF NOT EXISTS classes_archived_at_idx
  ON public.classes (archived_at)
  WHERE archived_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.class_lifecycle_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  class_name text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_role text NOT NULL CHECK (actor_role IN ('teacher', 'admin')),
  action text NOT NULL CHECK (action IN ('archive', 'restore', 'delete')),
  member_count integer NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.class_lifecycle_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_lifecycle_audit_admin_read
  ON public.class_lifecycle_audit;
CREATE POLICY class_lifecycle_audit_admin_read
  ON public.class_lifecycle_audit
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin(auth.uid())));

REVOKE ALL ON public.class_lifecycle_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.class_lifecycle_audit TO authenticated;
GRANT ALL ON public.class_lifecycle_audit TO service_role;

-- Direct browser writes cannot archive, restore, transfer, or delete classes.
-- Creation is restricted to the safe set of fields used by the teacher UI.
REVOKE INSERT, UPDATE, DELETE ON public.classes FROM anon, authenticated;
GRANT INSERT (teacher_id, name, join_code, join_code_expires_at)
  ON public.classes TO authenticated;

DROP POLICY IF EXISTS classes_read ON public.classes;
DROP POLICY IF EXISTS classes_insert_teacher ON public.classes;
DROP POLICY IF EXISTS classes_update_teacher ON public.classes;
DROP POLICY IF EXISTS classes_delete_teacher ON public.classes;

CREATE POLICY classes_read
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_admin(auth.uid()))
    OR (
      teacher_id = (SELECT auth.uid())
      AND (SELECT public.current_user_has_aal2())
    )
    OR (
      archived_at IS NULL
      AND public.is_class_member(classes.id, auth.uid())
    )
  );

CREATE POLICY classes_insert_teacher
  ON public.classes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = (SELECT auth.uid())
    AND (SELECT public.current_user_has_aal2())
    AND EXISTS (
      SELECT 1
        FROM public.profiles p
       WHERE p.id = (SELECT auth.uid())
         AND p.role = 'teacher'
    )
  );

CREATE OR REPLACE FUNCTION public.manage_class_lifecycle(
  p_actor uuid,
  p_class uuid,
  p_action text,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_class public.classes%ROWTYPE;
  v_actor_role text;
  v_actor_email text;
  v_member_count integer;
  v_new_code text;
BEGIN
  SELECT role, email
    INTO v_actor_role, v_actor_email
    FROM public.profiles
   WHERE id = p_actor;

  IF v_actor_role NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT *
    INTO v_class
    FROM public.classes
   WHERE id = p_class
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class_not_found';
  END IF;

  IF v_actor_role <> 'admin' AND v_class.teacher_id <> p_actor THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*)::integer
    INTO v_member_count
    FROM public.class_members
   WHERE class_id = p_class;

  CASE lower(p_action)
    WHEN 'archive' THEN
      IF p_confirmation IS DISTINCT FROM v_class.name THEN
        RAISE EXCEPTION 'confirmation_mismatch';
      END IF;
      IF v_class.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'class_already_archived';
      END IF;

      UPDATE public.classes
         SET archived_at = now(),
             archived_by = p_actor,
             deletion_scheduled_at = now() + interval '30 days',
             join_code_expires_at = now()
       WHERE id = p_class;

    WHEN 'restore' THEN
      IF p_confirmation IS DISTINCT FROM v_class.name THEN
        RAISE EXCEPTION 'confirmation_mismatch';
      END IF;
      IF v_class.archived_at IS NULL THEN
        RAISE EXCEPTION 'class_not_archived';
      END IF;
      IF v_class.deletion_scheduled_at IS NULL
         OR v_class.deletion_scheduled_at <= now() THEN
        RAISE EXCEPTION 'restore_window_expired';
      END IF;

      v_new_code := public.generate_join_code();
      UPDATE public.classes
         SET archived_at = NULL,
             archived_by = NULL,
             deletion_scheduled_at = NULL,
             join_code = v_new_code,
             join_code_expires_at = now() + interval '30 days',
             join_code_rotated_at = now()
       WHERE id = p_class;

    WHEN 'delete' THEN
      IF v_actor_role <> 'admin' THEN
        RAISE EXCEPTION 'admin_required';
      END IF;
      IF p_confirmation IS DISTINCT FROM ('DELETE ' || v_class.name) THEN
        RAISE EXCEPTION 'confirmation_mismatch';
      END IF;
      IF v_class.archived_at IS NULL THEN
        RAISE EXCEPTION 'archive_required';
      END IF;
      IF v_class.deletion_scheduled_at IS NULL
         OR v_class.deletion_scheduled_at > now() THEN
        RAISE EXCEPTION 'retention_period_active';
      END IF;

    ELSE
      RAISE EXCEPTION 'invalid_action';
  END CASE;

  INSERT INTO public.class_lifecycle_audit (
    class_id, class_name, actor_id, actor_email, actor_role, action, member_count
  ) VALUES (
    v_class.id, v_class.name, p_actor, v_actor_email, v_actor_role,
    lower(p_action), v_member_count
  );

  IF lower(p_action) = 'delete' THEN
    DELETE FROM public.classes WHERE id = p_class;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'action', lower(p_action),
    'class_id', p_class
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.manage_class_lifecycle(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_class_lifecycle(uuid, uuid, text, text)
  TO service_role;

-- Archived class codes are invalid through every enrolment path.
CREATE OR REPLACE FUNCTION public.validate_join_code(p_code text)
RETURNS TABLE(class_id uuid, class_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
       AND c.archived_at IS NULL
       AND (c.join_code_expires_at IS NULL OR c.join_code_expires_at > now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_class_by_code(p_code text)
RETURNS TABLE(class_id uuid, class_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_class_id uuid;
  v_name text;
  v_expires timestamptz;
  v_recent integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.class_join_attempts
   WHERE student_id = v_user
     AND attempted_at < now() - interval '5 minutes';

  SELECT count(*) INTO v_recent
    FROM public.class_join_attempts
   WHERE student_id = v_user
     AND attempted_at > now() - interval '60 seconds';

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
   WHERE join_code = v_code
     AND archived_at IS NULL;

  IF v_class_id IS NULL
     OR (v_expires IS NOT NULL AND v_expires < now()) THEN
    RETURN;
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
  VALUES (v_class_id, v_user)
  ON CONFLICT DO NOTHING;

  UPDATE public.class_join_attempts
     SET succeeded = true
   WHERE id = (
     SELECT id
       FROM public.class_join_attempts
      WHERE student_id = v_user
      ORDER BY attempted_at DESC
      LIMIT 1
   );

  class_id := v_class_id;
  class_name := v_name;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
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
       AND archived_at IS NULL
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
$function$;

-- Archived classes no longer affect learning access or teacher/student linkage.
CREATE OR REPLACE FUNCTION public.locked_chapters_for_me()
RETURNS TABLE(chapter_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT ch.id
    FROM public.chapters ch
   WHERE auth.uid() IS NOT NULL
     AND NOT coalesce(
       (SELECT role FROM public.profiles WHERE id = auth.uid()), 'student'
     ) IN ('teacher', 'admin')
     AND EXISTS (
       SELECT 1
         FROM public.class_members cm
         JOIN public.classes cl ON cl.id = cm.class_id
        WHERE cm.student_id = auth.uid()
          AND cl.archived_at IS NULL
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.class_members cm
         JOIN public.classes cl ON cl.id = cm.class_id
         LEFT JOIN public.class_chapter_locks ccl
           ON ccl.class_id = cm.class_id
          AND ccl.chapter_id = ch.id
        WHERE cm.student_id = auth.uid()
          AND cl.archived_at IS NULL
          AND ccl.class_id IS NULL
     );
$function$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(
  p_student uuid,
  p_teacher uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p_teacher = auth.uid()
     AND public.current_user_has_aal2()
     AND EXISTS (
       SELECT 1
         FROM public.class_members cm
         JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.student_id = p_student
          AND c.teacher_id = p_teacher
          AND c.archived_at IS NULL
     );
$function$;
