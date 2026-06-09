-- ========================================
-- Skill level: chuyển A/B+/B-/C → DUPR-style 2.0/2.5/2.75/3.0+
-- Cho phép custom value để Admin/Coach nhập trình độ khác (3.5, 4.0…)
-- ========================================

-- 1. Drop CHECK constraint cũ
ALTER TABLE members
  DROP CONSTRAINT IF EXISTS members_skill_level_check;

-- 2. Migrate existing data
-- A (cao nhất)  → 3.0+
-- B+            → 2.75
-- B-            → 2.5
-- C (thấp nhất) → 2.0
UPDATE members
SET skill_level = CASE skill_level
  WHEN 'A'  THEN '3.0+'
  WHEN 'B+' THEN '2.75'
  WHEN 'B-' THEN '2.5'
  WHEN 'C'  THEN '2.0'
  ELSE skill_level  -- giữ nguyên nếu đã là custom
END
WHERE skill_level IN ('A', 'B+', 'B-', 'C');

-- 3. Constraint mới: cho phép free-form string nhưng giới hạn độ dài
ALTER TABLE members
  ADD CONSTRAINT members_skill_level_check
  CHECK (skill_level IS NULL OR (length(trim(skill_level)) BETWEEN 1 AND 10));

ALTER TABLE members
  ALTER COLUMN skill_level DROP NOT NULL;

-- 4. Migrate tournaments.skill_filter (text[] array)
UPDATE tournaments
SET skill_filter = (
  SELECT array_agg(
    CASE x
      WHEN 'A'  THEN '3.0+'
      WHEN 'B+' THEN '2.75'
      WHEN 'B-' THEN '2.5'
      WHEN 'C'  THEN '2.0'
      ELSE x
    END
  )
  FROM unnest(skill_filter) x
)
WHERE skill_filter IS NOT NULL
  AND skill_filter && ARRAY['A','B+','B-','C']::text[];

-- 5. Update signup_member RPC: default '2.0' thay vì 'C'
DROP FUNCTION IF EXISTS public.signup_member(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.signup_member(
  p_full_name text,
  p_email text,
  p_phone text,
  p_experience text DEFAULT 'beginner',
  p_gender text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_existing_id uuid;
  v_signup_bonus int := 20;
  v_walkin_count int := 0;
  v_is_new boolean := false;
  v_clean_phone text;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Họ tên không được để trống';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email không được để trống';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Số điện thoại là bắt buộc';
  END IF;
  v_clean_phone := trim(p_phone);
  IF length(v_clean_phone) < 9 OR length(v_clean_phone) > 15 THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ (9-15 ký tự)';
  END IF;
  IF p_experience NOT IN ('beginner', 'under_6m', 'over_6m') THEN
    RAISE EXCEPTION 'Kinh nghiệm không hợp lệ';
  END IF;
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Giới tính không hợp lệ';
  END IF;

  SELECT id INTO v_existing_id
  FROM members
  WHERE lower(email) = lower(p_email);

  IF v_existing_id IS NOT NULL THEN
    UPDATE members
    SET full_name = trim(p_full_name),
        phone = v_clean_phone,
        play_experience = p_experience,
        gender = COALESCE(p_gender, gender),
        is_active = true
    WHERE id = v_existing_id;
    v_member_id := v_existing_id;
  ELSE
    IF EXISTS (SELECT 1 FROM members WHERE phone = v_clean_phone) THEN
      RAISE EXCEPTION 'Số điện thoại % đã được đăng ký', v_clean_phone;
    END IF;

    INSERT INTO members (
      full_name, email, phone, play_experience, gender,
      skill_level, is_active, total_points
    )
    VALUES (
      trim(p_full_name),
      lower(trim(p_email)),
      v_clean_phone,
      p_experience,
      p_gender,
      '2.0',        -- ❗ default DUPR thấp nhất (was 'C')
      true,
      v_signup_bonus
    )
    RETURNING id INTO v_member_id;
    v_is_new := true;
  END IF;

  UPDATE walk_in_checkins
  SET converted_to_member_id = v_member_id
  WHERE phone = v_clean_phone
    AND converted_to_member_id IS NULL;
  GET DIAGNOSTICS v_walkin_count = ROW_COUNT;

  RETURN json_build_object(
    'member_id', v_member_id,
    'created', v_is_new,
    'signup_bonus', CASE WHEN v_is_new THEN v_signup_bonus ELSE 0 END,
    'linked_walkin_count', v_walkin_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_member(text, text, text, text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT skill_level, COUNT(*)
FROM members
GROUP BY skill_level
ORDER BY skill_level;
