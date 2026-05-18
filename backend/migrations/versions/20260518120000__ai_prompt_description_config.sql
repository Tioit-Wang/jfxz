-- Version: 20260518120000
-- Title: ai_prompt_description_config
-- Author: proma-agent
-- Created At: 2026-05-18 17:00:00 +08:00
-- Target: mysql8
-- Type: dml
-- Risk: low
-- Reversible: yes
-- Summary:
-- 1. Insert config entries for ai.prompt_description group.
--    model_id/thinking/prompt are stored as a single JSON string entry.
--
-- Pre-Checks:
-- SELECT COUNT(*) FROM global_configs
--   WHERE config_group = 'ai.prompt_description';
-- Expected: 0

INSERT INTO global_configs (id, config_group, config_key, value_type, string_value, description, is_required, created_at, updated_at)
VALUES (
  UUID(),
  'ai.prompt_description',
  'config',
  'string',
  '{"model_id":"__none","thinking":"medium","prompt":"请根据以下详细提示词，生成一段简洁的摘要描述（不超过200字），用于让AI助理快速识别该提示词的用途。\\n\\n详细提示词：\\n{{detail_prompt}}\\n\\n请只输出摘要描述，不要附加其他内容。"}',
  'AI生成描述的模型配置，JSON格式：model_id（模型ID）/ thinking（none/low/medium/high/xhigh）/ prompt（提示词模板，需包含{{detail_prompt}}占位符）',
  1,
  NOW(),
  NOW()
);

-- Post-Checks:
-- SELECT COUNT(*) FROM global_configs
--   WHERE config_group = 'ai.prompt_description';
-- Expected: 1
-- SELECT JSON_VALID(string_value) FROM global_configs
--   WHERE config_group = 'ai.prompt_description';
-- Expected: 1
