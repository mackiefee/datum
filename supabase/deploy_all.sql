-- Planit Data Library - Consolidated Idempotent Supabase Setup Script
-- Run the ENTIRE script once in Supabase Dashboard -> SQL Editor

SET search_path TO public, extensions;

-- 1) Core Schema
-- ============================================================================
-- Planit Data Library â€” 0001 Core PostgreSQL Schema
-- Covers: Users, Teams, Categories (max 3 levels), Tags, Unified Catalog
-- (Documents + Resources), Versions, Attachments, Links, Comments,
-- Collections/Boards, Personal Bookmarks, Shares, Activity Audit & Search Logs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'editor', 'member', 'guest');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'invited', 'deactivated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE group_type AS ENUM ('department', 'functional_team');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE item_class AS ENUM ('document', 'resource');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE item_subtype AS ENUM (
  'doc', 'sop', 'guide', 'policy', 'checklist', 'report',
  'service', 'tool', 'link', 'template', 'media'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE lifecycle_status AS ENUM ('Draft', 'Review', 'Approved', 'Archived', 'Deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE visibility_level AS ENUM ('Restricted', 'Internal', 'Public');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE collection_tier AS ENUM ('personal', 'shared', 'official');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE collection_mode AS ENUM ('list', 'board');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE link_kind AS ENUM ('hard', 'soft');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE share_target_type AS ENUM ('category', 'collection', 'document', 'resource');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE share_grantee_type AS ENUM ('user', 'team', 'public_link');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE granted_access_role AS ENUM ('viewer', 'commenter', 'editor', 'category_owner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- Teams & Users (Departments and Functional Teams unified via group_type)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  group_type group_type NOT NULL DEFAULT 'department',
  color TEXT NOT NULL DEFAULT '#0a84ff',
  lead_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'member',
  status account_status NOT NULL DEFAULT 'active',
  primary_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  preferences JSONB NOT NULL DEFAULT '{"theme": "system"}'::jsonb,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE teams
  ADD CONSTRAINT fk_teams_lead_user
  FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Categories (Hierarchical, Strictly <= 3 Levels) & Tags
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT NOT NULL DEFAULT '#8e8e93',
  owner_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  default_visibility visibility_level NOT NULL DEFAULT 'Internal',
  require_approval BOOLEAN NOT NULL DEFAULT false,
  review_cycle_days INTEGER NOT NULL DEFAULT 90 CHECK (review_cycle_days > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

CREATE OR REPLACE FUNCTION enforce_category_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_level SMALLINT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 1;
  ELSE
    SELECT level INTO parent_level FROM categories WHERE id = NEW.parent_id;
    IF parent_level IS NULL THEN
      RAISE EXCEPTION 'Parent category % does not exist', NEW.parent_id;
    END IF;
    IF parent_level >= 3 THEN
      RAISE EXCEPTION 'Category hierarchy cannot exceed 3 levels';
    END IF;
    NEW.level := parent_level + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categories_depth ON categories;
CREATE TRIGGER trg_categories_depth
BEFORE INSERT OR UPDATE OF parent_id ON categories
FOR EACH ROW EXECUTE FUNCTION enforce_category_depth();

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Unified Catalog Items (Knowledge Base Documents + Resource Library Assets)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_items (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  item_class item_class NOT NULL DEFAULT 'document',
  type item_subtype NOT NULL DEFAULT 'doc',
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  target_url TEXT DEFAULT '',
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status lifecycle_status NOT NULL DEFAULT 'Draft',
  visibility visibility_level NOT NULL DEFAULT 'Internal',
  stage TEXT DEFAULT 'Design',
  discipline TEXT DEFAULT 'Architecture',
  is_required_reading BOOLEAN NOT NULL DEFAULT false,
  required_team_ids UUID[] NOT NULL DEFAULT '{}',
  review_cycle_days INTEGER NOT NULL DEFAULT 90,
  last_verified_at DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  working_draft_body TEXT,
  working_draft_updated_at TIMESTAMPTZ,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_status_vis ON catalog_items(status, visibility);
CREATE INDEX IF NOT EXISTS idx_catalog_items_owner ON catalog_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_search ON catalog_items USING GIN(search_vector);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- Document Versions, Attachments, Dependency Links & Comments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  version_num INTEGER NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  change_note TEXT NOT NULL DEFAULT 'Updated',
  title_snapshot TEXT NOT NULL,
  body_snapshot TEXT NOT NULL,
  is_working_draft BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, version_num)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_item ON document_versions(item_id, version_num DESC);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cleared_for_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments(item_id);

CREATE TABLE IF NOT EXISTS item_links (
  source_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  target_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  link_kind link_kind NOT NULL DEFAULT 'soft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, target_id),
  CHECK (source_id <> target_id)
);

CREATE TABLE IF NOT EXISTS item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Collections & Visual Link Boards (Unified Model)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tier collection_tier NOT NULL DEFAULT 'personal',
  view_mode collection_mode NOT NULL DEFAULT 'list',
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visibility visibility_level NOT NULL DEFAULT 'Restricted',
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  nodes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  viewport_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_owner_tier ON collections(owner_id, tier);

-- ----------------------------------------------------------------------------
-- Personal Bookmarks, Watching, Reading Progress & Required Acknowledgments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_watching BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  reading_progress_pct SMALLINT NOT NULL DEFAULT 0 CHECK (reading_progress_pct BETWEEN 0 AND 100),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_version INTEGER,
  checklist_state_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- ----------------------------------------------------------------------------
-- Explicit Access Grants & Public Share Tokens
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type share_target_type NOT NULL,
  target_id TEXT NOT NULL,
  grantee_type share_grantee_type NOT NULL,
  grantee_id UUID,
  public_token TEXT UNIQUE,
  granted_role granted_access_role NOT NULL DEFAULT 'viewer',
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shares_target ON shares(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_shares_grantee ON shares(grantee_type, grantee_id);

-- ----------------------------------------------------------------------------
-- Immutable Activity Audit Log & Zero-Result Search Gap Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_title TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);

CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Stored Functions: Deactivation Ownership Handover & Transitive Impact
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deactivate_user_and_transfer_ownership(
  p_user_id UUID,
  p_fallback_user_id UUID,
  p_actor_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_reassigned_items INTEGER := 0;
  v_reassigned_cats INTEGER := 0;
  v_reassigned_cols INTEGER := 0;
  v_actor_name TEXT;
  v_target_name TEXT;
BEGIN
  IF p_user_id = p_fallback_user_id THEN
    RAISE EXCEPTION 'Fallback owner must be a different active user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_fallback_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'Fallback owner must exist and be active';
  END IF;

  SELECT name INTO v_actor_name FROM users WHERE id = p_actor_id;
  SELECT name INTO v_target_name FROM users WHERE id = p_user_id;

  -- Reassign owned catalog items to category owner if active, otherwise fallback user
  UPDATE catalog_items ci
  SET owner_id = COALESCE(
    (SELECT c.owner_id FROM categories c JOIN users u ON u.id = c.owner_id
     WHERE c.id = ci.category_id AND c.owner_id <> p_user_id AND u.status = 'active'),
    p_fallback_user_id
  )
  WHERE ci.owner_id = p_user_id;
  GET DIAGNOSTICS v_reassigned_items = ROW_COUNT;

  -- Reassign owned categories
  UPDATE categories SET owner_id = p_fallback_user_id WHERE owner_id = p_user_id;
  GET DIAGNOSTICS v_reassigned_cats = ROW_COUNT;

  -- Reassign shared/official collections (personal collections stay archived under deactivated user)
  UPDATE collections SET owner_id = p_fallback_user_id
  WHERE owner_id = p_user_id AND tier <> 'personal';
  GET DIAGNOSTICS v_reassigned_cols = ROW_COUNT;

  -- Revoke shares granted directly to this user
  DELETE FROM shares WHERE grantee_type = 'user' AND grantee_id = p_user_id;

  -- Deactivate the user account
  UPDATE users SET status = 'deactivated' WHERE id = p_user_id;

  -- Audit log
  INSERT INTO activities (actor_id, actor_name, action_type, target_type, target_id, target_title, details)
  VALUES (
    p_actor_id,
    coalesce(v_actor_name, 'System Admin'),
    'user_deactivated',
    'user',
    p_user_id::text,
    coalesce(v_target_name, ''),
    jsonb_build_object(
      'fallback_owner_id', p_fallback_user_id,
      'reassigned_items', v_reassigned_items,
      'reassigned_categories', v_reassigned_cats,
      'reassigned_collections', v_reassigned_cols
    )
  );

  RETURN jsonb_build_object(
    'deactivated_user_id', p_user_id,
    'reassigned_items', v_reassigned_items,
    'reassigned_categories', v_reassigned_cats,
    'reassigned_collections', v_reassigned_cols
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_transitive_hard_impact(p_item_id BIGINT)
RETURNS TABLE(dependent_item_id BIGINT, title TEXT, depth INTEGER) AS $$
  WITH RECURSIVE impact_tree AS (
    SELECT il.source_id, 1 AS depth
    FROM item_links il
    WHERE il.target_id = p_item_id AND il.link_kind = 'hard'
    UNION
    SELECT il.source_id, it.depth + 1
    FROM item_links il
    JOIN impact_tree it ON il.target_id = it.source_id
    WHERE il.link_kind = 'hard' AND it.depth < 10
  )
  SELECT DISTINCT ci.id, ci.title, MIN(it.depth) AS depth
  FROM impact_tree it
  JOIN catalog_items ci ON ci.id = it.source_id
  WHERE ci.status <> 'Deleted'
  GROUP BY ci.id, ci.title
  ORDER BY depth ASC, ci.title ASC;
$$ LANGUAGE sql STABLE;

-- 2) Row-Level Security Policies
-- ============================================================================
-- Planit Data Library â€” 0002 Row-Level Security (RLS) & Conflict Resolution
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
DROP POLICY IF EXISTS "Users viewable by internal active users" ON users;
CREATE POLICY "Users viewable by internal active users" ON users
  FOR SELECT USING (is_internal_active_user() OR id = current_app_user_id());

DROP POLICY IF EXISTS "Admins manage users" ON users;
CREATE POLICY "Admins manage users" ON users
  FOR ALL USING (is_app_admin());

DROP POLICY IF EXISTS "Categories viewable when permitted" ON categories;
CREATE POLICY "Categories viewable when permitted" ON categories
  FOR SELECT USING (can_view_category(id));

DROP POLICY IF EXISTS "Admins and category owners manage categories" ON categories;
CREATE POLICY "Admins and category owners manage categories" ON categories
  FOR ALL USING (is_app_admin() OR owner_id = current_app_user_id());

DROP POLICY IF EXISTS "Catalog items follow visibility & permission resolution" ON catalog_items;
CREATE POLICY "Catalog items follow visibility & permission resolution" ON catalog_items
  FOR SELECT USING (can_view_item(id));

DROP POLICY IF EXISTS "Owners, category editors and admins edit catalog items" ON catalog_items;
CREATE POLICY "Owners, category editors and admins edit catalog items" ON catalog_items
  FOR UPDATE USING (
    is_app_admin()
    OR owner_id = current_app_user_id()
    OR EXISTS (SELECT 1 FROM categories c WHERE c.id = category_id AND c.owner_id = current_app_user_id())
  );

DROP POLICY IF EXISTS "Authenticated internal users create drafts" ON catalog_items;
CREATE POLICY "Authenticated internal users create drafts" ON catalog_items
  FOR INSERT WITH CHECK (is_internal_active_user() AND owner_id = current_app_user_id());

DROP POLICY IF EXISTS "Versions strictly hidden from guests/public" ON document_versions;
CREATE POLICY "Versions strictly hidden from guests/public" ON document_versions
  FOR SELECT USING (is_internal_active_user() AND can_view_item(item_id));

DROP POLICY IF EXISTS "Attachments enforce cleared_for_public for guests/public" ON attachments;
CREATE POLICY "Attachments enforce cleared_for_public for guests/public" ON attachments
  FOR SELECT USING (
    can_view_item(item_id) AND (
      is_internal_active_user() OR cleared_for_public = true
    )
  );

DROP POLICY IF EXISTS "Comments hidden from public/guests" ON item_comments;
CREATE POLICY "Comments hidden from public/guests" ON item_comments
  FOR SELECT USING (is_internal_active_user() AND can_view_item(item_id));

DROP POLICY IF EXISTS "Internal non-guests can comment" ON item_comments;
CREATE POLICY "Internal non-guests can comment" ON item_comments
  FOR INSERT WITH CHECK (is_internal_active_user() AND can_view_item(item_id));

DROP POLICY IF EXISTS "Personal bookmarks strictly isolated per user" ON bookmarks;
CREATE POLICY "Personal bookmarks strictly isolated per user" ON bookmarks
  FOR ALL USING (user_id = current_app_user_id());

DROP POLICY IF EXISTS "Collections respect tier and visibility" ON collections;
CREATE POLICY "Collections respect tier and visibility" ON collections
  FOR SELECT USING (
    is_app_admin()
    OR owner_id = current_app_user_id()
    OR visibility = 'Public'
    OR (visibility = 'Internal' AND is_internal_active_user())
    OR EXISTS (
      SELECT 1 FROM shares s
      WHERE s.target_type = 'collection' AND s.target_id = collections.id
        AND (s.expires_at IS NULL OR s.expires_at > now())
        AND ((s.grantee_type = 'user' AND s.grantee_id = current_app_user_id())
          OR (s.grantee_type = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = s.grantee_id AND tm.user_id = current_app_user_id())))
    )
  );

DROP POLICY IF EXISTS "Admins read all activities; internal users read permitted" ON activities;
CREATE POLICY "Admins read all activities; internal users read permitted" ON activities
  FOR SELECT USING (is_app_admin() OR is_internal_active_user());

-- 3) Google OAuth & Security Hardening
-- ============================================================================
-- Planit Data Library â€” 0003 Google OAuth + Supabase Auth Security Hardening
-- Enforces verified Google Identity profile syncing (name, email, avatar_url),
-- hosted domain whitelisting, deactivated account blocking, and auth audit logs.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hosted_domain TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

-- Allowed corporate Google Workspace domains (empty = allow explicit pre-invited emails only)
CREATE TABLE IF NOT EXISTS public.allowed_domains (
  domain TEXT PRIMARY KEY,
  default_role user_role NOT NULL DEFAULT 'member',
  enforce_verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.allowed_domains (domain, default_role, enforce_verified)
VALUES
  ('planit.studio', 'member', true),
  ('planit-inc.com', 'member', true),
  ('gmail.com', 'member', true)
ON CONFLICT (domain) DO NOTHING;

-- Immutable Auth Security Audit Log
CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  event_type TEXT NOT NULL, -- 'login_success' | 'login_blocked_domain' | 'login_blocked_deactivated' | 'logout' | 'token_revoked'
  hosted_domain TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON public.auth_audit_logs(created_at DESC);

ALTER TABLE public.allowed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allowed_domains_read ON public.allowed_domains;
CREATE POLICY allowed_domains_read ON public.allowed_domains
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS allowed_domains_admin_write ON public.allowed_domains;
CREATE POLICY allowed_domains_admin_write ON public.allowed_domains
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_uid = auth.uid() AND u.status = 'active' AND u.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS auth_audit_admin_read ON public.auth_audit_logs;
CREATE POLICY auth_audit_admin_read ON public.auth_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_uid = auth.uid() AND u.status = 'active' AND u.role IN ('super_admin', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- Trigger: Sync Google OAuth User Profile on Sign-In / Sign-Up
-- Pulls full_name, email, avatar_url (picture), sub, and hosted domain (hd).
-- Blocks unverified Google emails and deactivated accounts.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_google_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_provider TEXT := COALESCE(NEW.raw_app_meta_data->>'provider', 'google');
  v_email TEXT := lower(trim(COALESCE(NEW.email, '')));
  v_domain TEXT := split_part(v_email, '@', 2);
  v_verified BOOLEAN := COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, NEW.email_confirmed_at IS NOT NULL, false);
  v_name TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1)
  );
  v_avatar TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'picture'), '')
  );
  v_sub TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'provider_id'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'sub'), '')
  );
  v_hd TEXT := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'hd'), ''), v_domain);
  v_existing public.users%ROWTYPE;
  v_dom public.allowed_domains%ROWTYPE;
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'Google OAuth account must include a valid email address';
  END IF;

  IF NOT v_verified THEN
    INSERT INTO public.auth_audit_logs(auth_uid, email, provider, event_type, hosted_domain)
    VALUES (NEW.id, v_email, v_provider, 'login_blocked_unverified', v_hd);
    RAISE EXCEPTION 'Google account email must be verified';
  END IF;

  SELECT * INTO v_existing FROM public.users WHERE auth_uid = NEW.id OR lower(email) = v_email LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'deactivated' THEN
      INSERT INTO public.auth_audit_logs(auth_uid, user_id, email, provider, event_type, hosted_domain)
      VALUES (NEW.id, v_existing.id, v_email, v_provider, 'login_blocked_deactivated', v_hd);
      RAISE EXCEPTION 'Account % has been deactivated by an administrator', v_email;
    END IF;

    UPDATE public.users
    SET
      auth_uid = NEW.id,
      name = COALESCE(NULLIF(v_name, ''), name),
      avatar_url = COALESCE(v_avatar, avatar_url),
      google_sub = COALESCE(v_sub, google_sub),
      email_verified = v_verified,
      hosted_domain = v_hd,
      status = 'active',
      last_login_at = now(),
      last_seen_at = now()
    WHERE id = v_existing.id;

    INSERT INTO public.auth_audit_logs(auth_uid, user_id, email, provider, event_type, hosted_domain)
    VALUES (NEW.id, v_existing.id, v_email, v_provider, 'login_success', v_hd);
    RETURN NEW;
  END IF;

  -- New user: resolve role from allowed_domains (or default to member for any verified Google account)
  SELECT * INTO v_dom FROM public.allowed_domains WHERE lower(domain) = lower(v_hd) LIMIT 1;

  INSERT INTO public.users (auth_uid, name, email, avatar_url, google_sub, email_verified, hosted_domain, role, status, last_login_at, last_seen_at)
  VALUES (
    NEW.id,
    v_name,
    v_email,
    v_avatar,
    v_sub,
    v_verified,
    v_hd,
    COALESCE(v_dom.default_role, 'member'::user_role),
    'active',
    now(),
    now()
  )
  RETURNING * INTO v_existing;

  INSERT INTO public.auth_audit_logs(auth_uid, user_id, email, provider, event_type, hosted_domain)
  VALUES (NEW.id, v_existing.id, v_email, v_provider, 'login_success', v_hd);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_google_user_sync ON auth.users;
