CREATE TABLE IF NOT EXISTS ai_chat_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title varchar(80) NOT NULL DEFAULT '新对话',
 provider varchar(20) NOT NULL CHECK(provider IN ('ollama','deepseek','qwen','gpt','kimi')),
 model varchar(120) NOT NULL,
 state varchar(12) NOT NULL DEFAULT 'idle' CHECK(state IN ('idle','thinking')),
 active_message_id uuid,
 generation_started_at timestamptz,
 is_demo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_chat_sessions_owner_idx ON ai_chat_sessions(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS ai_chat_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
 name varchar(255) NOT NULL, mime varchar(120) NOT NULL,
 size integer NOT NULL CHECK(size>0 AND size<=5242880),
 data bytea NOT NULL, extracted_text text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_chat_files_session_idx ON ai_chat_files(session_id);
CREATE TABLE IF NOT EXISTS ai_chat_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 seq bigserial UNIQUE NOT NULL,
 session_id uuid NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
 role varchar(12) NOT NULL CHECK(role IN ('user','assistant')),
 type varchar(20) NOT NULL CHECK(type IN ('text','table','chart','report','confirmation')),
 content jsonb NOT NULL,
 attachments jsonb NOT NULL DEFAULT '[]',
 status varchar(12) NOT NULL CHECK(status IN ('complete','pending','error')),
 source varchar(12) NOT NULL CHECK(source IN ('user','model','demo')),
 request_id uuid,
 reply_to uuid REFERENCES ai_chat_messages(id) ON DELETE CASCADE,
 error_code varchar(50),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(session_id,request_id), UNIQUE(reply_to)
);
CREATE INDEX IF NOT EXISTS ai_chat_messages_session_idx ON ai_chat_messages(session_id,seq);
