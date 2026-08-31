-- Keep pre-signup code validation behind the application server. Anonymous
-- callers need only a boolean and must not receive class identifiers/names
-- directly from the database API.
REVOKE ALL ON FUNCTION public.validate_join_code(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_join_code(text)
  TO service_role;

-- This helper is used by RLS policies with auth.uid(). Binding the supplied
-- user id to the caller prevents authenticated users probing another pupil's
-- class memberships through the RPC endpoint.
CREATE OR REPLACE FUNCTION public.is_class_member(p_class uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT p_user = auth.uid()
     AND EXISTS (
       SELECT 1
         FROM public.class_members
        WHERE class_id = p_class
          AND student_id = p_user
     );
$function$;

REVOKE ALL ON FUNCTION public.is_class_member(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid)
  TO authenticated;
