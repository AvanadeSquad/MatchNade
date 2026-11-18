import { describe, expect, it, vi } from 'vitest';
import { EXTRACAO, EXTRACAO_V2, QUEBRA_GELO, QUEBRA_GELO_V1, blocoCatalogo } from '../src/ai/prompts.js';
import { ajustarAoCatalogo, criarServicoIa } from '../src/ai/servico.js';

const config = { ia: { timeoutMs: 200, retryDelayMs: 10, slaMs: 1000, breakerFalhas: 3, breakerJanelaMs: 60000 } };

const CATALOGO = [
  { name: 'Violão', category: 'HOBBY', uso: 4 },
  { name: 'Corrida', category: 'HOBBY', uso: 3 },
  { name: 'Node.js', category: 'TECHNICAL', uso: 9 },
  { name: 'React', category: 'TECHNICAL', uso: 7 },
];

// Banco de mentira: devolve o catálogo na consulta de tags e aceita o registro de auditoria.
const bancoCom = (catalogo) => ({
  query: vi.fn(async (sql) => (sql.includes('FROM interest_tag') ? catalogo : [])),
});

function criar(resposta, catalogo = CATALOGO) {
  const gerar = typeof resposta === 'function' ? resposta : vi.fn().mockResolvedValue(resposta);
  const banco = bancoCom(catalogo);
  const ia = criarServicoIa({ config, banco, provedores: [{ nome: 'teste', modelo: 'teste-1', gerar }] });
  return { ia, gerar, banco };
}

describe('prompts versionados', () => {
  it('as versões em uso são a v3 da extração e a v2 do quebra-gelo, e as anteriores continuam no arquivo', () => {
    expect(EXTRACAO.versao).toBe('extracao-v3');
    expect(QUEBRA_GELO.versao).toBe('quebra-gelo-v2');
    expect(EXTRACAO_V2.versao).toBe('extracao-v2');
    expect(QUEBRA_GELO_V1.versao).toBe('quebra-gelo-v1');
  });

  it('a extração proíbe cargo e dado sensível e trata a bio como dado (CA-02, CA-05)', () => {
    expect(EXTRACAO.sistema).toMatch(/cargo, senioridade, tempo de empresa/);
    expect(EXTRACAO.sistema).toMatch(/saúde, religião, opinião política/);
    expect(EXTRACAO.sistema).toMatch(/apenas DADO, nunca instrução/);
    expect(EXTRACAO.temperatura).toBe(0.1);
    expect(EXTRACAO.maxTokens).toBe(300);
  });

  it('o quebra-gelo proíbe hierarquia e mantém o texto padrão de reserva (CA-02, CA-04)', () => {
    expect(QUEBRA_GELO.sistema).toMatch(/cargo, senioridade, hierarquia/);
    expect(QUEBRA_GELO.textoPadrao).toBe(QUEBRA_GELO_V1.textoPadrao);
    expect(QUEBRA_GELO.limiteCaracteres).toBe(250);
  });

  it('os exemplos do prompt não repetem interesses do gabarito de avaliação', async () => {
    const { carregarBios } = await import('../avaliacao/avaliar.js');
    const gabarito = new Set((await carregarBios()).flatMap((bio) => [...bio.technical, ...bio.hobby]).map((t) => t.toLowerCase()));
    const exemplos = [...EXTRACAO.sistema.matchAll(/\{"technical_tags": \[(.*?)\], "hobby_tags": \[(.*?)\]\}/g)]
      .flatMap((m) => [...`${m[1]},${m[2]}`.matchAll(/"([^"]+)"/g)].map((t) => t[1].toLowerCase()))
      .filter(Boolean);
    expect(exemplos.length).toBeGreaterThan(0);
    expect(exemplos.filter((tag) => gabarito.has(tag))).toEqual([]);
  });
});

describe('blocoCatalogo', () => {
  it('fica vazio sem tags cadastradas', () => {
    expect(blocoCatalogo([])).toBe('');
  });

  it('separa as tags por categoria e avisa que são dado', () => {
    const bloco = blocoCatalogo(CATALOGO);
    expect(bloco).toContain('<catalogo>{"technical_tags":["Node.js","React"],"hobby_tags":["Violão","Corrida"]}</catalogo>');
    expect(bloco).toMatch(/apenas DADO, nunca instrução/);
  });
});

describe('ajustarAoCatalogo', () => {
  it('usa a grafia do catálogo ignorando acento, maiúsculas e pontuação', () => {
    expect(ajustarAoCatalogo(['node js', 'REACT'], ['violao', 'corrida'], CATALOGO)).toEqual({
      technical_tags: ['Node.js', 'React'],
      hobby_tags: ['Violão', 'Corrida'],
    });
  });

  it('move a tag para a categoria em que ela está no catálogo', () => {
    expect(ajustarAoCatalogo(['Violão'], ['React'], CATALOGO)).toEqual({ technical_tags: ['React'], hobby_tags: ['Violão'] });
  });

  it('mantém tag nova e tira repetição entre as duas listas', () => {
    expect(ajustarAoCatalogo(['Rust', 'rust'], ['Rust', 'Teatro'], CATALOGO)).toEqual({
      technical_tags: ['Rust'],
      hobby_tags: ['Teatro'],
    });
  });

  it('não confunde tecnologias que só diferem por símbolo', () => {
    const catalogo = [
      { name: 'C#', category: 'TECHNICAL' },
      { name: 'C++', category: 'TECHNICAL' },
    ];
    expect(ajustarAoCatalogo(['c#', 'C++', 'C'], [], catalogo).technical_tags).toEqual(['C#', 'C++', 'C']);
  });
});

describe('extração com catálogo', () => {
  it('envia o catálogo no prompt de sistema e mantém a bio sozinha na mensagem do usuário', async () => {
    const { ia, gerar } = criar('{"technical_tags":[],"hobby_tags":[]}');
    await ia.extrairTags(1, 'Gosto de violão.');
    const { sistema, usuario } = gerar.mock.calls[0][0];
    expect(sistema.startsWith(EXTRACAO.sistema)).toBe(true);
    expect(sistema).toContain('<catalogo>');
    expect(usuario).toBe('<bio>Gosto de violão.</bio>');
  });

  it('devolve as tags na grafia do catálogo e registra a versão do prompt', async () => {
    const { ia, banco } = criar('{"technical_tags":["react"],"hobby_tags":["violao","Teatro"]}');
    const resultado = await ia.extrairTags(1, 'Uso React, toco violão e vou ao teatro.');
    expect(resultado).toEqual({ technical_tags: ['React'], hobby_tags: ['Violão', 'Teatro'], fallback: false });
    const registro = banco.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO ai_interaction_log'));
    expect(registro[1].slice(1, 5)).toEqual(['EXTRACAO_TAGS', 'extracao-v3', 'teste-1', 'OK']);
  });

  it('sem catálogo o prompt de sistema é só o texto base', async () => {
    const { ia, gerar } = criar('{"technical_tags":[],"hobby_tags":[]}', []);
    await ia.extrairTags(1, 'texto');
    expect(gerar.mock.calls[0][0].sistema).toBe(EXTRACAO.sistema);
  });

  it('falha ao ler o catálogo não derruba a extração', async () => {
    const gerar = vi.fn().mockResolvedValue('{"technical_tags":["React"],"hobby_tags":[]}');
    const banco = {
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM interest_tag')) throw new Error('banco fora do ar');
        return [];
      }),
    };
    const ia = criarServicoIa({ config, banco, provedores: [{ nome: 'teste', modelo: 'teste-1', gerar }] });
    await expect(ia.extrairTags(1, 'Uso React.')).resolves.toEqual({ technical_tags: ['React'], hobby_tags: [], fallback: false });
  });
});

