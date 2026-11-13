-- ============================================================================
-- Planit Data Library — 0001 Core PostgreSQL Schema
-- Covers: Users, Teams, Categories (max 3 levels), Tags, Unified Catalog
-- (Documents + Resources), Versions, Attachments, Links, Comments,
-- Collections/Boards, Personal Bookmarks, Shares, Activity Audit & Search Logs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'editor', 'member', 'guest');
CREATE TYPE account_status AS ENUM ('active', 'invited', 'deactivated');
CREATE TYPE group_type AS ENUM ('department', 'functional_team');
CREATE TYPE item_class AS ENUM ('document', 'resource');
CREATE TYPE item_subtype AS ENUM (
  'doc', 'sop', 'guide', 'policy', 'checklist', 'report',
  'service', 'tool', 'link', 'template', 'media'
);
CREATE TYPE lifecycle_status AS ENUM ('Draft', 'Review', 'Approved', 'Archived', 'Deleted');
CREATE TYPE visibility_level AS ENUM ('Restricted', 'Internal', 'Public');
CREATE TYPE collection_tier AS ENUM ('personal', 'shared', 'official');
CREATE TYPE collection_mode AS ENUM ('list', 'board');
CREATE TYPE link_kind AS ENUM ('hard', 'soft');
CREATE TYPE share_target_type AS ENUM ('category', 'collection', 'document', 'resource');
CREATE TYPE share_grantee_type AS ENUM ('user', 'team', 'public_link');
CREATE TYPE granted_access_role AS ENUM ('viewer', 'commenter', 'editor', 'category_owner');

-- ----------------------------------------------------------------------------
-- Teams & Users (Departments and Functional Teams unified via group_type)
-- ----------------------------------------------------------------------------
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  group_type group_type NOT NULL DEFAULT 'department',
  color TEXT NOT NULL DEFAULT '#0a84ff',
  lead_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
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

ALTER TABLE teams
  ADD CONSTRAINT fk_teams_lead_user
  FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Categories (Hierarchical, Strictly <= 3 Levels) & Tags
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
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

CREATE INDEX idx_categories_parent ON categories(parent_id);

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

CREATE TRIGGER trg_categories_depth
BEFORE INSERT OR UPDATE OF parent_id ON categories
FOR EACH ROW EXECUTE FUNCTION enforce_category_depth();

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Unified Catalog Items (Knowledge Base Documents + Resource Library Assets)
-- ----------------------------------------------------------------------------
CREATE TABLE catalog_items (
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

CREATE INDEX idx_catalog_items_category ON catalog_items(category_id);
CREATE INDEX idx_catalog_items_status_vis ON catalog_items(status, visibility);
CREATE INDEX idx_catalog_items_owner ON catalog_items(owner_id);
CREATE INDEX idx_catalog_items_search ON catalog_items USING GIN(search_vector);

CREATE TABLE item_tags (
  item_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- Document Versions, Attachments, Dependency Links & Comments
-- ----------------------------------------------------------------------------
CREATE TABLE document_versions (
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

CREATE INDEX idx_doc_versions_item ON document_versions(item_id, version_num DESC);

CREATE TABLE attachments (
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

CREATE INDEX idx_attachments_item ON attachments(item_id);

CREATE TABLE item_links (
  source_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  target_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  link_kind link_kind NOT NULL DEFAULT 'soft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, target_id),
  CHECK (source_id <> target_id)
);

CREATE TABLE item_comments (
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
CREATE TABLE collections (
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

CREATE INDEX idx_collections_owner_tier ON collections(owner_id, tier);

-- ----------------------------------------------------------------------------
-- Personal Bookmarks, Watching, Reading Progress & Required Acknowledgments
-- ----------------------------------------------------------------------------
CREATE TABLE bookmarks (
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
CREATE TABLE shares (
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

CREATE INDEX idx_shares_target ON shares(target_type, target_id);
CREATE INDEX idx_shares_grantee ON shares(grantee_type, grantee_id);

-- ----------------------------------------------------------------------------
-- Immutable Activity Audit Log & Zero-Result Search Gap Logs
-- ----------------------------------------------------------------------------
CREATE TABLE activities (
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

CREATE INDEX idx_activities_created ON activities(created_at DESC);

CREATE TABLE search_logs (
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
