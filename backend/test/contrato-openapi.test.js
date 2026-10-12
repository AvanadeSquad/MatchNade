import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { gerarEspecificacao } from '../src/openapi/especificacao.js';
import { criarAmbiente } from './ajudante.js';

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

// Rotas registradas no roteador montado em /api/v1, no formato "GET /matches/{id}".
function rotasDoExpress(app) {
  const api = app.router.stack.find((camada) => camada.handle?.stack?.some((filha) => filha.route?.path === '/health'));
  const rotas = [];
  const visitar = (pilha) => {
    for (const camada of pilha) {
      if (camada.route) {
        for (const metodo of Object.keys(camada.route.methods)) {
          rotas.push(`${metodo.toUpperCase()} ${camada.route.path.replace(/:(\w+)/g, '{$1}')}`);
        }
      } else if (camada.handle?.stack) {
        visitar(camada.handle.stack);
      }
    }
  };
  visitar(api.handle.stack);
  return rotas.sort();
}

const rotasDaEspecificacao = (especificacao) =>
  Object.entries(especificacao.paths)
    .flatMap(([caminho, operacoes]) =>
      Object.keys(operacoes)
        .filter((m) => METODOS.includes(m))
        .map((m) => `${m.toUpperCase()} ${caminho}`),
    )
    .sort();

describe('contrato OpenAPI', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente({ ambiente: { AUTH_DEV_LOGIN: 'true' }, ia: { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() } });
  });
  afterAll(() => a.fechar());

  it('o openapi.json publicado está igual ao gerado a partir das rotas (rode npm run openapi)', async () => {
    const publicado = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
    expect(publicado).toEqual(gerarEspecificacao());
  });

  it('toda rota do Express está na especificação e toda operação da especificação existe', () => {
    expect(rotasDaEspecificacao(gerarEspecificacao())).toEqual(rotasDoExpress(a.app));
  });

  it('toda operação descreve as respostas e as protegidas declaram 401', () => {
    for (const [caminho, operacoes] of Object.entries(gerarEspecificacao().paths)) {
      for (const [metodo, operacao] of Object.entries(operacoes)) {
        expect(Object.keys(operacao.responses).length, `${metodo} ${caminho}`).toBeGreaterThan(0);
        if (operacao.security.length) expect(operacao.responses, `${metodo} ${caminho}`).toHaveProperty('401');
      }
    }
  });
});

// Valores que violam um schema JSON de propriedade, um por tipo de violação.
function valoresInvalidos(propriedade) {
  const valores = [null, { aninhado: true }];
  if (propriedade.type === 'string') valores.push(12345, 'x'.repeat((propriedade.maxLength ?? 5000) + 1));
  if (propriedade.enum) valores.push('VALOR_INEXISTENTE');
  if (propriedade.type === 'integer' || propriedade.type === 'number') valores.push('não é número', -1, 1.5, 1e308);
  if (propriedade.type === 'boolean') valores.push('true', 1);
  if (propriedade.type === 'array')
    valores.push(
      'não é lista',
      [null],
      Array.from({ length: 100 }, () => 'x'),
    );
  return valores;
}

// Fuzz guiado pela especificação: corpos e ids malformados nunca causam erro 500 e
// sempre recebem um status que a especificação documenta para a operação.
const esperarStatusDocumentado = (resposta, op, contexto) => {
  expect(resposta.status, contexto).not.toBe(500);
  expect(Object.keys(op.responses), `${contexto} devolveu ${resposta.status}`).toContain(String(resposta.status));
};
describe('fuzz guiado pela especificação', () => {
  let a;
  let pessoa;
  let ids;
  beforeAll(async () => {
    a = await criarAmbiente({
      ambiente: { AUTH_DEV_LOGIN: 'true' },
      ia: { extrairTags: vi.fn(async () => ({ technical_tags: [], hobby_tags: [], fallback: true })), gerarQuebraGelo: vi.fn() },
    });
    pessoa = await a.criarPessoa({ nome: 'Fuzz Exemplo', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    const outra = await a.criarPessoa({ nome: 'Fuzz Par', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    // Um match de verdade, para as rotas com {id} chegarem até a validação do corpo.
    await a.como(pessoa.email).post('/matches', { receiver_id: outra.id });
    const { body } = await a.como(outra.email).post('/matches', { receiver_id: pessoa.id });
    ids = { '/matches': body.match_id, '/employees': outra.id };
  });

  const idReal = (caminho) => ids[Object.keys(ids).find((prefixo) => caminho.startsWith(prefixo))];
  afterAll(() => a.fechar());

  const operacoes = Object.entries(gerarEspecificacao().paths).flatMap(([caminho, ops]) =>
    Object.entries(ops).map(([metodo, op]) => ({ caminho, metodo, op })),
  );

  async function enviar(metodo, caminho, corpo) {
    const autorizacao = await a.entrar(pessoa.email);
    let requisicao = a.http[metodo](`/api/v1${caminho}`).set('Authorization', autorizacao);
    if (corpo !== undefined)
      requisicao = typeof corpo === 'string' ? requisicao.set('Content-Type', 'application/json').send(corpo) : requisicao.send(corpo);
    return requisicao;
  }

  it.each(operacoes.filter((o) => o.op.requestBody).map((o) => [`${o.metodo.toUpperCase()} ${o.caminho}`, o]))(
    '%s recusa corpos malformados com status documentado',
    async (_nome, { caminho, metodo, op }) => {
      const destino = caminho.replace('{id}', String(idReal(caminho)));
      const schema = op.requestBody.content['application/json'].schema;
      const corpos = [{}, [], '{"json quebrado', '"texto"', { campo_desconhecido: 1 }];
      for (const [nome, propriedade] of Object.entries(schema.properties ?? {})) {
        for (const valor of valoresInvalidos(propriedade)) corpos.push({ [nome]: valor });
      }
      for (const corpo of corpos) {
        const resposta = await enviar(metodo, destino, corpo);
        esperarStatusDocumentado(resposta, op, `${metodo} ${destino} ${JSON.stringify(corpo).slice(0, 80)}`);
      }
    },
  );

  it.each(operacoes.filter((o) => o.caminho.includes('{id}')).map((o) => [`${o.metodo.toUpperCase()} ${o.caminho}`, o]))(
    '%s recusa ids inválidos com status documentado',
    async (_nome, { caminho, metodo, op }) => {
      for (const valor of ['abc', '0', '-1', '1.5', '99999999999999999999', '%00', "1'; DROP TABLE employee;--"]) {
        const resposta = await enviar(
          metodo,
          caminho.replace('{id}', encodeURIComponent(valor)),
          metodo === 'get' || metodo === 'delete' ? undefined : {},
        );
        esperarStatusDocumentado(resposta, op, `${metodo} ${caminho} id=${valor}`);
      }
    },
  );
});
