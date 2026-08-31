ALTER TABLE public.teacher_account_audit
  DROP CONSTRAINT IF EXISTS teacher_account_audit_action_check;

ALTER TABLE public.teacher_account_audit
  ADD CONSTRAINT teacher_account_audit_action_check
  CHECK (action IN ('disable', 'restore', 'remove', 'reset_mfa'));

ALTER TABLE public.teacher_account_audit
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'success';

ALTER TABLE public.teacher_account_audit
  DROP CONSTRAINT IF EXISTS teacher_account_audit_outcome_check;

ALTER TABLE public.teacher_account_audit
  ADD CONSTRAINT teacher_account_audit_outcome_check
  CHECK (outcome IN ('pending', 'success', 'failed'));

