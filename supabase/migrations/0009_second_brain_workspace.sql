-- ============================================================================
-- Datum Knowledge — 0009 Second Brain Personal Resources & Shared Workspace Sync
-- ============================================================================

-- 1) Sync reading history across devices per user
ALTER TABLE public.user_brain_state
  ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) Per-user Personal Resources Library (links, tools, snippets, templates, peer sharing)
CREATE TABLE IF NOT EXISTS public.personal_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  owner_email TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'link',
  notes TEXT NOT NULL DEFAULT '',
  project TEXT NOT NULL DEFAULT 'General',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  linked_item_id BIGINT,
  linked_item_title TEXT NOT NULL DEFAULT '',
  linked_section TEXT NOT NULL DEFAULT '',
  shared_with_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  promoted_status TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_resources_owner
  ON public.personal_resources (lower(owner_email), is_pinned DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_personal_resources_shared_gin
  ON public.personal_resources USING GIN (shared_with_emails);

DROP TRIGGER IF EXISTS trg_personal_resources_updated ON public.personal_resources;
CREATE TRIGGER trg_personal_resources_updated
  BEFORE UPDATE ON public.personal_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_brain_updated_at();

ALTER TABLE public.personal_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_resources_owner_all" ON public.personal_resources;
CREATE POLICY "personal_resources_owner_all" ON public.personal_resources
  FOR ALL
  USING (
    user_id = public.current_app_user_id()
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  )
  WITH CHECK (
    user_id = public.current_app_user_id()
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  );

DROP POLICY IF EXISTS "personal_resources_peer_read" ON public.personal_resources;
CREATE POLICY "personal_resources_peer_read" ON public.personal_resources
  FOR SELECT
  USING (
    shared_with_emails ? lower(COALESCE(auth.jwt()->>'email', ''))
  );

-- 3) Shared Team Catalog Items (Standards, SOPs, Shared Services, Links, Versions & Comments)
CREATE TABLE IF NOT EXISTS public.shared_catalog_items (
  id BIGINT PRIMARY KEY,
  data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  vis TEXT NOT NULL DEFAULT 'Internal',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_catalog_status_vis
  ON public.shared_catalog_items (status, vis, updated_at DESC);

ALTER TABLE public.shared_catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_catalog_read" ON public.shared_catalog_items;
CREATE POLICY "shared_catalog_read" ON public.shared_catalog_items
  FOR SELECT
  USING (
    (status = 'Approved' AND vis = 'Public')
    OR public.is_internal_active_user()
  );

DROP POLICY IF EXISTS "shared_catalog_admin_all" ON public.shared_catalog_items;
CREATE POLICY "shared_catalog_admin_all" ON public.shared_catalog_items
  FOR ALL
  USING (public.is_app_admin());

-- 4) Unified Collections / Starter Kits & Visual Link Boards (Official, Shared, Personal)
CREATE TABLE IF NOT EXISTS public.shared_collections (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'shared',
  vis TEXT NOT NULL DEFAULT 'Internal',
  owner_email TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_collections_tier
  ON public.shared_collections (tier, lower(owner_email), updated_at DESC);

ALTER TABLE public.shared_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_collections_read" ON public.shared_collections;
CREATE POLICY "shared_collections_read" ON public.shared_collections
  FOR SELECT
  USING (
    vis = 'Public'
    OR (tier IN ('official', 'shared') AND public.is_internal_active_user())
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  );

DROP POLICY IF EXISTS "shared_collections_owner_write" ON public.shared_collections;
CREATE POLICY "shared_collections_owner_write" ON public.shared_collections
  FOR ALL
  USING (
    public.is_app_admin()
    OR (tier = 'personal' AND lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', '')))
  );

-- 5) Shared Workspace Metadata (Categories Tree, Audit Activities, Required Reading IDs)
CREATE TABLE IF NOT EXISTS public.shared_workspace_meta (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_workspace_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_workspace_meta_read" ON public.shared_workspace_meta;
CREATE POLICY "shared_workspace_meta_read" ON public.shared_workspace_meta
  FOR SELECT
  USING (public.is_internal_active_user());

DROP POLICY IF EXISTS "shared_workspace_meta_admin_write" ON public.shared_workspace_meta;
CREATE POLICY "shared_workspace_meta_admin_write" ON public.shared_workspace_meta
  FOR ALL
  USING (public.is_app_admin());

NOTIFY pgrst, 'reload schema';
