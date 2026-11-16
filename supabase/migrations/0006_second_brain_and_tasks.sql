-- ============================================================================
-- Datum Knowledge — 0006 Personal Second Brain (Tasks, Quick Notes, Cloud State)
-- Strictly per-user isolated: each user only accesses their own rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS personal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_email TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  project TEXT NOT NULL DEFAULT 'General',
  due_date DATE,
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  linked_item_id BIGINT,
  linked_item_title TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_owner_email
  ON personal_tasks (lower(owner_email), status, due_date);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_id
  ON personal_tasks (user_id, status);

CREATE TABLE IF NOT EXISTS personal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_email TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  project TEXT NOT NULL DEFAULT 'General',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  linked_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_notes_owner_email
  ON personal_notes (lower(owner_email), is_pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_notes_user_id
  ON personal_notes (user_id);

CREATE TABLE IF NOT EXISTS user_brain_state (
  owner_email TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  favs JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned JSONB NOT NULL DEFAULT '[]'::jsonb,
  acks JSONB NOT NULL DEFAULT '{}'::jsonb,
  chk JSONB NOT NULL DEFAULT '{}'::jsonb,
  chats JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_chat_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_brain_state_user_id
  ON user_brain_state (user_id);

CREATE OR REPLACE FUNCTION public.touch_brain_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_personal_tasks_updated ON personal_tasks;
CREATE TRIGGER trg_personal_tasks_updated
  BEFORE UPDATE ON personal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_brain_updated_at();

DROP TRIGGER IF EXISTS trg_personal_notes_updated ON personal_notes;
CREATE TRIGGER trg_personal_notes_updated
  BEFORE UPDATE ON personal_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_brain_updated_at();

DROP TRIGGER IF EXISTS trg_user_brain_state_updated ON user_brain_state;
CREATE TRIGGER trg_user_brain_state_updated
  BEFORE UPDATE ON user_brain_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_brain_updated_at();

ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_brain_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_tasks_owner_all" ON personal_tasks;
CREATE POLICY "personal_tasks_owner_all" ON personal_tasks
  FOR ALL
  USING (
    user_id = public.current_app_user_id()
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  )
  WITH CHECK (
    user_id = public.current_app_user_id()
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  );

DROP POLICY IF EXISTS "personal_notes_owner_all" ON personal_notes;
CREATE POLICY "personal_notes_owner_all" ON personal_notes
  FOR ALL
  USING (
    user_id = public.current_app_user_id()
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  )
  WITH CHECK (
    user_id = public.current_app_user_id()
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  );

DROP POLICY IF EXISTS "user_brain_state_owner_all" ON user_brain_state;
CREATE POLICY "user_brain_state_owner_all" ON user_brain_state
  FOR ALL
  USING (
    user_id = public.current_app_user_id()
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  )
  WITH CHECK (
    user_id = public.current_app_user_id()
    OR lower(owner_email) = lower(COALESCE(auth.jwt()->>'email', ''))
  );

NOTIFY pgrst, 'reload schema';
