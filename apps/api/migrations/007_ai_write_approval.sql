-- AI-owned approval workflow only. No existing business table is modified.
ALTER TABLE ai_task_record DROP CONSTRAINT ai_task_record_status_check;
ALTER TABLE ai_task_record ALTER COLUMN status TYPE varchar(20);
ALTER TABLE ai_task_record ADD CONSTRAINT ai_task_record_status_check
 CHECK(status IN ('queued','pending_approval','running','completed','failed','cancelled'));
ALTER TABLE ai_task_record ADD COLUMN operation_type varchar(20)
 CHECK(operation_type IS NULL OR operation_type IN ('create','update','delete','batch-delete'));
ALTER TABLE ai_task_record ADD COLUMN approval_status varchar(16)
 CHECK(approval_status IS NULL OR approval_status IN ('pending','approved','rejected','expired','executed','failed'));
ALTER TABLE ai_task_record ADD COLUMN rollback_snapshots jsonb NOT NULL DEFAULT '{}'
 CHECK(jsonb_typeof(rollback_snapshots)='object');
CREATE INDEX ai_task_approval_filter_idx ON ai_task_record(tenant_id,user_id,approval_status,operation_type,created_at DESC);

CREATE TABLE ai_write_approval (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 task_id uuid NOT NULL UNIQUE,
 tool_name varchar(100) NOT NULL CHECK(length(btrim(tool_name))>0),
 operation_type varchar(20) NOT NULL CHECK(operation_type IN ('create','update','delete','batch-delete')),
 risk_level varchar(12) NOT NULL CHECK(risk_level IN ('low','medium','high')),
 status varchar(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired','executed','failed')),
 preview jsonb NOT NULL CHECK(jsonb_typeof(preview)='object'),
 encrypted_parameters jsonb NOT NULL CHECK(jsonb_typeof(encrypted_parameters)='object'),
 rejection_reason varchar(500),
 expires_at timestamptz NOT NULL,
 decided_at timestamptz,
 executed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(task_id,tenant_id,user_id) REFERENCES ai_task_record(id,tenant_id,user_id) ON DELETE CASCADE
);
CREATE INDEX ai_write_approval_scope_idx ON ai_write_approval(tenant_id,user_id,status,created_at DESC,id DESC);
CREATE INDEX ai_write_approval_expiry_idx ON ai_write_approval(expires_at) WHERE status='pending';
