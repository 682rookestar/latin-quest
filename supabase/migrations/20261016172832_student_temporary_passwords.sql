-- Passwords remain in Supabase Auth. This table stores only workflow state,
-- expiry, audit references and a short operation lease (never a password).
CREATE SCHEMA IF NOT EXISTS latin_quest_private;
REVOKE ALL ON SCHEMA latin_quest_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA latin_quest_private TO authenticated, service_role;

CREATE TABLE latin_quest_private.student_password_resets (
  student_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reset_id uuid NOT NULL,
  required boolean NOT NULL DEFAULT true,
  phase text NOT NULL CHECK (phase IN ('issuing', 'ready', 'changing', 'complete')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  session_valid_after timestamptz NOT NULL,
  operation_id uuid,
  operation_until timestamptz,
  audit_id uuid REFERENCES public.student_account_audit(id) ON DELETE SET NULL,
  verification_count integer NOT NULL DEFAULT 0,
  verification_window timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_password_resets_audit_idx ON latin_quest_private.student_password_resets(audit_id);
ALTER TABLE latin_quest_private.student_password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON latin_quest_private.student_password_resets FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION latin_quest_private.student_password_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_state latin_quest_private.student_password_resets%ROWTYPE;
  v_valid boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING errcode = '42501'; END IF;
  SELECT * INTO v_state FROM latin_quest_private.student_password_resets WHERE student_id = v_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('required', false, 'session_valid', true, 'expired', false, 'busy', false); END IF;
  SELECT EXISTS (
    SELECT 1 FROM auth.sessions
    WHERE user_id = v_user AND id::text = auth.jwt()->>'session_id'
      AND created_at >= v_state.session_valid_after
  ) INTO v_valid;
  RETURN jsonb_build_object('required', v_state.required, 'session_valid', v_valid,
    'expired', v_state.required AND v_state.expires_at <= now(),
    'busy', v_state.operation_id IS NOT NULL AND v_state.operation_until > now(),
    'reset_id', v_state.reset_id, 'expires_at', v_state.expires_at);
END;
$$;
REVOKE ALL ON FUNCTION latin_quest_private.student_password_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION latin_quest_private.student_password_status() TO authenticated;

CREATE FUNCTION public.student_password_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT latin_quest_private.student_password_status();
$$;
REVOKE ALL ON FUNCTION public.student_password_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_password_status() TO authenticated;

CREATE OR REPLACE FUNCTION latin_quest_private.student_password_access_allowed()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state latin_quest_private.student_password_resets%ROWTYPE; v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = v_user AND status = 'verified')
    AND coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' THEN RETURN false; END IF;
  SELECT * INTO v_state FROM latin_quest_private.student_password_resets WHERE student_id = v_user;
  IF NOT FOUND THEN RETURN true; END IF;
  RETURN NOT v_state.required AND v_state.operation_id IS NULL AND EXISTS (
    SELECT 1 FROM auth.sessions WHERE user_id = v_user
      AND id::text = auth.jwt()->>'session_id' AND created_at >= v_state.session_valid_after
  );
END;
$$;
REVOKE ALL ON FUNCTION latin_quest_private.student_password_access_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION latin_quest_private.student_password_access_allowed() TO authenticated;

-- A lease serialises resets and final password changes across Auth HTTP calls.
-- Expired leases can be replaced; stale completions can never clear a new reset.
CREATE FUNCTION latin_quest_private.begin_student_password_operation(
  p_student uuid, p_actor uuid, p_operation text, p_reset uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_state latin_quest_private.student_password_resets%ROWTYPE;
  v_actor public.profiles%ROWTYPE;
  v_pupil public.profiles%ROWTYPE;
  v_op uuid := gen_random_uuid();
  v_reset uuid := gen_random_uuid();
  v_audit uuid;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_student::text, 74119));
  SELECT * INTO v_actor FROM public.profiles WHERE id = p_actor AND disabled_at IS NULL;
  SELECT * INTO v_pupil FROM public.profiles WHERE id = p_student AND role = 'student' AND disabled_at IS NULL;
  IF v_actor.id IS NULL OR v_pupil.id IS NULL THEN RAISE EXCEPTION 'forbidden' USING errcode = '42501'; END IF;
  SELECT * INTO v_state FROM latin_quest_private.student_password_resets WHERE student_id = p_student FOR UPDATE;
  IF v_state.operation_id IS NOT NULL AND v_state.operation_until > v_now THEN
    RAISE EXCEPTION 'password_operation_busy';
  END IF;
  IF p_operation = 'issue' THEN
    IF v_actor.role <> 'teacher' OR NOT EXISTS (
      SELECT 1 FROM public.classes c JOIN public.class_members cm ON cm.class_id = c.id
      WHERE c.teacher_id = p_actor AND c.archived_at IS NULL AND cm.student_id = p_student
    ) THEN RAISE EXCEPTION 'forbidden' USING errcode = '42501'; END IF;
    IF (SELECT count(*) FROM public.student_account_audit WHERE actor_id = p_actor
        AND action = 'reset_password' AND occurred_at > v_now - interval '1 hour') >= 60
       OR (SELECT count(*) FROM public.student_account_audit WHERE target_user_id = p_student
        AND action = 'reset_password' AND occurred_at > v_now - interval '15 minutes') >= 5 THEN
      RAISE EXCEPTION 'password_reset_rate_limited';
    END IF;
    INSERT INTO public.student_account_audit(target_user_id, target_email, target_display_name,
      actor_id, actor_email, action, reason, outcome)
    VALUES (p_student, v_pupil.email, v_pupil.display_name, p_actor, v_actor.email,
      'reset_password', 'Teacher-issued temporary password; change required at sign-in', 'pending') RETURNING id INTO v_audit;
    INSERT INTO latin_quest_private.student_password_resets(student_id, reset_id, required, phase,
      issued_at, expires_at, session_valid_after, operation_id, operation_until, audit_id)
    VALUES (p_student, v_reset, true, 'issuing', v_now, v_now + interval '24 hours', v_now, v_op, v_now + interval '2 minutes', v_audit)
    ON CONFLICT (student_id) DO UPDATE SET reset_id = EXCLUDED.reset_id, required = true, phase = 'issuing',
      issued_at = EXCLUDED.issued_at, expires_at = EXCLUDED.expires_at, session_valid_after = EXCLUDED.session_valid_after,
      operation_id = EXCLUDED.operation_id, operation_until = EXCLUDED.operation_until, audit_id = EXCLUDED.audit_id,
      verification_count = 0, verification_window = v_now;
  ELSE
    IF p_actor <> p_student OR v_state.student_id IS NULL OR NOT v_state.required OR p_reset IS DISTINCT FROM v_state.reset_id
      OR v_state.phase <> 'ready' THEN RAISE EXCEPTION 'password_reset_changed'; END IF;
    IF v_state.expires_at <= v_now THEN RAISE EXCEPTION 'temporary_password_expired'; END IF;
    IF p_operation = 'verify' THEN
      IF v_state.verification_window <= v_now - interval '15 minutes' THEN
        v_state.verification_count := 0;
        v_state.verification_window := v_now;
      END IF;
      IF v_state.verification_count >= 10 THEN RAISE EXCEPTION 'password_verification_rate_limited'; END IF;
      UPDATE latin_quest_private.student_password_resets SET verification_count = v_state.verification_count + 1,
        verification_window = v_state.verification_window WHERE student_id = p_student;
      RETURN jsonb_build_object('reset_id', v_state.reset_id);
    ELSIF p_operation = 'complete' THEN
      UPDATE latin_quest_private.student_password_resets SET phase = 'changing', operation_id = v_op,
        operation_until = v_now + interval '2 minutes' WHERE student_id = p_student;
    ELSE RAISE EXCEPTION 'invalid_password_operation'; END IF;
  END IF;
  SELECT * INTO v_state FROM latin_quest_private.student_password_resets WHERE student_id = p_student;
  RETURN jsonb_build_object('operation_id', v_op, 'reset_id', v_state.reset_id, 'expires_at', v_state.expires_at);
