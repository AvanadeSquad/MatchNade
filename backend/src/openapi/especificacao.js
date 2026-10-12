import { z } from 'zod';
import { corpoGoogle } from '../routes/auth.js';
import { consultaLista, consultaMensagens, corpoInteresse, corpoMensagem, corpoResposta } from '../routes/conexoes.js';
import { corpoEmail } from '../routes/dev.js';
import { corpoBio, corpoInteresses, corpoPausa, corpoPerfil, corpoTag } from '../routes/perfil.js';
import { corpoDenuncia } from '../routes/pessoas.js';

// Monta a especificação OpenAPI da API. Os corpos e parâmetros de consulta vêm dos mesmos
// schemas zod que as rotas usam para validar, então não podem divergir deles. Resumos,
// respostas e códigos de erro são descritos aqui.

// O campo $schema do JSON Schema não faz parte de um schema OpenAPI.
const paraJsonSchema = (schema) => {
  const json = z.toJSONSchema(schema, { io: 'input' });
  delete json.$schema;
  return json;
};

const corpo = (schema) => ({ required: true, content: { 'application/json': { schema: paraJsonSchema(schema) } } });

// Converte um z.object de consulta em parâmetros "in: query".
const consulta = (schema) => {
  const json = paraJsonSchema(schema);
  return Object.entries(json.properties).map(([nome, propriedade]) => ({
    name: nome,
    in: 'query',
    required: (json.required ?? []).includes(nome),
    schema: propriedade,
  }));
};

const id = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } };
const json = (descricao) => ({ description: descricao, content: { 'application/json': { schema: { type: 'object' } } } });
const erro = (descricao) => ({
  description: descricao,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
});
const semCorpo = (descricao) => ({ description: descricao });
const comLogin = [{ jwt: [] }];
const naoAutenticado = erro('NAO_AUTENTICADO: sem token, token inválido ou expirado.');
const invalidos = erro('DADOS_INVALIDOS (com details) ou CORPO_INVALIDO.');

function operacao(tag, resumo, { login = true, parametros = [], requisicao, respostas }) {
  return {
    tags: [tag],
    summary: resumo,
    ...(login ? { security: comLogin } : { security: [] }),
    ...(parametros.length ? { parameters: parametros } : {}),
    ...(requisicao ? { requestBody: requisicao } : {}),
    responses: { ...respostas, ...(login ? { 401: naoAutenticado } : {}) },
  };
}

