// A semana da cota vai de segunda a domingo, no horário de Brasília (UTC-3, sem horário de verão).
const DESLOCAMENTO_MS = -3 * 60 * 60 * 1000;

// Início da semana corrente (segunda-feira 00:00 em Brasília) como Date em UTC.
export function inicioDaSemana(agora = new Date()) {
  const local = new Date(agora.getTime() + DESLOCAMENTO_MS);
  const diasDesdeSegunda = (local.getUTCDay() + 6) % 7;
  const segundaLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diasDesdeSegunda);
  return new Date(segundaLocal - DESLOCAMENTO_MS);
}
