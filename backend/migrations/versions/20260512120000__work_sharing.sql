-- Version: 20260512120000
-- Title: work_sharing
-- Author: proma-agent
-- Created At: 2026-05-12 12:00:00 +08:00
-- Target: mysql8
-- Type: ddl
-- Risk: low
-- Reversible: yes
-- Summary:
-- 1. Add share_enabled (BOOL NOT NULL DEFAULT FALSE) to works.
-- 2. Add share_token (VARCHAR(36) DEFAULT NULL, UNIQUE) to works.
-- This enables public sharing of works via a UUID token.
--
-- Pre-Checks:
-- SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema = DATABASE() AND table_name = 'works' AND column_name = 'share_enabled';
-- Expected: 0

ALTER TABLE works
  ADD COLUMN share_enabled BOOL NOT NULL DEFAULT FALSE,
  ADD COLUMN share_token VARCHAR(36) DEFAULT NULL;

CREATE UNIQUE INDEX uq_works_share_token ON works (share_token);

-- Post-Checks:
-- SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema = DATABASE() AND table_name = 'works' AND column_name = 'share_enabled';
-- Expected: 1
