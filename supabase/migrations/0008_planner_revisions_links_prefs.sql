-- ============================================================================
-- Datum Knowledge — 0008 Planner Revisions, Task Links, Remembered Categories & Custom Statuses
-- ============================================================================

ALTER TABLE personal_tasks DROP CONSTRAINT IF EXISTS personal_tasks_status_check;

ALTER TABLE personal_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES personal_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rev_number INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_at DATE,
  ADD COLUMN IF NOT EXISTS links_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_personal_tasks_parent
  ON personal_tasks (parent_task_id);

ALTER TABLE user_brain_state
  ADD COLUMN IF NOT EXISTS planner_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
