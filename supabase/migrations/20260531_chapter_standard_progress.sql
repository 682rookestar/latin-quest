-- Returns per-chapter standard progress for the calling student.
-- A grammar topic counts as "passed" when the student has at least one
-- completed attempt on any exercise in that topic with score_pct >= 60.
CREATE OR REPLACE FUNCTION public.get_standard_progress()
RETURNS TABLE (
  chapter_id      uuid,
  chapter_number  integer,
  total_topics    integer,
  passed_topics   integer,
  badge_earned    boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id                                                         AS chapter_id,
    c.number                                                     AS chapter_number,
    COUNT(DISTINCT e.grammar_topic_id)::integer                  AS total_topics,
    COUNT(DISTINCT
      CASE WHEN a.score_pct >= 60 THEN e.grammar_topic_id END
    )::integer                                                   AS passed_topics,
    EXISTS (
      SELECT 1 FROM chapter_badges cb
      WHERE cb.chapter_id = c.id
        AND cb.student_id = auth.uid()
    )                                                            AS badge_earned
  FROM chapters c
  LEFT JOIN exercises e
    ON e.chapter_id = c.id AND e.grammar_topic_id IS NOT NULL
  LEFT JOIN attempts a
    ON a.exercise_id = e.id
    AND a.student_id = auth.uid()
    AND a.completed_at IS NOT NULL
  GROUP BY c.id, c.number
  ORDER BY c.number;
$$;

-- Only authenticated users can call this
REVOKE ALL ON FUNCTION public.get_standard_progress() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_standard_progress() TO authenticated;
