-- Returns leaderboard for all classes the calling student belongs to.
-- Ranked by: badges earned (desc), then total mastery (desc), then name.
CREATE OR REPLACE FUNCTION public.get_class_leaderboard()
RETURNS TABLE (
  class_id      uuid,
  class_name    text,
  rank          bigint,
  student_id    uuid,
  display_name  text,
  badges        bigint,
  total_mastery bigint,
  is_me         boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cl.id                                              AS class_id,
    cl.name                                            AS class_name,
    RANK() OVER (
      PARTITION BY cl.id
      ORDER BY
        COUNT(DISTINCT cb.chapter_id) DESC,
        COALESCE(SUM(sp.mastery), 0) DESC,
        p.display_name
    )                                                  AS rank,
    p.id                                               AS student_id,
    p.display_name,
    COUNT(DISTINCT cb.chapter_id)                      AS badges,
    COALESCE(SUM(sp.mastery), 0)                       AS total_mastery,
    (p.id = auth.uid())                                AS is_me
  FROM class_members cm_me
  JOIN class_members cm_peer ON cm_peer.class_id = cm_me.class_id
  JOIN profiles p             ON p.id = cm_peer.student_id
  JOIN classes cl             ON cl.id = cm_me.class_id
  LEFT JOIN chapter_badges cb ON cb.student_id = p.id
  LEFT JOIN skill_progress sp ON sp.student_id = p.id
  WHERE cm_me.student_id = auth.uid()
    AND p.role = 'student'
  GROUP BY cl.id, cl.name, p.id, p.display_name
  ORDER BY cl.name, rank;
$$;

REVOKE ALL ON FUNCTION public.get_class_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_class_leaderboard() TO authenticated;
