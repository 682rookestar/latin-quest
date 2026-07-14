-- Microsoft / Entra ID SSO support
-- See supabase/migrations/20260602_microsoft_sso.sql for full comments

-- 1. azure_group_mappings table
CREATE TABLE IF NOT EXISTS public.azure_group_mappings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_object_id  text        NOT NULL UNIQUE,
  group_name       text        NOT NULL,
  role             text        NOT NULL DEFAULT 'student'
                               CHECK (role IN ('student', 'teacher', 'admin')),
  class_id         uuid        REFERENCES public.classes(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.azure_group_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_group_mappings"
  ON public.azure_group_mappings
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 2 & 3: handle_new_user + sync_sso_groups — applied directly via MCP
-- (functions defined in apply_migration call above)
