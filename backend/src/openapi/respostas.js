import { z } from 'zod';
import { OBJETIVOS } from '../services/perfil.js';

// Schemas das respostas principais. São objetos estritos (additionalProperties: false na
// especificação), então um campo a mais, como o cargo antes do match, quebra o contrato.

const tag = z.strictObject({ id: z.number().int(), name: z.string(), source: z.enum(['AI', 'MANUAL']) });

export const respostaRecomendacoes = z.strictObject({
  recommendations: z.array(
    z.strictObject({
      employee_id: z.number().int(),
      name: z.string(),
      department: z.string().nullable(),
      city: z.string().nullable(),
      affinity_score: z.number(),
      shared_interests: z.array(z.string()),
    }),
  ),
  message: z.string().optional(),
});

const campos = {
  id: z.number().int(),
  name: z.string(),
  department: z.string().nullable(),
  city: z.string().nullable(),
  connection_goals: z.array(z.enum(OBJETIVOS)),
  tags: z.strictObject({ technical: z.array(tag), hobby: z.array(tag) }),
  affinity: z.strictObject({ score: z.number(), technical: z.number(), personal: z.number() }),
  shared_interests: z.array(z.string()),
};
const direcao = z.enum(['SENT', 'RECEIVED']);

// Antes do match não há cargo nem bio; a conexão, se existe, está pendente.
const perfilAntesDoMatch = z
  .strictObject({
    ...campos,
    connection: z.strictObject({ match_id: z.number().int(), status: z.literal('PENDING'), direction: direcao }).nullable(),
  })
  .meta({ title: 'Antes do match' });

// Depois do match entram cargo e bio.
const perfilDepoisDoMatch = z
  .strictObject({
    ...campos,
    connection: z.strictObject({ match_id: z.number().int(), status: z.literal('ACCEPTED'), direction: direcao }),
    position: z.string().nullable(),
    bio: z.string().nullable(),
  })
  .meta({ title: 'Depois do match' });

export const respostaPerfilPublico = z.union([perfilAntesDoMatch, perfilDepoisDoMatch]);
