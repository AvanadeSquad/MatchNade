import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarBanco } from '../src/db/index.js';
import { popularBanco } from '../src/db/populacao.js';
import { coletarIndicadores, formatarMarkdown, percentil } from '../src/relatorios/indicadores.js';

describe('percentil', () => {
  it('devolve null para lista vazia e o valor correto para os demais casos', () => {
    expect(percentil([], 0.5)).toBeNull();
    expect(percentil([1, 2, 3, 4], 0.5)).toBe(2);
    expect(percentil([1, 2, 3, 4], 0.9)).toBe(4);
    expect(percentil([7], 0.95)).toBe(7);
  });
});

describe('coletarIndicadores', () => {
  let banco;
  beforeAll(async () => {
    banco = await criarBanco();
  });
  afterAll(() => banco.close());
  beforeEach(() => banco.exec('TRUNCATE employee, interest_tag RESTART IDENTITY CASCADE'));

  it('funciona num banco vazio, sem dividir por zero', async () => {
    const r = await coletarIndicadores(banco, { amostra: 10 });
    expect(r.base.pessoas).toBe(0);
    expect(r.conexoes.total).toBe(0);
    expect(r.conexoes.taxa_de_aceite_entre_respondidos).toBe(0);
    expect(r.ia.chamadas).toBe(0);
    expect(formatarMarkdown(r)).toContain('Nenhuma chamada registrada');
  });

  it('bate com o que foi inserido numa população conhecida', async () => {
    const resumo = await popularBanco(banco, { total: 200, semente: 3 });
    const r = await coletarIndicadores(banco, { amostra: 20 });
    expect(r.base.pessoas).toBe(200);
    expect(r.base.completude.com_bio).toBe(100);
    expect(r.base.origem_dos_interesses.ia).toBe(0);
    expect(r.banco.linhas.employee_interest).toBe(resumo.interesses);
    const { aceitas, pendentes, recusadas, expiradas } = r.conexoes.por_status;
    expect(aceitas + pendentes + recusadas + expiradas).toBe(resumo.conexoes);
    expect(r.conexoes.mensagens.total).toBe(resumo.mensagens);
    expect(r.moderacao.bloqueios).toBe(resumo.bloqueios);
    expect(r.afinidade.pessoas_na_amostra).toBeLessThanOrEqual(20);
    expect(r.afinidade.pares_sem_nenhum_interesse_em_comum).toBeGreaterThanOrEqual(0);
    expect(r.afinidade.pares_sem_nenhum_interesse_em_comum).toBeLessThanOrEqual(100);
  });

  it('inclui as chamadas de IA que existem no log e nada além disso', async () => {
    await banco.query(
      `INSERT INTO ai_interaction_log (prompt_type, prompt_version, model, status, latency_ms) VALUES
        ('EXTRACAO', 'v3', 'modelo-x', 'SUCCESS', 900), ('EXTRACAO', 'v3', 'modelo-x', 'SUCCESS', 1100), ('EXTRACAO', 'v3', 'modelo-x', 'TIMEOUT', 2500)`,
    );
    const r = await coletarIndicadores(banco, { amostra: 5 });
    expect(r.ia.chamadas).toBe(3);
    expect(r.ia.taxa_de_sucesso).toBe(66.7);
    expect(r.ia.grupos).toHaveLength(2);
    const md = formatarMarkdown(r);
    expect(md).toContain('| EXTRACAO | v3 | modelo-x | SUCCESS | 2 |');
  });

  it('o relatório não traz nome nem e-mail de ninguém', async () => {
    await popularBanco(banco, { total: 60, semente: 4 });
    const md = formatarMarkdown(await coletarIndicadores(banco, { amostra: 10 }));
    expect(md).not.toMatch(/@exemplo\.test/);
    const [{ nome }] = await banco.query('SELECT name AS nome FROM employee ORDER BY id LIMIT 1');
    expect(md).not.toContain(nome);
  });
});
