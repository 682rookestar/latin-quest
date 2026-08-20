ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_disabled_by_idx
  ON public.profiles (disabled_by)
  WHERE disabled_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.teacher_account_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  target_email text NOT NULL,
  target_display_name text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL CHECK (action IN ('disable', 'restore', 'remove')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_account_audit_actor_id_idx
  ON public.teacher_account_audit (actor_id)
  WHERE actor_id IS NOT NULL;

ALTER TABLE public.teacher_account_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_account_audit_admin_read
  ON public.teacher_account_audit;
CREATE POLICY teacher_account_audit_admin_read
  ON public.teacher_account_audit
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin(auth.uid())));

REVOKE ALL ON public.teacher_account_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.teacher_account_audit TO authenticated;
GRANT ALL ON public.teacher_account_audit TO service_role;

-- Disabled teachers must fail every database authorization helper, even while
-- a previously issued access token remains cryptographically valid.
CREATE OR REPLACE FUNCTION public.is_teacher(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p_user = auth.uid()
     AND public.current_user_has_aal2()
     AND coalesce(
       (
         SELECT role = 'teacher' AND disabled_at IS NULL
           FROM public.profiles
          WHERE id = p_user
       ),
       false
     );
$function$;

CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p_user = auth.uid()
     AND public.current_user_has_aal2()
     AND EXISTS (
       SELECT 1
         FROM public.classes c
         JOIN public.profiles p ON p.id = c.teacher_id
        WHERE c.id = p_class
          AND c.teacher_id = p_user
          AND p.role = 'teacher'
          AND p.disabled_at IS NULL
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
         JOIN public.profiles p ON p.id = c.teacher_id
        WHERE cm.student_id = p_student
          AND c.teacher_id = p_teacher
          AND c.archived_at IS NULL
          AND p.role = 'teacher'
          AND p.disabled_at IS NULL
     );
$function$;

DROP POLICY IF EXISTS classes_read ON public.classes;
CREATE POLICY classes_read
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_admin(auth.uid()))
    OR (
      teacher_id = (SELECT auth.uid())
      AND (SELECT public.current_user_has_aal2())
      AND EXISTS (
        SELECT 1
          FROM public.profiles p
         WHERE p.id = (SELECT auth.uid())
           AND p.role = 'teacher'
           AND p.disabled_at IS NULL
      )
    )
    OR (
      archived_at IS NULL
      AND public.is_class_member(classes.id, auth.uid())
    )
  );

DROP POLICY IF EXISTS classes_insert_teacher ON public.classes;
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
         AND p.disabled_at IS NULL
    )
  );
