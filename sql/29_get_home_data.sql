-- ========================================
-- P2-2: get_home_data() RPC
-- Gộp 11 queries của HomePage thành 1 round-trip
-- ========================================

CREATE OR REPLACE FUNCTION public.get_home_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_today_plus_7 date := v_today + 7;
BEGIN
  -- Resolve current auth user → member_id
  SELECT id INTO v_member_id FROM members WHERE user_id = auth.uid();
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Member not found for current auth user';
  END IF;

  RETURN json_build_object(
    -- 1. Active tournaments (status != completed)
    'tournaments', COALESCE((
      SELECT json_agg(row_to_json(t.*))
      FROM (
        SELECT * FROM tournaments
        WHERE status != 'completed'
        ORDER BY event_date ASC NULLS LAST
        LIMIT 5
      ) t
    ), '[]'::json),

    -- 2. Open surveys
    'surveys', COALESCE((
      SELECT json_agg(row_to_json(s.*))
      FROM (
        SELECT id, is_open, closes_at, title, description, type,
               fields_schema, created_by, created_at
        FROM surveys
        WHERE is_open = true
        LIMIT 20
      ) s
    ), '[]'::json),

    -- 3. My responded survey IDs
    'my_responded_survey_ids', COALESCE((
      SELECT json_agg(survey_id)
      FROM survey_responses
      WHERE member_id = v_member_id
    ), '[]'::json),

    -- 4. My registered tournament IDs (not withdrawn)
    'my_registered_tournament_ids', COALESCE((
      SELECT json_agg(tournament_id)
      FROM tournament_registrations
      WHERE member_id = v_member_id AND status != 'withdrawn'
    ), '[]'::json),

    -- 5. Sessions in next 7 days (not cancelled)
    'sessions', COALESCE((
      SELECT json_agg(row_to_json(s.*))
      FROM (
        SELECT * FROM play_sessions
        WHERE session_date >= v_today
          AND session_date <= v_today_plus_7
          AND status != 'cancelled'
        ORDER BY session_date, start_time
        LIMIT 20
      ) s
    ), '[]'::json),

    -- 6. Activity types
    'activity_types', COALESCE((
      SELECT json_agg(row_to_json(a.*))
      FROM (SELECT * FROM activity_types ORDER BY display_order) a
    ), '[]'::json),

    -- 7. Session checkin counts (per session in the 7-day window)
    'session_checkin_counts', COALESCE((
      SELECT json_object_agg(session_id, cnt)
      FROM (
        SELECT sc.session_id, COUNT(*) AS cnt
        FROM session_checkins sc
        WHERE sc.session_id IN (
          SELECT id FROM play_sessions
          WHERE session_date >= v_today AND session_date <= v_today_plus_7
        )
        GROUP BY sc.session_id
      ) c
    ), '{}'::json),

    -- 8. Session attendees (members who checked in, for avatar stack)
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
          WHERE session_date >= v_today AND session_date <= v_today_plus_7
        )
        GROUP BY sc.session_id
      ) a
    ), '{}'::json),

    -- 9. Walk-in counts per session
    'session_walk_in_counts', COALESCE((
      SELECT json_object_agg(session_id, cnt)
      FROM (
        SELECT session_id, COUNT(*) AS cnt
        FROM walk_in_checkins
        WHERE session_id IS NOT NULL
          AND session_id IN (
            SELECT id FROM play_sessions
            WHERE session_date >= v_today AND session_date <= v_today_plus_7
          )
        GROUP BY session_id
      ) w
    ), '{}'::json),

    -- 10. My session check-in IDs
    'my_session_checkin_ids', COALESCE((
      SELECT json_agg(session_id)
      FROM session_checkins
      WHERE member_id = v_member_id
    ), '[]'::json),

    -- 11. Host & Coach members (active)
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

    -- 12. My opt-outs (host blocked auto-checkin)
    'my_opt_out_session_ids', COALESCE((
      SELECT json_agg(session_id)
      FROM session_host_opt_outs
      WHERE member_id = v_member_id
    ), '[]'::json),

    -- Metadata
    'me_id', v_member_id,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_data() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'get_home_data created' AS check, prokind, prosecdef
FROM pg_proc WHERE proname = 'get_home_data';