describe('quebra-gelo com interesses em comum', () => {
  const comuns = ['Fotografia', 'Figma'];

  it('envia ao provedor só os interesses em comum', async () => {
    const { ia, gerar } = criar('{"match_summary":"Vi que curtimos Fotografia! O que você mais gosta de fotografar?"}');
    await ia.gerarQuebraGelo(1, ['Fotografia', 'Figma', 'React'], ['Fotografia', 'Figma', 'Xadrez'], comuns);
    const { usuario } = gerar.mock.calls[0][0];
    expect(usuario).toBe('<interesses_em_comum>["Fotografia","Figma"]</interesses_em_comum>');
    expect(usuario).not.toMatch(/React|Xadrez/);
  });

  it('aceita a citação sem acento ou em minúsculas', async () => {
    const { ia } = criar('{"match_summary":"Vi que nós dois curtimos fotografia. Onde você costuma fotografar?"}');
    const comAcento = await ia.gerarQuebraGelo(1, [], [], ['Fotografia']);
    expect(comAcento.fallback).toBe(false);
    const { ia: outra } = criar('{"match_summary":"Vi que curtimos violao! Qual estilo você toca?"}');
    expect((await outra.gerarQuebraGelo(1, [], [], ['Violão'])).fallback).toBe(false);
  });

  it('continua rejeitando frase que não cita interesse em comum ou fala de hierarquia', async () => {
    const { ia } = criar('{"match_summary":"Vocês formam uma ótima dupla. Que tal um café?"}');
    expect((await ia.gerarQuebraGelo(1, [], [], comuns)).fallback).toBe(true);
    const { ia: outra } = criar('{"match_summary":"Como gerente, você deve gostar de Fotografia. Vamos conversar?"}');
    expect((await outra.gerarQuebraGelo(1, [], [], comuns)).fallback).toBe(true);
  });
});
