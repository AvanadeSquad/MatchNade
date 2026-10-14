import { randomBytes } from 'node:crypto';
import 'dotenv/config';

const lista = (valor) =>
  (valor || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const inteiro = (valor, padrao) => {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? numero : padrao;
};

const booleano = (valor) => String(valor).toLowerCase() === 'true';

// Lê e valida as variáveis de ambiente. Recebe o objeto de origem para permitir
// testes com valores controlados; em execução normal usa process.env.
export function carregarConfig(origem = process.env) {
  const producao = origem.NODE_ENV === 'production';

  const config = {
    producao,
    porta: inteiro(origem.PORT, 3000),
    databaseUrl: origem.DATABASE_URL || '',
    pglite: { dataDir: origem.PGLITE_DATA_DIR || '' },
    // Sem JWT_SECRET, gera um segredo aleatório: nunca existe um valor padrão conhecido que permita forjar tokens.
    jwtSecret: origem.JWT_SECRET || randomBytes(32).toString('hex'),
    trustProxy: inteiro(origem.TRUST_PROXY, producao ? 1 : 0),
    jwtExpiresIn: origem.JWT_EXPIRES_IN || '8h',
    frontendUrl: origem.FRONTEND_URL || 'http://localhost:5173',
    google: { clientId: origem.GOOGLE_CLIENT_ID || '' },
    emailsPermitidos: lista(origem.ALLOWED_EMAILS),
    dominiosPermitidos: lista(origem.ALLOWED_EMAIL_DOMAINS),
    authDevLogin: booleano(origem.AUTH_DEV_LOGIN),
    e2eTestMode: booleano(origem.E2E_TEST_MODE),
    seedNaInicializacao: booleano(origem.SEED_ON_START),
    // Desliga o limite de requisições por IP. Serve só aos testes de ponta a ponta, que fazem muitas chamadas.
    limiteDeRequisicoesDesligado: booleano(origem.RATE_LIMIT_DISABLED),
    ia: {
      geminiKey: origem.GEMINI_API_KEY || '',
      geminiModel: origem.GEMINI_MODEL || 'gemini-flash-lite-latest',
      groqKey: origem.GROQ_API_KEY || '',
      groqModel: origem.GROQ_MODEL || 'llama-3.1-8b-instant',
      timeoutMs: inteiro(origem.AI_TIMEOUT_MS, 2500),
      retryDelayMs: inteiro(origem.AI_RETRY_DELAY_MS, 500),
      slaMs: inteiro(origem.AI_SLA_MS, 8000),
      breakerFalhas: inteiro(origem.AI_BREAKER_FAILURES, 3),
      breakerJanelaMs: inteiro(origem.AI_BREAKER_WINDOW_MS, 60000),
    },
    regras: {
      minTags: 3,
      cotaPadrao: 3,
      cotaMin: 1,
      cotaMax: 5,
      diasExpiracao: 14,
      bonusUnidade: 0.05,
      limitePadrao: 5,
      limiteMaximo: 20,
    },
  };

  if (producao) {
    if (config.authDevLogin || config.e2eTestMode || config.limiteDeRequisicoesDesligado) {
      throw new Error('AUTH_DEV_LOGIN, E2E_TEST_MODE e RATE_LIMIT_DISABLED não podem estar ativos em produção');
    }
    if (!origem.JWT_SECRET || origem.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET precisa ter ao menos 32 caracteres em produção');
    }
    if (!config.databaseUrl) throw new Error('DATABASE_URL é obrigatória em produção');
    if (!config.google.clientId) throw new Error('GOOGLE_CLIENT_ID é obrigatório em produção');
    if (!config.emailsPermitidos.length && !config.dominiosPermitidos.length) {
      throw new Error('Defina ALLOWED_EMAILS ou ALLOWED_EMAIL_DOMAINS em produção');
    }
  }

  return config;
}
