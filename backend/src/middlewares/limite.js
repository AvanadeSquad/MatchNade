import { ipKeyGenerator, rateLimit as rateLimitBase } from 'express-rate-limit';

export { ipKeyGenerator };

// Corpo das respostas 429, no mesmo formato { code, message } dos demais erros da API. Sem isso,
// o express-rate-limit responde com texto, que o frontend e o contrato não tratam como erro padrão.
export const LIMITE_EXCEDIDO = { code: 'LIMITE_EXCEDIDO', message: 'Muitas requisições. Tente de novo em alguns minutos.' };

// rateLimit do express-rate-limit com a resposta 429 em JSON.
export const rateLimit = (opcoes) => rateLimitBase({ message: LIMITE_EXCEDIDO, ...opcoes });
