CREATE INDEX IF NOT EXISTS student_account_audit_to_class_id_idx
  ON public.student_account_audit (to_class_id)
  WHERE to_class_id IS NOT NULL;

DROP POLICY IF EXISTS student_account_audit_admin_read
  ON public.student_account_audit;
CREATE POLICY student_account_audit_admin_read
  ON public.student_account_audit
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin((SELECT auth.uid()))));

