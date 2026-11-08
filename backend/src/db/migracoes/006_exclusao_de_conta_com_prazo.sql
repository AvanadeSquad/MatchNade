-- Exclusão de conta com prazo de arrependimento. Enquanto `deletion_requested_at` está preenchida a conta
-- fica oculta (is_active = false) e pode ser cancelada; depois do prazo a varredura apaga a pessoa.
ALTER TABLE employee ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS employee_exclusao_pendente ON employee (deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;

-- Denúncias recebidas por quem foi excluído, guardadas só com motivo e data. De propósito não há nenhuma
-- coluna que ligue o registro a uma pessoa (nem id, nem e-mail, nem unidade).
CREATE TABLE IF NOT EXISTS moderation_report_archive (
  id SERIAL PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
