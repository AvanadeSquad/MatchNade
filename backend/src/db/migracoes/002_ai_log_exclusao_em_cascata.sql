-- Os registros de IA guardam tags derivadas da bio. Ao excluir a pessoa, eles também são apagados.
ALTER TABLE ai_interaction_log DROP CONSTRAINT IF EXISTS ai_interaction_log_employee_id_fkey;
ALTER TABLE ai_interaction_log
  ADD CONSTRAINT ai_interaction_log_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE CASCADE;
