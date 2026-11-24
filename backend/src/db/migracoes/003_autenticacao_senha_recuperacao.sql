-- Credenciais locais e recuperação de senha por pergunta de segurança.
ALTER TABLE employee ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS security_question_id TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;
