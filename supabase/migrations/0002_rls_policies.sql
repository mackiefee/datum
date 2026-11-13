-- ============================================================================
-- Planit Data Library — 0002 Row-Level Security (RLS) & Conflict Resolution
-- Enforces:
--   1. Deactivated users denied all access.
--   2. Super Admin / Admin global access.
--   3. Item-level Restricted overrides Category Internal.
--   4. Pinpoint Share grants item access without exposing Restricted parent Category.
--   5. Public/Guest sanitization: only Approved + Public items & cleared attachments.
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Helper: resolve current active app user id from JWT auth_uid
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS UUID AS $$
  SELECT id FROM users
  WHERE auth_uid = auth.uid() AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_app_user_role()
RETURNS user_role AS $$
  SELECT role FROM users
  WHERE auth_uid = auth.uid() AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_app_user_role() IN ('super_admin', 'admin'), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_internal_active_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_app_user_role() IN ('super_admin', 'admin', 'editor', 'member'), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_view_category(p_cat_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_cat categories%ROWTYPE;
  v_uid UUID := current_app_user_id();
BEGIN
  IF is_app_admin() THEN RETURN true; END IF;
  SELECT * INTO v_cat FROM categories WHERE id = p_cat_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_uid IS NOT NULL AND v_cat.owner_id = v_uid THEN RETURN true; END IF;
  IF v_cat.default_visibility = 'Internal' AND is_internal_active_user() THEN
    RETURN true;
  END IF;
  IF v_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM shares s
    WHERE s.target_type = 'category' AND s.target_id = p_cat_id
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
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_view_item(p_item_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_item catalog_items%ROWTYPE;
  v_uid UUID := current_app_user_id();
BEGIN
  SELECT * INTO v_item FROM catalog_items WHERE id = p_item_id;
  IF NOT FOUND OR v_item.status = 'Deleted' THEN RETURN false; END IF;

  -- Admins see all non-deleted items
  IF is_app_admin() THEN RETURN true; END IF;

  -- Public + Approved content is visible to all (including unauthenticated / guests)
  IF v_item.visibility = 'Public' AND v_item.status = 'Approved' THEN
    RETURN true;
  END IF;

  -- Must be an active authenticated user beyond this point
  IF v_uid IS NULL THEN RETURN false; END IF;

  -- Owner always sees their own item
  IF v_item.owner_id = v_uid THEN RETURN true; END IF;

  -- Draft / Review / Archived items visible only to Admins, Owners, or Category Editors/Owners
  IF v_item.status <> 'Approved' THEN
    RETURN EXISTS (
      SELECT 1 FROM categories c WHERE c.id = v_item.category_id AND c.owner_id = v_uid
    ) OR EXISTS (
      SELECT 1 FROM shares s
      WHERE s.target_type = 'category' AND s.target_id = v_item.category_id
        AND s.granted_role IN ('editor', 'category_owner')
        AND ((s.grantee_type = 'user' AND s.grantee_id = v_uid) OR
             (s.grantee_type = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = s.grantee_id AND tm.user_id = v_uid)))
    );
  END IF;

  -- Approved item: check pinpoint item share (allows access even if parent Category is Restricted)
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

  -- Conflict Rule 1: Item-level Restricted overrides Category Internal
  IF v_item.visibility = 'Restricted' THEN
    RETURN false;
  END IF;

  -- Otherwise inherit from Category
  RETURN can_view_category(v_item.category_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Table Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users viewable by internal active users" ON users
  FOR SELECT USING (is_internal_active_user() OR id = current_app_user_id());

CREATE POLICY "Admins manage users" ON users
  FOR ALL USING (is_app_admin());

CREATE POLICY "Categories viewable when permitted" ON categories
  FOR SELECT USING (can_view_category(id));

CREATE POLICY "Admins and category owners manage categories" ON categories
  FOR ALL USING (is_app_admin() OR owner_id = current_app_user_id());

CREATE POLICY "Catalog items follow visibility & permission resolution" ON catalog_items
  FOR SELECT USING (can_view_item(id));

CREATE POLICY "Owners, category editors and admins edit catalog items" ON catalog_items
  FOR UPDATE USING (
    is_app_admin()
    OR owner_id = current_app_user_id()
    OR EXISTS (SELECT 1 FROM categories c WHERE c.id = category_id AND c.owner_id = current_app_user_id())
  );

CREATE POLICY "Authenticated internal users create drafts" ON catalog_items
  FOR INSERT WITH CHECK (is_internal_active_user() AND owner_id = current_app_user_id());

CREATE POLICY "Versions strictly hidden from guests/public" ON document_versions
  FOR SELECT USING (is_internal_active_user() AND can_view_item(item_id));

CREATE POLICY "Attachments enforce cleared_for_public for guests/public" ON attachments
  FOR SELECT USING (
    can_view_item(item_id) AND (
      is_internal_active_user() OR cleared_for_public = true
    )
  );

CREATE POLICY "Comments hidden from public/guests" ON item_comments
  FOR SELECT USING (is_internal_active_user() AND can_view_item(item_id));

CREATE POLICY "Internal non-guests can comment" ON item_comments
  FOR INSERT WITH CHECK (is_internal_active_user() AND can_view_item(item_id));

CREATE POLICY "Personal bookmarks strictly isolated per user" ON bookmarks
  FOR ALL USING (user_id = current_app_user_id());

CREATE POLICY "Collections respect tier and visibility" ON collections
  FOR SELECT USING (
    is_app_admin()
    OR owner_id = current_app_user_id()
    OR visibility = 'Public'
    OR (visibility = 'Internal' AND is_internal_active_user())
    OR EXISTS (
      SELECT 1 FROM shares s
      WHERE s.target_type = 'collection' AND s.target_id = id
        AND (s.expires_at IS NULL OR s.expires_at > now())
        AND ((s.grantee_type = 'user' AND s.grantee_id = current_app_user_id())
          OR (s.grantee_type = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = s.grantee_id AND tm.user_id = current_app_user_id())))
    )
  );

CREATE POLICY "Admins read all activities; internal users read permitted" ON activities
  FOR SELECT USING (is_app_admin() OR is_internal_active_user());
