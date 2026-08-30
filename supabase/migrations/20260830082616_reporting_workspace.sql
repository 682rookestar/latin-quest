CREATE TABLE public.reporting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reporting_period_dates_check CHECK (ends_on >= starts_on),
  CONSTRAINT reporting_period_class_name_key UNIQUE (class_id, name)
);

CREATE TABLE public.student_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.reporting_periods(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  authored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  bfl_engagement smallint CHECK (bfl_engagement BETWEEN 1 AND 5),
  bfl_classwork smallint CHECK (bfl_classwork BETWEEN 1 AND 5),
  bfl_independent_study smallint CHECK (bfl_independent_study BETWEEN 1 AND 5),
  progress_grade smallint CHECK (progress_grade BETWEEN 1 AND 9),
  lesson_observations text NOT NULL DEFAULT '',
  strengths text NOT NULL DEFAULT '',
  improvement_targets text NOT NULL DEFAULT '',
  school_values text NOT NULL DEFAULT '',
  bene_notes text NOT NULL DEFAULT '',
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_draft text NOT NULL DEFAULT '',
  current_comment text NOT NULL DEFAULT '',
  ai_model text,
  generated_at timestamptz,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'approved')),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_reports_period_student_key UNIQUE (period_id, student_id),
  CONSTRAINT student_reports_approval_check CHECK (
    (status <> 'approved') OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  )
);

CREATE TABLE public.student_report_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.student_reports(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'generate', 'approve', 'reopen')),
  previous_status text,
  new_status text NOT NULL,
  comment_length integer NOT NULL DEFAULT 0 CHECK (comment_length >= 0),
  comment_snapshot text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reporting_periods_class_id_idx ON public.reporting_periods(class_id);
CREATE INDEX reporting_periods_dates_idx ON public.reporting_periods(starts_on, ends_on);
CREATE INDEX student_reports_period_id_idx ON public.student_reports(period_id);
CREATE INDEX student_reports_student_id_idx ON public.student_reports(student_id);
CREATE INDEX student_report_audit_report_time_idx
  ON public.student_report_audit(report_id, occurred_at DESC);

ALTER TABLE public.reporting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_report_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY reporting_periods_staff_read
  ON public.reporting_periods FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_aal2())
    AND (
      (SELECT public.is_admin(auth.uid()))
      OR (SELECT public.is_class_teacher(class_id, auth.uid()))
    )
  );

CREATE POLICY reporting_periods_staff_insert
  ON public.reporting_periods FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (SELECT public.current_user_has_aal2())
    AND (
      (SELECT public.is_admin(auth.uid()))
      OR (SELECT public.is_class_teacher(class_id, auth.uid()))
    )
  );

CREATE POLICY reporting_periods_staff_update
  ON public.reporting_periods FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_has_aal2())
    AND (
      (SELECT public.is_admin(auth.uid()))
      OR (SELECT public.is_class_teacher(class_id, auth.uid()))
    )
  )
  WITH CHECK (
    (SELECT public.current_user_has_aal2())
    AND (
      (SELECT public.is_admin(auth.uid()))
      OR (SELECT public.is_class_teacher(class_id, auth.uid()))
    )
  );

CREATE POLICY reporting_periods_staff_delete
  ON public.reporting_periods FOR DELETE TO authenticated
  USING (
    (SELECT public.current_user_has_aal2())
    AND (
      (SELECT public.is_admin(auth.uid()))
      OR (SELECT public.is_class_teacher(class_id, auth.uid()))
    )
  );

CREATE POLICY student_reports_staff_read
  ON public.student_reports FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_aal2())
    AND EXISTS (
      SELECT 1
        FROM public.reporting_periods rp
       WHERE rp.id = student_reports.period_id
         AND (
           (SELECT public.is_admin(auth.uid()))
           OR (SELECT public.is_class_teacher(rp.class_id, auth.uid()))
         )
    )
  );

