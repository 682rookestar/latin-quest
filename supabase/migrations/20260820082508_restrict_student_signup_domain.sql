-- Only Halliford pupils may self-register. Teacher/admin accounts continue to
-- be created through an email-matched staff invitation.
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
  v_email_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
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
  ELSIF v_email_domain <> 'hallifordschool.co.uk' THEN
    RAISE EXCEPTION 'student_email_domain_not_allowed';
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
