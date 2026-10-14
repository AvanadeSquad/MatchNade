import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calcularIdf } from '../src/services/afinidade.js';
import { carregarBase } from '../src/services/recomendacoes.js';
import { criarAmbiente } from './ajudante.js';

// Implementação de referência com o JOIN plano, uma linha por par pessoa e tag. Serve para
// garantir que a consulta agregada de carregarBase produz exatamente a mesma base.
async function baseDeReferencia(consulta) {
  const linhas = await consulta(
    `SELECT e.id, e.name, e.department, e.location, e.is_paused, t.id AS tag_id, t.name AS tag_name, t.category
       FROM employee e
       LEFT JOIN employee_interest ei ON ei.employee_id = e.id
       LEFT JOIN interest_tag t ON t.id = ei.interest_id
      WHERE e.is_active`,
  );
  const perfis = new Map();
  const nomes = new Map();
  const contagem = new Map();
  for (const linha of linhas) {
    if (!perfis.has(linha.id)) {
      perfis.set(linha.id, {
        id: linha.id,
        nome: linha.name,
        unidade: linha.department,
        cidade: linha.location,
        pausado: linha.is_paused,
        tecnicas: [],
        hobbies: [],
      });
    }
    if (linha.tag_id) {
      const perfil = perfis.get(linha.id);
      (linha.category === 'TECHNICAL' ? perfil.tecnicas : perfil.hobbies).push(linha.tag_id);
      nomes.set(linha.tag_id, { nome: linha.tag_name, categoria: linha.category });
      contagem.set(linha.tag_id, (contagem.get(linha.tag_id) ?? 0) + 1);
    }
  }
  return { perfis, nomes, idf: calcularIdf(perfis.size, contagem) };
}

// Compara sem depender da ordem das tags dentro de cada eixo.
const normalizar = (base) => ({
  perfis: [...base.perfis.values()]
    .map((p) => ({ ...p, tecnicas: [...p.tecnicas].sort((a, b) => a - b), hobbies: [...p.hobbies].sort((a, b) => a - b) }))
    .sort((a, b) => a.id - b.id),
  nomes: [...base.nomes.entries()].sort((a, b) => a[0] - b[0]),
  idf: [...base.idf.entries()].sort((a, b) => a[0] - b[0]),
});

describe('carregarBase', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente();
    await a.criarPessoa({ nome: 'Ana Base', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    await a.criarPessoa({ nome: 'Bruno Base', tecnicas: ['Node.js'], hobbies: ['Xadrez', 'Corrida'], pausado: true });
    await a.criarPessoa({ nome: 'Caio Base' });
    const inativa = await a.criarPessoa({ nome: 'Dora Base', tecnicas: ['React'] });
    await a.banco.query('UPDATE employee SET is_active = FALSE WHERE id = $1', [inativa.id]);
    await a.banco.query(`INSERT INTO interest_tag (name, category) VALUES ('Tag sem ninguém', 'HOBBY')`);
  });
  afterAll(() => a.fechar());

  it('produz a mesma base que o JOIN plano: perfis, pausa, pessoa sem tags, inativa fora e IDF', async () => {
    const atual = await carregarBase(a.banco.query);
    expect(normalizar(atual)).toEqual(normalizar(await baseDeReferencia(a.banco.query)));
    expect(atual.perfis.size).toBe(3);
    expect([...atual.perfis.values()].find((p) => p.nome === 'Caio Base')).toMatchObject({ tecnicas: [], hobbies: [] });
  });
});
