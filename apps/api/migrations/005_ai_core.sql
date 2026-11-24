-- AI-only migration. Never alter users, companies or relationships.
ALTER TABLE ai_chat_sessions RENAME TO ai_chat_session;
ALTER TABLE ai_chat_session ADD COLUMN tenant_id uuid;
UPDATE ai_chat_session SET tenant_id=user_id;
ALTER TABLE ai_chat_session ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ai_chat_session ADD COLUMN closed_at timestamptz;
ALTER TABLE ai_chat_session ADD COLUMN deleted_at timestamptz;
ALTER TABLE ai_chat_session ADD CONSTRAINT ai_session_scope_unique UNIQUE(id,tenant_id,user_id);
CREATE INDEX ai_session_scope_page_idx ON ai_chat_session(tenant_id,user_id,updated_at DESC,id DESC) WHERE deleted_at IS NULL;
-- Compatibility for the previous week's local scripts; one storage table, no copied history.
CREATE VIEW ai_chat_sessions AS SELECT * FROM ai_chat_session;
CREATE TABLE ai_user_memory (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id uuid, memory_key varchar(100) NOT NULL CHECK(length(btrim(memory_key))>0),
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,user_id,memory_key), UNIQUE(id,tenant_id,user_id),
 FOREIGN KEY(session_id,tenant_id,user_id) REFERENCES ai_chat_session(id,tenant_id,user_id)
);
CREATE INDEX ai_memory_scope_idx ON ai_user_memory(tenant_id,user_id,updated_at DESC,id DESC);
CREATE TABLE ai_task_record (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id uuid, task_type varchar(100) NOT NULL CHECK(length(btrim(task_type))>0),
 status varchar(16) NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
 progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
 input jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(input)='object'),
 output jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(output)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,tenant_id,user_id),
 FOREIGN KEY(session_id,tenant_id,user_id) REFERENCES ai_chat_session(id,tenant_id,user_id)
);
CREATE INDEX ai_task_scope_idx ON ai_task_record(tenant_id,user_id,updated_at DESC,id DESC);
CREATE INDEX ai_task_status_idx ON ai_task_record(tenant_id,user_id,status);
CREATE TABLE ai_operation_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 action varchar(100) NOT NULL CHECK(length(btrim(action))>0),
 result varchar(12) NOT NULL DEFAULT 'success' CHECK(result IN ('success','failure')),
 source varchar(12) NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','system')),
 target_type varchar(100), target_id uuid,
 details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_audit_scope_idx ON ai_operation_audit(tenant_id,user_id,created_at DESC,id DESC);
CREATE INDEX ai_audit_tenant_idx ON ai_operation_audit(tenant_id,created_at DESC,id DESC);
-- System-generated audit events are append-only even through a repository update/delete.
CREATE FUNCTION ai_guard_system_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.source='system' AND EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN
  RAISE EXCEPTION 'system audit is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ai_audit_immutable BEFORE UPDATE OR DELETE ON ai_operation_audit
 FOR EACH ROW EXECUTE FUNCTION ai_guard_system_audit();
