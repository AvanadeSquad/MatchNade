import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();

// Lê um id numérico de req.params; lança ZodError (400) se inválido.
export const lerId = (req, nome = 'id') => idSchema.parse(req.params[nome]);
