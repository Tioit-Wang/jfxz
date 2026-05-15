-- 重命名 ai.editor_check 配置项的 config_key（幂等，可重复执行）
UPDATE IGNORE global_configs SET config_key = 'character_model_id'  WHERE config_group = 'ai.editor_check' AND config_key = 'round_1_model_id';
UPDATE IGNORE global_configs SET config_key = 'character_thinking'  WHERE config_group = 'ai.editor_check' AND config_key = 'round_1_thinking';
UPDATE IGNORE global_configs SET config_key = 'character_enabled'   WHERE config_group = 'ai.editor_check' AND config_key = 'round_1_enabled';
UPDATE IGNORE global_configs SET config_key = 'character_prompt'    WHERE config_group = 'ai.editor_check' AND config_key = 'round_1_prompt';
UPDATE IGNORE global_configs SET config_key = 'logic_model_id'      WHERE config_group = 'ai.editor_check' AND config_key = 'round_2_model_id';
UPDATE IGNORE global_configs SET config_key = 'logic_thinking'      WHERE config_group = 'ai.editor_check' AND config_key = 'round_2_thinking';
UPDATE IGNORE global_configs SET config_key = 'logic_enabled'       WHERE config_group = 'ai.editor_check' AND config_key = 'round_2_enabled';
UPDATE IGNORE global_configs SET config_key = 'logic_chapter_count' WHERE config_group = 'ai.editor_check' AND config_key = 'round_2_chapter_count';
UPDATE IGNORE global_configs SET config_key = 'logic_prompt'        WHERE config_group = 'ai.editor_check' AND config_key = 'round_2_prompt';
UPDATE IGNORE global_configs SET config_key = 'style_model_id'      WHERE config_group = 'ai.editor_check' AND config_key = 'round_3_model_id';
UPDATE IGNORE global_configs SET config_key = 'style_thinking'      WHERE config_group = 'ai.editor_check' AND config_key = 'round_3_thinking';
UPDATE IGNORE global_configs SET config_key = 'style_enabled'       WHERE config_group = 'ai.editor_check' AND config_key = 'round_3_enabled';
UPDATE IGNORE global_configs SET config_key = 'style_chapter_count' WHERE config_group = 'ai.editor_check' AND config_key = 'round_3_chapter_count';
UPDATE IGNORE global_configs SET config_key = 'style_prompt'        WHERE config_group = 'ai.editor_check' AND config_key = 'round_3_prompt';

-- 清理 seed_defaults 不会再创建但可能残留的旧 key
DELETE FROM global_configs WHERE config_group = 'ai.editor_check' AND config_key = 'model_id';
