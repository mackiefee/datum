-- ============================================================================
-- Planit Data Library — Initial Seed Data
-- ============================================================================

INSERT INTO teams (id, name, group_type, color) VALUES
  ('11111111-1111-1111-1111-111111111101', 'VDC', 'department', '#8e5cf7'),
  ('11111111-1111-1111-1111-111111111102', 'Structural', 'department', '#ff375f'),
  ('11111111-1111-1111-1111-111111111103', 'Interior', 'department', '#ff9f0a'),
  ('11111111-1111-1111-1111-111111111104', 'P&C', 'department', '#0071e3');

INSERT INTO users (id, name, email, role, status, primary_team_id) VALUES
  ('22222222-2222-2222-2222-222222222201', 'Maxim', 'maxim@planit.studio', 'super_admin', 'active', '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222202', 'Iryna P.', 'iryna@planit.studio', 'editor', 'active', '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222203', 'Andrii B.', 'andrii@planit.studio', 'editor', 'active', '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222204', 'Olena K.', 'olena@planit.studio', 'admin', 'active', '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222205', 'Sofiia L.', 'sofiia@planit.studio', 'member', 'active', '11111111-1111-1111-1111-111111111103'),
  ('22222222-2222-2222-2222-222222222206', 'External Partner', 'partner@client.example', 'guest', 'active', NULL);

INSERT INTO categories (id, parent_id, level, name, slug, color, owner_id, default_visibility, require_approval, review_cycle_days, sort_order) VALUES
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
  ('pc-proc', 'pc', 2, 'Processes', 'processes', '#0071e3', '22222222-2222-2222-2222-222222222204', 'Restricted', true, 90, 1);

INSERT INTO catalog_items (id, item_class, type, title, summary, body, target_url, category_id, owner_id, status, visibility, stage, discipline, is_required_reading, last_verified_at, updated_at) VALUES
  (1, 'document', 'doc', 'BIM Execution Plan — template', 'BEP basis for every new project: roles, CDE, exchange schedule.', 'The BEP defines roles, responsibilities, exchange formats and project checkpoints.', '', 'vdc-bim', '22222222-2222-2222-2222-222222222201', 'Approved', 'Internal', 'Concept', 'VDC', false, '2026-10-14', '2026-10-14'),
  (2, 'document', 'doc', 'File and model naming', 'Unified code scheme: project-originator-volume-level-type-number.', 'All files in the CDE are named using the project-originator-volume-level-type-number scheme.', '', 'vdc-name', '22222222-2222-2222-2222-222222222202', 'Approved', 'Public', 'Design', 'VDC', true, '2026-09-30', '2026-09-30'),
  (9, 'resource', 'service', 'pyRevit — corporate extension', 'Custom scripts for sheets, annotations and model checking.', 'Install via internal repo and run weekly updater.', 'https://pyrevitlabs.io', 'vdc-tool', '22222222-2222-2222-2222-222222222201', 'Approved', 'Internal', 'Design', 'VDC', false, '2026-10-19', '2026-10-19'),
  (10, 'resource', 'service', 'Redmine — project tasks', 'Tracker of tasks and deadlines by project.', 'Log all model changes affecting issue.', 'https://www.redmine.org', 'gen-link', '22222222-2222-2222-2222-222222222204', 'Approved', 'Internal', 'Design', 'Architecture', false, '2026-08-30', '2026-08-30'),
  (12, 'document', 'policy', 'CDE access policy', 'Who can see and edit what, and at which level.', 'Access is granted at the department, folder or individual document level.', '', 'gen-pol', '22222222-2222-2222-2222-222222222201', 'Draft', 'Restricted', 'Concept', 'VDC', false, '2026-10-21', '2026-10-21');

SELECT setval(pg_get_serial_sequence('catalog_items', 'id'), (SELECT COALESCE(MAX(id), 1) FROM catalog_items));
