-- Remove legacy Watch flag now that Bookmarks handle saved items uniformly
ALTER TABLE IF EXISTS bookmarks DROP COLUMN IF EXISTS is_watching;
