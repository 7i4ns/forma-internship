-- Only AI-owned storage is changed. Legacy business tables remain intact.
ALTER TABLE ai_chat_messages DROP CONSTRAINT ai_chat_messages_type_check;
ALTER TABLE ai_chat_messages ADD CONSTRAINT ai_chat_messages_type_check CHECK(type IN ('text','table','chart','report','confirmation','tool'));
ALTER TABLE ai_chat_messages DROP CONSTRAINT ai_chat_messages_source_check;
ALTER TABLE ai_chat_messages ADD CONSTRAINT ai_chat_messages_source_check CHECK(source IN ('user','model','demo','tool'));
CREATE TABLE ai_tool_settings (
 tenant_id uuid NOT NULL,
 tool_name varchar(100) NOT NULL,
 enabled boolean NOT NULL,
 updated_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,tool_name)
);
