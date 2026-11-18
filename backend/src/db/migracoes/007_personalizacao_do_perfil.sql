-- Personalização do perfil: pronomes, visibilidade por unidade, avatar pronto e horários preferidos de Coffee Chat.
-- `visibility = 'UNIT'` faz a pessoa aparecer só para quem é da mesma unidade; o padrão `ALL` não muda nada.
-- `avatar_id` é um código de uma lista fixa validada na API; nulo mantém as iniciais.
ALTER TABLE employee ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'ALL' CHECK (visibility IN ('ALL', 'UNIT'));
ALTER TABLE employee ADD COLUMN IF NOT EXISTS avatar_id TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS preferred_coffee_slots JSONB NOT NULL DEFAULT '[]';
