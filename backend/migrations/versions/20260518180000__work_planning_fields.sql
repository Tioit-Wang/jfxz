-- Version: 20260518180000
-- Title: work_planning_fields
-- Author: proma-agent
-- Created At: 2026-05-18 18:00:00 +08:00
-- Target: mysql8
-- Type: ddl
-- Risk: low
-- Reversible: yes
-- Summary:
-- 1. Add estimated_word_count (INT NOT NULL DEFAULT 600000) to works.
-- 2. Add estimated_chapter_word_count (INT NOT NULL DEFAULT 2000) to works.
-- 3. Add target_audience (VARCHAR(100) NOT NULL DEFAULT '') to works.
-- 4. Add writing_style (VARCHAR(500) NOT NULL DEFAULT '') to works.
-- These fields support work planning — word count estimation, target audience,
-- and writing style selection.
--
-- Pre-Checks:
-- SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema = DATABASE() AND table_name = 'works' AND column_name = 'estimated_word_count';
-- Expected: 0

ALTER TABLE works
  ADD COLUMN estimated_word_count INT NOT NULL DEFAULT 600000,
  ADD COLUMN estimated_chapter_word_count INT NOT NULL DEFAULT 2000,
  ADD COLUMN target_audience VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN writing_style VARCHAR(500) NOT NULL DEFAULT '';

-- Post-Checks:
-- SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema = DATABASE() AND table_name = 'works' AND column_name = 'estimated_word_count';
-- Expected: 1
