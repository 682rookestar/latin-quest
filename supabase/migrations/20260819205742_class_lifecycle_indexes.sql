-- Cover the two foreign keys introduced by controlled class lifecycle.
CREATE INDEX IF NOT EXISTS classes_archived_by_idx
  ON public.classes (archived_by)
  WHERE archived_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS class_lifecycle_audit_actor_id_idx
  ON public.class_lifecycle_audit (actor_id)
  WHERE actor_id IS NOT NULL;
