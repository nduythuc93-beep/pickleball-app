-- ========================================
-- Pickleball App — Auto-link auth.users với members
-- Khi user login lần đầu (magic link), auto match email → set members.user_id
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.members
  SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email)
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- RPC: manual link (cho trường hợp đã có auth.users nhưng member.user_id NULL)
-- App gọi function này sau khi login để đảm bảo link
-- ========================================
CREATE OR REPLACE FUNCTION public.link_current_user_to_member()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_email     text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.members
  SET user_id = auth.uid()
  WHERE lower(email) = lower(v_email)
    AND (user_id IS NULL OR user_id = auth.uid())
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_current_user_to_member() TO authenticated;
