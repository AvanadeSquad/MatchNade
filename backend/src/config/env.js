import { randomBytes } from 'node:crypto';
import 'dotenv/config';
import { NIVEIS } from '../utils/log.js';

const lista = (valor) =>
  (valor || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const inteiro = (valor, padrao) => {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? numero : padrao;
};

// Locatário fixo dos tokens de contas pessoais da Microsoft (documentado pela Microsoft).
const LOCATARIO_CONTAS_PESSOAIS = '9188040d-6c67-4c5c-b112-36a304b66dad';

const booleano = (valor) => String(valor).toLowerCase() === 'true';

// Número entre 0 e 1; valor ausente, inválido ou fora da faixa volta ao padrão.
const fracao = (valor, padrao) => {
  const numero = Number.parseFloat(valor);
  return Number.isFinite(numero) && numero >= 0 && numero <= 1 ? numero : padrao;
};

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
    // Nos testes o padrão é silencioso, para os logs não poluírem a saída do vitest.
    logLevel: NIVEIS.includes(origem.LOG_LEVEL) ? origem.LOG_LEVEL : origem.NODE_ENV === 'test' ? 'silent' : 'info',
    jwtExpiresIn: origem.JWT_EXPIRES_IN || '8h',
    frontendUrl: origem.FRONTEND_URL || 'http://localhost:5173',
    // O e-mail de um token da Microsoft não é prova de posse em aplicativos multitenant: só entram
    // tokens de locatários (tenants) listados em tenantIds.
    // Com MICROSOFT_ALLOW_PERSONAL, contas pessoais (Outlook, Hotmail, Live) também entram: elas emitem tokens do
    // locatário fixo "consumers". Os demais locatários continuam valendo só se estiverem em MICROSOFT_ALLOWED_TENANTS.
    microsoft: {
      clientId: origem.MICROSOFT_CLIENT_ID || '',
      permitirPessoais: booleano(origem.MICROSOFT_ALLOW_PERSONAL),
      tenantIds: [
        ...lista(origem.MICROSOFT_ALLOWED_TENANTS),
        ...(booleano(origem.MICROSOFT_ALLOW_PERSONAL) ? [LOCATARIO_CONTAS_PESSOAIS] : []),
      ],
    },
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
    // Score semântico de tags (S4-14): desligado até medir o gabarito de pares com um provedor real.
    semantica: {
      ativa: booleano(origem.SEMANTIC_AFFINITY_ENABLED),
      limiar: fracao(origem.SEMANTIC_THRESHOLD, 0.75),
      peso: fracao(origem.SEMANTIC_WEIGHT, 0.5),
      modelo: origem.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
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
    if (!config.emailsPermitidos.length && !config.dominiosPermitidos.length) {
      throw new Error('Defina ALLOWED_EMAILS ou ALLOWED_EMAIL_DOMAINS em produção');
    }
  }

  return config;
}
