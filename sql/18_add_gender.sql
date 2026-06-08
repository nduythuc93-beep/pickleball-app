-- ========================================
-- Phase B.2: Add gender column + update signup RPC
-- ========================================

-- 1. Add column (nullable cho existing data, CHECK constraint)
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS gender text
  CHECK (gender IS NULL OR gender IN ('male', 'female'));

-- 2. Update RPC signup_member: thêm p_gender param
DROP FUNCTION IF EXISTS public.signup_member(text, text, text, text);

CREATE OR REPLACE FUNCTION public.signup_member(
  p_full_name text,
  p_email text,
  p_phone text DEFAULT NULL,
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
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Họ tên không được để trống';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email không được để trống';
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
        phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        play_experience = p_experience,
        gender = COALESCE(p_gender, gender),
        is_active = true
    WHERE id = v_existing_id;
    RETURN json_build_object('member_id', v_existing_id, 'created', false);
  END IF;

  INSERT INTO members (
    full_name, email, phone, play_experience, gender,
    skill_level, is_active
  )
  VALUES (
    trim(p_full_name),
    lower(trim(p_email)),
    NULLIF(trim(p_phone), ''),
    p_experience,
    p_gender,
    'C',
    true
  )
  RETURNING id INTO v_member_id;

  RETURN json_build_object('member_id', v_member_id, 'created', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_member(text, text, text, text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'gender';
