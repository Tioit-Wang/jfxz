-- Version: 20260518000000
-- Title: writing_prompts
-- Author: proma-agent
-- Created At: 2026-05-18 10:00:00 +08:00
-- Target: mysql8
-- Type: ddl
-- Risk: low
-- Reversible: yes
-- Summary:
-- 1. Create writing_prompt_category table for flat category management.
-- 2. Create writing_prompt table for writing prompt entries with detail content.
-- 3. One-level category structure, cascade delete on category removal.
--
-- Pre-Checks:
-- SELECT COUNT(*) FROM information_schema.tables
--   WHERE table_schema = DATABASE() AND table_name = 'writing_prompt_category';
-- Expected: 0

CREATE TABLE writing_prompt_category (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE writing_prompt (
    id VARCHAR(36) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    detail_prompt TEXT NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_writing_prompt_category_id__writing_prompt_category
        FOREIGN KEY (category_id) REFERENCES writing_prompt_category (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE writing_prompt ADD INDEX ix_writing_prompt_category_id (category_id);

-- Post-Checks:
-- SELECT COUNT(*) FROM information_schema.tables
--   WHERE table_schema = DATABASE() AND table_name IN ('writing_prompt_category', 'writing_prompt');
-- Expected: 2
