-- Version: 20260513120000
-- Title: chapter_versions
-- Author: proma-agent
-- Created At: 2026-05-13 12:00:00 +08:00
-- Target: mysql8
-- Type: ddl
-- Risk: low
-- Reversible: yes
-- Summary:
-- 1. Create chapter_versions table for storing chapter edit history snapshots.
-- 2. Each version records title, content, summary, source (human/ai), and word count.
-- 3. Supports 5-minute merge window for human edits to reduce version count.
--
-- Pre-Checks:
-- SELECT COUNT(*) FROM information_schema.tables
--   WHERE table_schema = DATABASE() AND table_name = 'chapter_versions';
-- Expected: 0

CREATE TABLE chapter_versions (
    id VARCHAR(36) NOT NULL,
    chapter_id VARCHAR(36) NOT NULL,
    version_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    source VARCHAR(20) NOT NULL,
    source_detail VARCHAR(200),
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_chapter_versions_chapter_id_version_number
        UNIQUE (chapter_id, version_number),
    CONSTRAINT fk_chapter_versions_chapter_id__chapters
        FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE chapter_versions ADD INDEX ix_chapter_versions_chapter_id (chapter_id, version_number DESC);

-- Post-Checks:
-- SELECT COUNT(*) FROM information_schema.tables
--   WHERE table_schema = DATABASE() AND table_name = 'chapter_versions';
-- Expected: 1
