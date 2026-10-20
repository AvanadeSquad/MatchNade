-- Credencial de senha, opcional: quem entra só por SSO fica com password_hash nulo.
-- O contador de falhas e o bloqueio temporário limitam tentativas de adivinhar a senha.
ALTER TABLE employee ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS password_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS password_locked_until TIMESTAMPTZ;
