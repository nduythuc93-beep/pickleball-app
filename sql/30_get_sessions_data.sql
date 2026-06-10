-- ========================================
-- get_sessions_data(date_from, date_to) RPC
-- Single round-trip for SessionsPage (was 6 parallel queries)
-- ========================================

CREATE OR REPLACE FUNCTION public.get_sessions_data(
  p_date_from date,
  p_date_to date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM members WHERE user_id = auth.uid();
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Member not found for current auth user';
  END IF;

  RETURN json_build_object(
    -- 1. Sessions in the requested date range (not cancelled)
    'sessions', COALESCE((
      SELECT json_agg(row_to_json(s.*))
      FROM (
        SELECT * FROM play_sessions
        WHERE session_date >= p_date_from
          AND session_date <= p_date_to
          AND status != 'cancelled'
        ORDER BY session_date, start_time
      ) s
    ), '[]'::json),

    -- 2. Activity types
    'activity_types', COALESCE((
      SELECT json_agg(row_to_json(a.*))
      FROM (SELECT * FROM activity_types ORDER BY display_order) a
    ), '[]'::json),

    -- 3. Session checkin counts per session
    'session_checkin_counts', COALESCE((
      SELECT json_object_agg(session_id, cnt)
      FROM (
        SELECT sc.session_id, COUNT(*) AS cnt
        FROM session_checkins sc
        WHERE sc.session_id IN (
          SELECT id FROM play_sessions
          WHERE session_date >= p_date_from AND session_date <= p_date_to
        )
        GROUP BY sc.session_id
      ) c
    ), '{}'::json),

    -- 4. Session attendees (for avatar stack on hero cards)
    'session_attendees', COALESCE((
      SELECT json_object_agg(session_id, members_arr)
      FROM (
        SELECT sc.session_id,
               json_agg(json_build_object(
                 'id', m.id,
                 'full_name', m.full_name,
                 'avatar_url', m.avatar_url,
                 'avatar_updated_at', m.avatar_updated_at,
                 'is_host', m.is_host,
                 'is_coach', m.is_coach
               ) ORDER BY sc.checked_in_at) AS members_arr
        FROM session_checkins sc
        JOIN members m ON m.id = sc.member_id
        WHERE sc.session_id IN (
          SELECT id FROM play_sessions
          WHERE session_date >= p_date_from AND session_date <= p_date_to
        )
        GROUP BY sc.session_id
      ) a
    ), '{}'::json),

    -- 5. Walk-in counts per session
    'session_walk_in_counts', COALESCE((
      SELECT json_object_agg(session_id, cnt)
      FROM (
        SELECT session_id, COUNT(*) AS cnt
        FROM walk_in_checkins
        WHERE session_id IS NOT NULL
          AND session_id IN (
            SELECT id FROM play_sessions
            WHERE session_date >= p_date_from AND session_date <= p_date_to
          )
        GROUP BY session_id
      ) w
    ), '{}'::json),

    -- 6. My session check-in IDs (across all sessions, not just window)
    'my_session_checkin_ids', COALESCE((
      SELECT json_agg(session_id)
      FROM session_checkins
      WHERE member_id = v_member_id
    ), '[]'::json),

    -- 7. Host & Coach members (active)
    'host_coach_members', COALESCE((
      SELECT json_agg(json_build_object(
        'id', id,
        'full_name', full_name,
        'avatar_url', avatar_url,
        'avatar_updated_at', avatar_updated_at,
        'is_host', is_host,
        'is_coach', is_coach
      ))
      FROM members
      WHERE is_active = true AND (is_host = true OR is_coach = true)
    ), '[]'::json),

    -- 8. My opt-outs
    'my_opt_out_session_ids', COALESCE((
      SELECT json_agg(session_id)
      FROM session_host_opt_outs
      WHERE member_id = v_member_id
    ), '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sessions_data(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'get_sessions_data created' AS check, prokind, prosecdef
FROM pg_proc WHERE proname = 'get_sessions_data';
