-- Bloqueio temporário da recuperação de senha por erros seguidos na resposta de segurança,
-- e versão de sessão para invalidar os tokens emitidos antes de uma redefinição de senha.
ALTER TABLE employee ADD COLUMN IF NOT EXISTS recovery_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS recovery_locked_until TIMESTAMPTZ;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
