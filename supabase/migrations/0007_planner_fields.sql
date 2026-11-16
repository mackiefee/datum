-- ============================================================================
-- Datum Knowledge — 0007 Planner Priority & Category Grouping Columns
-- Adds 4-level priority (0=Normal, 1=Low, 2=High, 3=Urgent) and optional
-- task category/group label while keeping is_urgent in sync for queries.
-- ============================================================================

ALTER TABLE personal_tasks
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';

UPDATE personal_tasks
SET priority = 3
WHERE is_urgent = true AND priority = 0;

NOTIFY pgrst, 'reload schema';
