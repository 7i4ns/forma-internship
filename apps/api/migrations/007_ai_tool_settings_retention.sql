-- A disabled tool must stay disabled when the administrator account is removed.
ALTER TABLE ai_tool_settings ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE ai_tool_settings DROP CONSTRAINT ai_tool_settings_updated_by_fkey;
ALTER TABLE ai_tool_settings ADD CONSTRAINT ai_tool_settings_updated_by_fkey
 FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL;
