-- ============================================================================
-- Planit Data Library — 0004 Performance Indexes, RLS InitPlan & Lightweight RPC
-- Eliminates sequential scans in RLS helpers, prevents TOAST decompression of
-- article bodies during visibility checks, and provides a slim list RPC.
-- ============================================================================

-- 1) Covering & Lookup Indexes for RLS + Catalog Queries
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON public.users(auth_uid);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_list_cover
  ON public.catalog_items(status, visibility, category_id, updated_at DESC);

-- 2) Optimize RLS Helper Functions with (SELECT auth.uid()) InitPlan Caching
--    and avoid SELECT * (TOASTed body/search_vector) inside can_view_item().
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS UUID AS $$
  SELECT id FROM users
  WHERE auth_uid = (SELECT auth.uid()) AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION current_app_user_role()
RETURNS user_role AS $$
  SELECT role FROM users
  WHERE auth_uid = (SELECT auth.uid()) AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_view_item(p_item_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_status lifecycle_status;
  v_vis visibility_level;
  v_owner_id UUID;
  v_cat_id TEXT;
  v_uid UUID := current_app_user_id();
BEGIN
  SELECT status, visibility, owner_id, category_id
  INTO v_status, v_vis, v_owner_id, v_cat_id
  FROM catalog_items
  WHERE id = p_item_id;

  IF NOT FOUND OR v_status = 'Deleted' THEN RETURN false; END IF;
  IF is_app_admin() THEN RETURN true; END IF;
  IF v_vis = 'Public' AND v_status = 'Approved' THEN RETURN true; END IF;
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF v_owner_id = v_uid THEN RETURN true; END IF;

  IF v_status <> 'Approved' THEN
    RETURN EXISTS (
      SELECT 1 FROM categories c WHERE c.id = v_cat_id AND c.owner_id = v_uid
    ) OR EXISTS (
      SELECT 1 FROM shares s
      WHERE s.target_type = 'category' AND s.target_id = v_cat_id
        AND s.granted_role IN ('editor', 'category_owner')
        AND ((s.grantee_type = 'user' AND s.grantee_id = v_uid) OR
             (s.grantee_type = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = s.grantee_id AND tm.user_id = v_uid)))
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM shares s
    WHERE s.target_type IN ('document', 'resource') AND s.target_id = p_item_id::text
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND (
        (s.grantee_type = 'user' AND s.grantee_id = v_uid) OR
        (s.grantee_type = 'team' AND EXISTS (
          SELECT 1 FROM team_members tm WHERE tm.team_id = s.grantee_id AND tm.user_id = v_uid
        ))
      )
  ) THEN
    RETURN true;
  END IF;

  IF v_vis = 'Restricted' THEN RETURN false; END IF;
  RETURN can_view_category(v_cat_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 3) Lightweight Catalog Summary RPC (omits body, working_draft_body, search_vector)
CREATE OR REPLACE FUNCTION public.get_catalog_summaries(
  p_limit INTEGER DEFAULT 24,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  item_class item_class,
  type item_subtype,
  title TEXT,
  summary TEXT,
  target_url TEXT,
  category_id TEXT,
  owner_id UUID,
  status lifecycle_status,
  visibility visibility_level,
  stage TEXT,
  discipline TEXT,
  is_required_reading BOOLEAN,
  review_cycle_days INTEGER,
  last_verified_at DATE,
  updated_at DATE
) AS $$
  SELECT
    ci.id, ci.item_class, ci.type, ci.title, ci.summary, ci.target_url,
    ci.category_id, ci.owner_id, ci.status, ci.visibility, ci.stage, ci.discipline,
    ci.is_required_reading, ci.review_cycle_days, ci.last_verified_at, ci.updated_at
  FROM public.catalog_items ci
  WHERE ci.status <> 'Deleted'
    AND can_view_item(ci.id)
  ORDER BY ci.updated_at DESC, ci.id DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100))
  OFFSET GREATEST(0, p_offset);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

-- 4) Supabase Storage 'attachments' Bucket & RLS Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  true,
  10485760,
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "attachments_public_read" ON storage.objects;
CREATE POLICY "attachments_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_internal_insert" ON storage.objects;
CREATE POLICY "attachments_internal_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attachments'
    AND COALESCE(public.current_app_user_role() IN ('super_admin', 'admin', 'editor'), false)
  );

DROP POLICY IF EXISTS "attachments_internal_update" ON storage.objects;
CREATE POLICY "attachments_internal_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'attachments'
    AND COALESCE(public.current_app_user_role() IN ('super_admin', 'admin', 'editor'), false)
  );

DROP POLICY IF EXISTS "attachments_admin_delete" ON storage.objects;
CREATE POLICY "attachments_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'attachments'
    AND public.is_app_admin()
  );
