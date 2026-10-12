CREATE TABLE IF NOT EXISTS employee (
  id SERIAL PRIMARY KEY,
  auth_provider_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  bio TEXT,
  position TEXT,
  department TEXT,
  location TEXT,
  connection_goals JSONB NOT NULL DEFAULT '[]',
  max_weekly_matches INTEGER NOT NULL DEFAULT 3 CHECK (max_weekly_matches BETWEEN 1 AND 5),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_email_ci ON employee (LOWER(email));

CREATE TABLE IF NOT EXISTS interest_tag (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('TECHNICAL', 'HOBBY'))
);
CREATE UNIQUE INDEX IF NOT EXISTS interest_tag_name_ci ON interest_tag (LOWER(name));

CREATE TABLE IF NOT EXISTS employee_interest (
  employee_id INTEGER NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  interest_id INTEGER NOT NULL REFERENCES interest_tag(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('AI', 'MANUAL')),
  confidence_score REAL,
  PRIMARY KEY (employee_id, interest_id)
);

CREATE TABLE IF NOT EXISTS connection_match (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  match_score REAL NOT NULL DEFAULT 0,
  icebreaker TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (requester_id <> receiver_id),
  UNIQUE (requester_id, receiver_id)
);
CREATE INDEX IF NOT EXISTS connection_match_receiver ON connection_match (receiver_id, status);
CREATE INDEX IF NOT EXISTS connection_match_pendente ON connection_match (created_at) WHERE status = 'PENDING';
-- Impede duas conexões ativas para o mesmo par de pessoas, em qualquer direção.
CREATE UNIQUE INDEX IF NOT EXISTS connection_match_par_ativo ON connection_match
  (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id)) WHERE status IN ('PENDING', 'ACCEPTED');

CREATE INDEX IF NOT EXISTS employee_interest_tag ON employee_interest (interest_id);

CREATE TABLE IF NOT EXISTS chat_message (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES connection_match(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_message_match ON chat_message (match_id, id);

CREATE TABLE IF NOT EXISTS employee_block (
  blocker_id INTEGER NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS employee_block_blocked ON employee_block (blocked_id);

CREATE TABLE IF NOT EXISTS employee_report (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  reported_id INTEGER NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_interaction_log (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employee(id) ON DELETE SET NULL,
  prompt_type TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  response_payload JSONB,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