CREATE POLICY student_reports_staff_insert
  ON public.student_reports FOR INSERT TO authenticated
  WITH CHECK (
    authored_by = (SELECT auth.uid())
    AND (SELECT public.current_user_has_aal2())
    AND EXISTS (
      SELECT 1
        FROM public.reporting_periods rp
        JOIN public.class_members cm
          ON cm.class_id = rp.class_id
         AND cm.student_id = student_reports.student_id
       WHERE rp.id = student_reports.period_id
         AND rp.status = 'open'
         AND (
           (SELECT public.is_admin(auth.uid()))
           OR (SELECT public.is_class_teacher(rp.class_id, auth.uid()))
         )
    )
  );

CREATE POLICY student_reports_staff_update
  ON public.student_reports FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_has_aal2())
    AND EXISTS (
      SELECT 1
        FROM public.reporting_periods rp
       WHERE rp.id = student_reports.period_id
         AND rp.status = 'open'
         AND (
           (SELECT public.is_admin(auth.uid()))
           OR (SELECT public.is_class_teacher(rp.class_id, auth.uid()))
         )
    )
  )
  WITH CHECK (
    (SELECT public.current_user_has_aal2())
    AND EXISTS (
      SELECT 1
        FROM public.reporting_periods rp
       WHERE rp.id = student_reports.period_id
         AND rp.status = 'open'
         AND (
           (SELECT public.is_admin(auth.uid()))
           OR (SELECT public.is_class_teacher(rp.class_id, auth.uid()))
         )
    )
  );

CREATE POLICY student_reports_staff_delete
  ON public.student_reports FOR DELETE TO authenticated
  USING (
    status <> 'approved'
    AND (SELECT public.current_user_has_aal2())
    AND EXISTS (
      SELECT 1
        FROM public.reporting_periods rp
       WHERE rp.id = student_reports.period_id
         AND rp.status = 'open'
         AND (
           (SELECT public.is_admin(auth.uid()))
           OR (SELECT public.is_class_teacher(rp.class_id, auth.uid()))
         )
    )
  );

CREATE POLICY student_report_audit_staff_read
  ON public.student_report_audit FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_aal2())
    AND EXISTS (
      SELECT 1
        FROM public.student_reports sr
        JOIN public.reporting_periods rp ON rp.id = sr.period_id
       WHERE sr.id = student_report_audit.report_id
         AND (
           (SELECT public.is_admin(auth.uid()))
           OR (SELECT public.is_class_teacher(rp.class_id, auth.uid()))
         )
    )
  );

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.audit_student_report_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' THEN
      v_action := 'approve';
    ELSIF NEW.status = 'generated' THEN
      v_action := 'generate';
    ELSE
      v_action := 'create';
    END IF;
  ELSIF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    v_action := 'approve';
  ELSIF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
    v_action := 'reopen';
  ELSIF NEW.generated_at IS DISTINCT FROM OLD.generated_at THEN
    v_action := 'generate';
  ELSE
    v_action := 'update';
  END IF;

  INSERT INTO public.student_report_audit (
    report_id,
    actor_id,
    action,
    previous_status,
    new_status,
    comment_length,
    comment_snapshot
  ) VALUES (
    NEW.id,
    auth.uid(),
    v_action,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
    NEW.status,
    char_length(NEW.current_comment),
    NEW.current_comment
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.audit_student_report_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER student_reports_audit_change
AFTER INSERT OR UPDATE ON public.student_reports
FOR EACH ROW EXECUTE FUNCTION private.audit_student_report_change();

REVOKE ALL ON public.reporting_periods FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.student_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.student_report_audit FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reporting_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_reports TO authenticated;
GRANT SELECT ON public.student_report_audit TO authenticated;

GRANT ALL ON public.reporting_periods TO service_role;
GRANT ALL ON public.student_reports TO service_role;
GRANT ALL ON public.student_report_audit TO service_role;
