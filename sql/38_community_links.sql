-- ========================================
-- Community Links — admin configures social channels for the CLB
-- Public + walk-in pages display only channels with active URL
-- ========================================

-- 1. Table — pre-seeded with platform metadata, admin fills URL + activates
CREATE TABLE IF NOT EXISTS community_links (
  platform       text PRIMARY KEY,
  label          text NOT NULL,
  brand_color    text NOT NULL,
  url            text,
  is_active      boolean NOT NULL DEFAULT false,
  display_order  int NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_community_links_active
  ON community_links(display_order)
  WHERE is_active = true AND url IS NOT NULL;

-- 2. RLS — everyone read active links, admin only write
ALTER TABLE community_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cl_read_active ON community_links;
DROP POLICY IF EXISTS cl_admin_read_all ON community_links;
DROP POLICY IF EXISTS cl_admin_write ON community_links;

-- Anon + authenticated can read active links with URL set
CREATE POLICY cl_read_active ON community_links
  FOR SELECT TO anon, authenticated
  USING (is_active = true AND url IS NOT NULL);

-- Admin can read all rows (including inactive) for management
CREATE POLICY cl_admin_read_all ON community_links
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admin can update (we don't expose insert/delete — table is pre-seeded)
CREATE POLICY cl_admin_write ON community_links
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Auto-stamp updated_at + updated_by on UPDATE
CREATE OR REPLACE FUNCTION public.set_community_link_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_community_link_metadata ON community_links;
CREATE TRIGGER trg_set_community_link_metadata
  BEFORE UPDATE ON community_links
  FOR EACH ROW EXECUTE FUNCTION public.set_community_link_metadata();

-- 4. Seed default platforms — all inactive, admin fills URL
INSERT INTO community_links (platform, label, brand_color, display_order, is_active) VALUES
  ('zalo',      'Zalo',      '#0068FF', 1, false),
  ('facebook',  'Facebook',  '#1877F2', 2, false),
  ('tiktok',    'TikTok',    '#010101', 3, false),
  ('instagram', 'Instagram', '#E1306C', 4, false),
  ('youtube',   'YouTube',   '#FF0000', 5, false),
  ('threads',   'Threads',   '#000000', 6, false),
  ('telegram',  'Telegram',  '#26A5E4', 7, false),
  ('website',   'Website',   '#1D9E75', 8, false)
ON CONFLICT (platform) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT platform, label, brand_color, is_active, url
FROM community_links
ORDER BY display_order;
