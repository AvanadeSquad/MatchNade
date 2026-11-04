-- Bloqueio temporário do login por erros seguidos de senha na mesma conta.
ALTER TABLE employee ADD COLUMN IF NOT EXISTS login_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;
