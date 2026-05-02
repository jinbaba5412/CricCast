-- CricCast SaaS — Seed Data
-- Run once on a fresh database after schema.sql

INSERT INTO tenants (id, slug, name, plan, max_matches, max_teams) VALUES
  ('00000000-0000-0000-0000-000000000001', 'default', 'Default Club', 'pro', 20, 20);

-- BUG FIXED: Previously admin@criccast.app was ONLY inserted into the users table.
-- But /saas-admin/login queries the saas_admins table — so SaaS admin panel login
-- ALWAYS returned "Invalid credentials" on a fresh install.
-- Also changed the users-table role from 'saas_admin' → 'admin' to prevent that row
-- from bypassing requireTenantMatch (the removed saas_admin bypass bug).
-- The saas_admins table entry is what actually grants /saas-admin access.
-- Password: 'admin123' — CHANGE IMMEDIATELY after first login.
INSERT INTO users (id, tenant_id, email, password_hash, role, name) VALUES
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'admin@criccast.app',
   '$2a$10$YdKSQ4d.sM0MqQ/hh/N8ZeK3P7m9Nc1JJKKv89.9mXOi75MKIhEJO',
   'admin',
   'Default Admin');

INSERT INTO saas_admins (id, email, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000099',
   'admin@criccast.app',
   '$2a$10$YdKSQ4d.sM0MqQ/hh/N8ZeK3P7m9Nc1JJKKv89.9mXOi75MKIhEJO');

INSERT INTO teams (tenant_id, short_id, name, short_name, logo_type, logo_value) VALUES
  ('00000000-0000-0000-0000-000000000001', 'IH', 'Itfaq heros',     'ITF', 'url',   'criccast_uploads/default/img_672e3365fc3b8452.png'),
  ('00000000-0000-0000-0000-000000000001', 'KT', 'Kaptan tigers',    'KT',  'emoji', '🏏'),
  ('00000000-0000-0000-0000-000000000001', 'KW', 'King worriors',    'KW',  'emoji', '🏏'),
  ('00000000-0000-0000-0000-000000000001', 'LR', 'Lefty royals',     'LR',  'emoji', '🏏'),
  ('00000000-0000-0000-0000-000000000001', 'RF', 'Rising Falcons',   'RF',  'emoji', '🏏'),
  ('00000000-0000-0000-0000-000000000001', 'SF', 'Shaheen fighters', 'SF',  'emoji', '🏏'),
  ('00000000-0000-0000-0000-000000000001', 'ST', 'Sultan tigers',    'ST',  'emoji', '🏏');

SET @ih = (SELECT id FROM teams WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND short_id='IH');
SET @kt = (SELECT id FROM teams WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND short_id='KT');
SET @st = (SELECT id FROM teams WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND short_id='ST');

INSERT INTO players (tenant_id, team_id, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', @ih, 'Yasir Ali',      'C'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Adnan Addu',     'VC'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Abid Ali Bagh',  'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Atif Ali',       'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Kamran Ali',     'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Mani Mayo',      'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Mazhar Khan',    'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Mumtaz Khan',    'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Sharafat Ali',   'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Suleman Mani',   'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Tayyab Ishaq',   'BAT'),
  ('00000000-0000-0000-0000-000000000001', @ih, 'Tayyab Khan',    'BAT');

INSERT INTO players (tenant_id, team_id, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', @kt, 'Faheem Khan',    'C'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Hussnain Munir', 'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Malik Kashif',   'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Mehar Azam',     'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Mubasshar Bagh', 'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Mudassar Ali',   'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Mujahid Bagh',   'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Nomi Mayo',      'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Saif Ali',       'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Saleem Bagh',    'BAT'),
  ('00000000-0000-0000-0000-000000000001', @kt, 'Shahzaib Shabi', 'VC');

INSERT INTO players (tenant_id, team_id, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', @st, 'Maqsood Zaki',   'C'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Irfan Khan',     'VC'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Abdul Qadeer',   'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Abid Ali',       'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Ahsan Zafar',    'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Ali Raza',       'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Babar Akbar',    'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Hafiz Sarfraz',  'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Hasnain Ali',    'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Mian Abid',      'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Rashid Lahori',  'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Sajid Yoyo',     'BAT'),
  ('00000000-0000-0000-0000-000000000001', @st, 'Zeeshan Mayo',   'BAT');