CREATE TRIGGER on_auth_google_user_sync
  AFTER INSERT OR UPDATE OF raw_user_meta_data, last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_google_auth_user();

-- Helper used by RLS policies to guarantee deactivated or revoked sessions fail closed
CREATE OR REPLACE FUNCTION public.is_active_authenticated_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.status = 'active'
      AND u.email_verified = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Allow admins to revoke all active sessions by incrementing session_version
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid() AND u.status = 'active' AND u.role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only Admins can revoke user sessions';
  END IF;

  UPDATE public.users SET session_version = session_version + 1 WHERE id = p_target_user_id;
  INSERT INTO public.auth_audit_logs(user_id, email, event_type)
  SELECT id, email, 'token_revoked' FROM public.users WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4) Initial Seed Data
-- ============================================================================
-- Planit Data Library â€” Initial Seed Data
-- ============================================================================

INSERT INTO public.teams (id, name, group_type, color) VALUES
  ('11111111-1111-1111-1111-111111111101', 'VDC', 'department', '#8e5cf7'),
  ('11111111-1111-1111-1111-111111111102', 'Structural', 'department', '#ff375f'),
  ('11111111-1111-1111-1111-111111111103', 'Interior', 'department', '#ff9f0a'),
  ('11111111-1111-1111-1111-111111111104', 'P&C', 'department', '#0071e3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, name, email, role, status, primary_team_id) VALUES
  ('22222222-2222-2222-2222-222222222201', 'Maxim', 'maxim@planit.studio', 'super_admin', 'active', '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222202', 'Iryna P.', 'iryna@planit.studio', 'editor', 'active', '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222203', 'Andrii B.', 'andrii@planit.studio', 'editor', 'active', '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222204', 'Olena K.', 'olena@planit.studio', 'admin', 'active', '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222205', 'Sofiia L.', 'sofiia@planit.studio', 'member', 'active', '11111111-1111-1111-1111-111111111103'),
  ('22222222-2222-2222-2222-222222222206', 'External Partner', 'partner@client.example', 'guest', 'active', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, parent_id, level, name, slug, color, owner_id, default_visibility, require_approval, review_cycle_days, sort_order) VALUES
  ('gen', NULL, 1, 'General', 'general', '#8e8e93', '22222222-2222-2222-2222-222222222201', 'Internal', true, 90, 1),
  ('gen-pol', 'gen', 2, 'Policies', 'policies', '#8e8e93', '22222222-2222-2222-2222-222222222201', 'Internal', true, 90, 1),
  ('gen-link', 'gen', 2, 'Services and links', 'services-and-links', '#8e8e93', '22222222-2222-2222-2222-222222222204', 'Internal', false, 180, 2),
  ('vdc', NULL, 1, 'VDC', 'vdc', '#8e5cf7', '22222222-2222-2222-2222-222222222201', 'Internal', true, 90, 2),
  ('vdc-bim', 'vdc', 2, 'BIM standards', 'bim-standards', '#8e5cf7', '22222222-2222-2222-2222-222222222201', 'Internal', true, 90, 1),
  ('vdc-name', 'vdc-bim', 3, 'Naming', 'naming', '#8e5cf7', '22222222-2222-2222-2222-222222222202', 'Internal', true, 90, 1),
  ('vdc-proc', 'vdc', 2, 'Processes', 'processes', '#8e5cf7', '22222222-2222-2222-2222-222222222201', 'Internal', true, 90, 2),
  ('vdc-tool', 'vdc', 2, 'Revit tools', 'revit-tools', '#8e5cf7', '22222222-2222-2222-2222-222222222201', 'Internal', false, 120, 3),
  ('str', NULL, 1, 'Structural', 'structural', '#ff375f', '22222222-2222-2222-2222-222222222204', 'Internal', true, 90, 3),
  ('str-std', 'str', 2, 'Standards', 'standards', '#ff375f', '22222222-2222-2222-2222-222222222204', 'Internal', true, 90, 1),
  ('str-tpl', 'str', 2, 'Templates', 'templates', '#ff375f', '22222222-2222-2222-2222-222222222204', 'Internal', false, 180, 2),
  ('int', NULL, 1, 'Interior', 'interior', '#ff9f0a', '22222222-2222-2222-2222-222222222205', 'Internal', false, 90, 4),
  ('int-fam', 'int', 2, 'Families', 'families', '#ff9f0a', '22222222-2222-2222-2222-222222222205', 'Internal', false, 180, 1),
  ('int-std', 'int', 2, 'Standards', 'standards', '#ff9f0a', '22222222-2222-2222-2222-222222222205', 'Internal', true, 90, 2),
  ('pc', NULL, 1, 'P&C', 'pc', '#0071e3', '22222222-2222-2222-2222-222222222204', 'Restricted', true, 90, 5),
  ('pc-proc', 'pc', 2, 'Processes', 'processes', '#0071e3', '22222222-2222-2222-2222-222222222204', 'Restricted', true, 90, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.catalog_items (id, item_class, type, title, summary, body, target_url, category_id, owner_id, status, visibility, stage, discipline, is_required_reading, last_verified_at, updated_at) VALUES
  (1, 'document', 'doc', 'BIM Execution Plan â€” template', 'BEP basis for every new project: roles, CDE, exchange schedule.', 'The BEP defines roles, responsibilities, exchange formats and project checkpoints.', '', 'vdc-bim', '22222222-2222-2222-2222-222222222201', 'Approved', 'Internal', 'Concept', 'VDC', false, '2026-10-14', '2026-10-14'),
  (2, 'document', 'doc', 'File and model naming', 'Unified code scheme: project-originator-volume-level-type-number.', 'All files in the CDE are named using the project-originator-volume-level-type-number scheme.', '', 'vdc-name', '22222222-2222-2222-2222-222222222202', 'Approved', 'Public', 'Design', 'VDC', true, '2026-09-30', '2026-09-30'),
  (9, 'resource', 'service', 'pyRevit â€” corporate extension', 'Custom scripts for sheets, annotations and model checking.', 'Install via internal repo and run weekly updater.', 'https://pyrevitlabs.io', 'vdc-tool', '22222222-2222-2222-2222-222222222201', 'Approved', 'Internal', 'Design', 'VDC', false, '2026-10-19', '2026-10-19'),
  (10, 'resource', 'service', 'Redmine â€” project tasks', 'Tracker of tasks and deadlines by project.', 'Log all model changes affecting issue.', 'https://www.redmine.org', 'gen-link', '22222222-2222-2222-2222-222222222204', 'Approved', 'Internal', 'Design', 'Architecture', false, '2026-08-30', '2026-08-30'),
  (12, 'document', 'policy', 'CDE access policy', 'Who can see and edit what, and at which level.', 'Access is granted at the department, folder or individual document level.', '', 'gen-pol', '22222222-2222-2222-2222-222222222201', 'Draft', 'Restricted', 'Concept', 'VDC', false, '2026-10-21', '2026-10-21')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.catalog_items', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.catalog_items));

-- 5) Performance Indexes, RLS InitPlan & Lightweight Summary RPC (0004)
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON public.users(auth_uid);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_list_cover
  ON public.catalog_items(status, visibility, category_id, updated_at DESC);

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

-- 5b) Supabase Storage 'attachments' Bucket & RLS Policies
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

-- 6) Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
