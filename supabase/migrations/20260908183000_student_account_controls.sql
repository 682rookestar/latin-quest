CREATE TABLE IF NOT EXISTS public.student_account_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  target_email text NOT NULL,
  target_display_name text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL CHECK (action IN ('move_class', 'reset_password')),
  from_class_ids uuid[],
  to_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  reason text,
  outcome text NOT NULL DEFAULT 'success' CHECK (outcome IN ('pending', 'success', 'failed')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_account_audit_actor_id_idx
  ON public.student_account_audit (actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS student_account_audit_target_user_id_idx
  ON public.student_account_audit (target_user_id);

ALTER TABLE public.student_account_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_account_audit_admin_read
  ON public.student_account_audit;
CREATE POLICY student_account_audit_admin_read
  ON public.student_account_audit
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin(auth.uid())));

REVOKE ALL ON public.student_account_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.student_account_audit TO authenticated;
GRANT ALL ON public.student_account_audit TO service_role;

CREATE OR REPLACE FUNCTION public.admin_move_student(
  p_student uuid,
  p_new_class uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_student_email text;
  v_student_name text;
  v_from_class_ids uuid[];
BEGIN
  IF v_actor IS NULL
     OR NOT public.is_admin(v_actor)
     OR NOT public.current_user_has_aal2() THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;

  SELECT email, display_name
    INTO v_student_email, v_student_name
    FROM public.profiles
   WHERE id = p_student
     AND role = 'student'
     AND disabled_at IS NULL;

  IF v_student_email IS NULL THEN
    RAISE EXCEPTION 'student_not_found' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes
     WHERE id = p_new_class
       AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'class_not_found' USING errcode = 'P0001';
  END IF;

  SELECT coalesce(array_agg(class_id ORDER BY class_id), '{}'::uuid[])
    INTO v_from_class_ids
    FROM public.class_members
   WHERE student_id = p_student;

  DELETE FROM public.class_members WHERE student_id = p_student;
  INSERT INTO public.class_members (class_id, student_id)
  VALUES (p_new_class, p_student);

  INSERT INTO public.student_account_audit (
    target_user_id, target_email, target_display_name,
    actor_id, actor_email, action, from_class_ids, to_class_id,
    reason, outcome
  ) VALUES (
    p_student, v_student_email, v_student_name,
    v_actor, v_actor_email, 'move_class', v_from_class_ids, p_new_class,
    'Administrator moved pupil between classes', 'success'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_move_student(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_move_student(uuid, uuid)
  TO authenticated;