END;
$$;

CREATE FUNCTION latin_quest_private.finish_student_password_operation(p_student uuid, p_operation_id uuid, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state latin_quest_private.student_password_resets%ROWTYPE;
BEGIN
  SELECT * INTO v_state FROM latin_quest_private.student_password_resets WHERE student_id = p_student FOR UPDATE;
  IF NOT FOUND OR v_state.operation_id IS DISTINCT FROM p_operation_id OR v_state.operation_until <= clock_timestamp() THEN
    RAISE EXCEPTION 'password_operation_changed';
  END IF;
  IF v_state.phase = 'issuing' THEN
    UPDATE public.student_account_audit SET outcome = CASE WHEN p_success THEN 'success' ELSE 'failed' END WHERE id = v_state.audit_id;
  END IF;
  UPDATE latin_quest_private.student_password_resets SET
    required = NOT (p_success AND v_state.phase = 'changing'),
    phase = CASE WHEN p_success AND v_state.phase = 'changing' THEN 'complete' ELSE 'ready' END,
    session_valid_after = CASE WHEN p_success AND v_state.phase = 'changing' THEN clock_timestamp() ELSE session_valid_after END,
    operation_id = NULL, operation_until = NULL WHERE student_id = p_student;
END;
$$;

REVOKE ALL ON FUNCTION latin_quest_private.begin_student_password_operation(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION latin_quest_private.finish_student_password_operation(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION latin_quest_private.begin_student_password_operation(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION latin_quest_private.finish_student_password_operation(uuid, uuid, boolean) TO service_role;

CREATE FUNCTION public.begin_student_password_operation(p_student uuid, p_actor uuid, p_operation text, p_reset uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT latin_quest_private.begin_student_password_operation(p_student, p_actor, p_operation, p_reset);
$$;
CREATE FUNCTION public.finish_student_password_operation(p_student uuid, p_operation_id uuid, p_success boolean)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT latin_quest_private.finish_student_password_operation(p_student, p_operation_id, p_success);
$$;
REVOKE ALL ON FUNCTION public.begin_student_password_operation(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_student_password_operation(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_student_password_operation(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_student_password_operation(uuid, uuid, boolean) TO service_role;

-- Existing allow policies still apply. This additional restrictive policy stops
-- reset-required and revoked pupil sessions using the direct Data API. Keep own
-- profile identity readable for routing; reset state itself stays private.
DO $$ DECLARE v_table record;
BEGIN
  FOR v_table IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity AND c.relname <> 'profiles'
  LOOP
    EXECUTE format('CREATE POLICY student_password_ready ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT latin_quest_private.student_password_access_allowed())) WITH CHECK ((SELECT latin_quest_private.student_password_access_allowed()))', v_table.relname);
  END LOOP;
END $$;

-- Guard the existing pupil-facing SECURITY DEFINER RPCs too: their owners
-- bypass table RLS. Originals move to the unexposed schema with no client grant;
-- authenticated callers get guarded private functions via invoker RPC wrappers.
-- LOCAL_ITERATION_RPC_GUARDS
DO $$
DECLARE v_name text; v_args text; v_identity text; v_result text; v_call text; v_oid oid;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['join_class_by_code', 'get_class_leaderboard', 'get_standard_progress', 'locked_chapters_for_me'] LOOP
    SELECT p.oid, pg_get_function_arguments(p.oid), pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid)
      INTO v_oid, v_args, v_identity, v_result
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name;
    IF v_oid IS NULL THEN RAISE EXCEPTION 'Missing pupil RPC: %', v_name; END IF;
    SELECT coalesce(string_agg('$' || i::text, ', '), '') INTO v_call FROM generate_series(1, (SELECT pronargs FROM pg_proc WHERE oid = v_oid)) i;
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA latin_quest_private', v_name, v_identity);
    EXECUTE format('ALTER FUNCTION latin_quest_private.%I(%s) RENAME TO %I', v_name, v_identity, 'legacy_' || v_name);
    EXECUTE format('REVOKE ALL ON FUNCTION latin_quest_private.%I(%s) FROM PUBLIC, anon, authenticated, service_role', 'legacy_' || v_name, v_identity);
    EXECUTE format('CREATE FUNCTION latin_quest_private.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''' AS $guard$
      BEGIN
        IF auth.uid() IS NULL OR NOT latin_quest_private.student_password_access_allowed() THEN
          RAISE EXCEPTION ''password_change_required'' USING errcode = ''42501'';
        END IF;
        RETURN QUERY SELECT * FROM latin_quest_private.%I(%s);
      END; $guard$', 'guarded_' || v_name, v_args, v_result, 'legacy_' || v_name, v_call);
    EXECUTE format('REVOKE ALL ON FUNCTION latin_quest_private.%I(%s) FROM PUBLIC, anon, service_role', 'guarded_' || v_name, v_identity);
    EXECUTE format('GRANT EXECUTE ON FUNCTION latin_quest_private.%I(%s) TO authenticated', 'guarded_' || v_name, v_identity);
    EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql SECURITY INVOKER SET search_path = '''' AS $wrapper$ SELECT * FROM latin_quest_private.%I(%s); $wrapper$', v_name, v_args, v_result, 'guarded_' || v_name, v_call);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, service_role', v_name, v_identity);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', v_name, v_identity);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
