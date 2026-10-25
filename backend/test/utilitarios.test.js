import { describe, expect, it } from 'vitest';
import { carregarConfig } from '../src/config/env.js';
import { inicioDaSemana } from '../src/services/semana.js';
import { mencionaDadoSensivel, mencionaHierarquia, normalizarTag, unicas } from '../src/utils/tags.js';

describe('normalizarTag', () => {
  it('aceita interesses comuns e normaliza espaços', () => {
    expect(normalizarTag('  Node.js ')).toBe('Node.js');
    expect(normalizarTag('Leitura   de ficção')).toBe('Leitura de ficção');
    expect(normalizarTag('C#')).toBe('C#');
  });

  it('recusa tags curtas, longas ou com caracteres estranhos', () => {
    expect(normalizarTag('a')).toBeNull();
    expect(normalizarTag('x'.repeat(41))).toBeNull();
    expect(normalizarTag('<script>')).toBeNull();
    expect(normalizarTag('')).toBeNull();
  });

  it('recusa cargo e senioridade', () => {
    for (const termo of ['Gerente', 'Sênior', 'Gerente de projetos', 'Diretor', 'Júnior', 'Analista']) {
      expect(normalizarTag(termo), termo).toBeNull();
    }
  });

  it('recusa cargo e senioridade em inglês', () => {
    for (const termo of ['Tech Lead', 'Manager', 'Director', 'Intern', 'Staff Engineer', 'Principal Architect']) {
      expect(normalizarTag(termo), termo).toBeNull();
    }
    expect(mencionaHierarquia('Ela é tech lead e você é intern.')).toBe(true);
  });

  it('recusa termos genéricos e ofensivos', () => {
    expect(normalizarTag('Tecnologia')).toBeNull();
    expect(normalizarTag('Projetos')).toBeNull();
    expect(normalizarTag('merda')).toBeNull();
  });
});

describe('mencionaHierarquia', () => {
  it('detecta cargo e senioridade em frases', () => {
    expect(mencionaHierarquia('Sendo você um analista e ela uma gerente')).toBe(true);
    expect(mencionaHierarquia('Vocês dois curtem Node.js e xadrez.')).toBe(false);
  });
});

describe('mencionaDadoSensivel', () => {
  it('detecta os temas sensíveis da LGPD, com ou sem acento e sem diferenciar maiúscula', () => {
    // prettier-ignore
    const sensiveis = [
      'orientação sexual', 'LGBT', 'LGBTQIA+', 'gay', 'homossexual', 'religião', 'cristão', 'evangélico', 'católico',
      'espírita', 'ateu', 'Bíblia', 'depressão', 'ansiedade', 'câncer', 'HIV', 'diabetes', 'autismo', 'TDAH',
      'deficiência', 'saúde mental', 'origem racial', 'dado genético', 'filiação a sindicato', 'opinião política',
      'partido político', 'opinião política forte', 'IGREJA evangélica', 'Saúde Mental', 'Etnia', 'Raça', 'Gospel',
      'Hinduísmo', 'Terapia', 'Medicamento', 'Cirurgia', 'Gravidez', 'identidade de gênero',
    ];
    for (const texto of sensiveis) {
      expect(mencionaDadoSensivel(texto), texto).toBe(true);
    }
  });

  it('deixa passar termos de setor, de técnica e expressões comuns com palavras parecidas', () => {
    // prettier-ignore
    const legitimos = [
      'Política de segurança', 'Política de privacidade', 'Políticas públicas', 'Partido alto', 'Coração partido',
      'Saúde digital', 'Health tech', 'Acessibilidade', 'Yoga', 'Meditação', 'Futebol', 'Cibersegurança',
      'Engenharia de dados', 'Biometria', 'Eleições', 'React', 'Xadrez', 'Cafés Especiais', 'Archive',
      'Cancerologia de dados', 'Cerveja negra', 'Arte indígena',
    ];
    for (const texto of legitimos) {
      expect(mencionaDadoSensivel(texto), texto).toBe(false);
    }
  });

  it('"Política" e "Saúde" sozinhas são ambíguas e passam', () => {
    expect(mencionaDadoSensivel('Política')).toBe(false);
    expect(mencionaDadoSensivel('Saúde')).toBe(false);
  });

  it('aceita texto vazio ou ausente', () => {
    expect(mencionaDadoSensivel('')).toBe(false);
    expect(mencionaDadoSensivel(undefined)).toBe(false);
  });

  it('não interfere em normalizarTag: o que a pessoa digita não é filtrado', () => {
    expect(normalizarTag('Política de Segurança')).toBe('Política de Segurança');
  });
});

describe('unicas', () => {
  it('remove duplicatas sem diferenciar maiúsculas', () => {
    expect(unicas(['Xadrez', 'xadrez', 'Corrida'])).toEqual(['Xadrez', 'Corrida']);
  });
});

describe('inicioDaSemana', () => {
  it('devolve a segunda-feira 00:00 de Brasília', () => {
    // Quarta-feira 14/10/2026 15:00 UTC -> segunda 12/10/2026 00:00 em Brasília = 03:00 UTC.
    expect(inicioDaSemana(new Date('2026-10-14T15:00:00Z')).toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('domingo à noite ainda pertence à semana que termina', () => {
    expect(inicioDaSemana(new Date('2026-10-18T23:00:00Z')).toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('segunda logo após a meia-noite de Brasília começa a semana nova', () => {
    expect(inicioDaSemana(new Date('2026-10-19T03:30:00Z')).toISOString()).toBe('2026-10-19T03:00:00.000Z');
  });
});

describe('carregarConfig', () => {
  const producao = {
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(40),
    DATABASE_URL: 'postgresql://u:s@host/db',
    GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
    ALLOWED_EMAIL_DOMAINS: 'exemplo.test',
  };

  it('aceita uma configuração de produção completa', () => {
    expect(() => carregarConfig(producao)).not.toThrow();
  });

  it('recusa rotas de teste em produção', () => {
    expect(() => carregarConfig({ ...producao, E2E_TEST_MODE: 'true' })).toThrow(/produção/);
    expect(() => carregarConfig({ ...producao, AUTH_DEV_LOGIN: 'true' })).toThrow(/produção/);
    expect(() => carregarConfig({ ...producao, RATE_LIMIT_DISABLED: 'true' })).toThrow(/produção/);
  });

  it('recusa segredo fraco, falta de banco e de lista de e-mails em produção', () => {
    expect(() => carregarConfig({ ...producao, JWT_SECRET: 'curto' })).toThrow();
    expect(() => carregarConfig({ ...producao, DATABASE_URL: '' })).toThrow();
    expect(() => carregarConfig({ ...producao, ALLOWED_EMAIL_DOMAINS: '' })).toThrow();
  });

  it('usa os padrões das regras de negócio', () => {
    const { regras, ia } = carregarConfig({});
    expect(regras).toMatchObject({ minTags: 3, cotaPadrao: 3, diasExpiracao: 14, bonusUnidade: 0.05 });
    expect(ia).toMatchObject({ timeoutMs: 2500, retryDelayMs: 500, slaMs: 8000, breakerFalhas: 3 });
  });
});