export function gerarEspecificacao() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Avanade Connect API',
      version: '1.0.0',
      description:
        'API da plataforma interna de conexões entre colaboradores. Erros seguem { code, message }. Cargo e bio só aparecem depois do match.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: { jwt: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Erro: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'object', properties: { campo: { type: 'string' }, problema: { type: 'string' } } } },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: operacao('Saúde', 'Verifica se o serviço está de pé.', { login: false, respostas: { 200: json('{ "status": "ok" }') } }),
      },
      '/auth/google': {
        post: operacao('Sessão', 'Valida o ID token do Google e devolve o JWT.', {
          login: false,
          requisicao: corpo(corpoGoogle),
          respostas: {
            200: json('{ token, employee, is_new }'),
            400: invalidos,
            401: erro('NAO_AUTENTICADO: credencial inválida ou e-mail não verificado.'),
            403: erro('EMAIL_NAO_LIBERADO'),
            409: erro('CONTA_INATIVA'),
            503: erro('GOOGLE_NAO_CONFIGURADO'),
          },
        }),
      },
      '/auth/dev-users': {
        get: operacao('Desenvolvimento', 'Lista pessoas para entrar sem Google. Só existe com AUTH_DEV_LOGIN=true.', {
          login: false,
          respostas: { 200: json('{ users: [{ name, email }] }') },
        }),
      },
      '/auth/dev-login': {
        post: operacao('Desenvolvimento', 'Entra sem Google. Só existe com AUTH_DEV_LOGIN=true.', {
          login: false,
          requisicao: corpo(corpoEmail),
          respostas: { 200: json('{ token, employee }'), 400: invalidos, 403: erro('EMAIL_NAO_LIBERADO') },
        }),
      },
      '/test/login': {
        post: operacao('Desenvolvimento', 'Entra com qualquer e-mail, criando a pessoa. Só existe com E2E_TEST_MODE=true.', {
          login: false,
          requisicao: corpo(corpoEmail),
          respostas: { 200: json('{ token, employee }'), 400: invalidos },
        }),
      },
      '/profile': {
        get: operacao('Perfil', 'Perfil da pessoa logada, com tags, cota e profile_complete.', {
          respostas: { 200: json('Perfil'), 404: erro('NAO_ENCONTRADO') },
        }),
        put: operacao('Perfil', 'Atualiza os dados do perfil. Todos os campos são opcionais.', {
          requisicao: corpo(corpoPerfil),
          respostas: { 200: json('Perfil'), 400: invalidos },
        }),
        delete: operacao('Perfil', 'Exclui a pessoa e todos os dados ligados a ela.', { respostas: { 204: semCorpo('Excluído.') } }),
      },
      '/profile/enrich-bio': {
        post: operacao('Perfil', 'Extrai tags da bio com IA. Até 15 chamadas por hora por pessoa.', {
          requisicao: corpo(corpoBio),
          respostas: {
            200: json('{ technical_tags, hobby_tags, fallback? }'),
            400: erro('BIO_VAZIA, DADOS_INVALIDOS ou CORPO_INVALIDO.'),
            429: semCorpo('Limite de chamadas atingido.'),
          },
        }),
      },
      '/profile/interests': {
        put: operacao('Perfil', 'Substitui os interesses. Exige pelo menos 3.', {
          requisicao: corpo(corpoInteresses),
          respostas: { 200: json('Perfil'), 400: erro('MENOS_DE_3_TAGS, TAG_INVALIDA, DADOS_INVALIDOS ou CORPO_INVALIDO.') },
        }),
      },
      '/profile/pause': {
        patch: operacao('Perfil', 'Pausa ou retoma a exposição na descoberta.', {
          requisicao: corpo(corpoPausa),
          respostas: { 200: json('{ is_paused }'), 400: invalidos },
        }),
      },
      '/tags': {
        get: operacao('Perfil', 'Catálogo de tags, da mais usada para a menos usada.', {
          parametros: [{ name: 'category', in: 'query', required: false, schema: { type: 'string', enum: ['TECHNICAL', 'HOBBY'] } }],
          respostas: { 200: json('{ tags: [{ id, name, category, uso }] }'), 400: invalidos },
        }),
        post: operacao('Perfil', 'Cria uma tag ou devolve a existente. Cargos e termos genéricos são recusados.', {
          requisicao: corpo(corpoTag),
          respostas: { 201: json('{ id, name, category }'), 400: erro('TAG_INVALIDA, DADOS_INVALIDOS ou CORPO_INVALIDO.') },
        }),
      },
      '/matches/recommendations': {
        get: operacao('Conexões', 'Pessoas por afinidade. Nunca inclui cargo.', {
          parametros: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 20 } }],
          respostas: {
            200: json('{ recommendations, message? }'),
            400: invalidos,
            404: erro('NAO_ENCONTRADO'),
            409: erro('PERFIL_INCOMPLETO'),
          },
        }),
      },
      '/matches': {
        get: operacao('Conexões', 'Conexões em três grupos: recebidas, aguardando e confirmadas.', {
          parametros: consulta(consultaLista),
          respostas: { 200: json('{ recebidas, aguardando, confirmadas }'), 400: invalidos },
        }),
        post: operacao('Conexões', 'Demonstra interesse. Vira match se a outra pessoa já tinha demonstrado.', {
          requisicao: corpo(corpoInteresse),
          respostas: {
            201: json('{ status: PENDING | ACCEPTED, match_id, new? }'),
            400: erro('RECEIVER_INVALIDO, DADOS_INVALIDOS ou CORPO_INVALIDO.'),
            403: erro('BLOQUEADO ou COTA_ESGOTADA.'),
            409: erro('JA_EXISTE ou PERFIL_INCOMPLETO.'),
          },
        }),
      },
      '/matches/{id}': {
        patch: operacao('Conexões', 'Aceita ou recusa uma solicitação recebida.', {
          parametros: [id],
          requisicao: corpo(corpoResposta),
          respostas: {
            200: json('{ match_id, status }'),
            400: invalidos,
            403: erro('NAO_E_DESTINATARIO ou BLOQUEADO.'),
            404: erro('NAO_ENCONTRADO: inexistente ou de quem não participa.'),
            409: erro('JA_RESPONDIDA'),
          },
        }),
      },
      '/matches/{id}/icebreaker': {
        get: operacao('Chat', 'Sugestão de abertura gerada por IA. Até 60 chamadas por hora por pessoa.', {
          parametros: [id],
          respostas: {
            200: json('{ match_summary, fallback? }'),
            400: invalidos,
            403: erro('SEM_MATCH'),
            404: erro('NAO_ENCONTRADO'),
            429: semCorpo('Limite de chamadas atingido.'),
          },
        }),
      },
      '/matches/{id}/messages': {
        get: operacao('Chat', 'Mensagens com id maior que after, em ordem.', {
          parametros: [id, ...consulta(consultaMensagens)],
          respostas: { 200: json('{ messages }'), 400: invalidos, 403: erro('SEM_MATCH ou BLOQUEADO.'), 404: erro('NAO_ENCONTRADO') },
        }),
        post: operacao('Chat', 'Envia mensagem de até 1000 caracteres.', {
          parametros: [id],
          requisicao: corpo(corpoMensagem),
          respostas: {
            201: json('{ id, sender_id, body, created_at }'),
            400: erro('MENSAGEM_VAZIA, MENSAGEM_LONGA, DADOS_INVALIDOS ou CORPO_INVALIDO.'),
            403: erro('SEM_MATCH ou BLOQUEADO.'),
            404: erro('NAO_ENCONTRADO'),
          },
        }),
      },
      '/employees/{id}': {
        get: operacao('Pessoas', 'Perfil de outra pessoa. position e bio só depois do match.', {
          parametros: [id],
          respostas: { 200: json('Perfil público'), 400: invalidos, 404: erro('NAO_ENCONTRADO'), 409: erro('PERFIL_INCOMPLETO') },
        }),
      },
      '/employees/{id}/block': {
        post: operacao('Pessoas', 'Bloqueia. Some da descoberta e fecha o chat.', {
          parametros: [id],
          respostas: { 204: semCorpo('Bloqueado.'), 400: erro('ALVO_INVALIDO ou DADOS_INVALIDOS.'), 404: erro('NAO_ENCONTRADO') },
        }),
        delete: operacao('Pessoas', 'Desbloqueia.', { parametros: [id], respostas: { 204: semCorpo('Desbloqueado.'), 400: invalidos } }),
      },
      '/employees/{id}/report': {
        post: operacao('Pessoas', 'Denuncia uma pessoa.', {
          parametros: [id],
          requisicao: corpo(corpoDenuncia),
          respostas: {
            201: semCorpo('Denúncia registrada.'),
            400: erro('MOTIVO_OBRIGATORIO, ALVO_INVALIDO, DADOS_INVALIDOS ou CORPO_INVALIDO.'),
            404: erro('NAO_ENCONTRADO'),
          },
        }),
      },
      '/blocks': {
        get: operacao('Pessoas', 'Pessoas que você bloqueou.', { respostas: { 200: json('{ blocked: [{ id, name }] }') } }),
      },
    },
  };
}
