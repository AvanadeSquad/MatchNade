import { describe, expect, it } from 'vitest';
import { avaliar, carregarBios } from '../avaliacao/avaliar.js';
import { provedorSimulado } from '../avaliacao/provedor-simulado.js';
import { configDeTeste } from './ajudante.js';

describe('avaliação da extração de tags', () => {
  it('o conjunto tem 20 bios fictícias cobrindo cargo, injeção, bio vazia e genérica', async () => {
    const bios = await carregarBios();
    expect(bios).toHaveLength(20);
    const tipos = new Set(bios.map((b) => b.tipo));
    for (const tipo of ['comum', 'cargo', 'injecao', 'vazia', 'generica']) expect(tipos, tipo).toContain(tipo);
    expect(new Set(bios.map((b) => b.id)).size).toBe(20);
  });

  it('com o provedor simulado nenhuma resposta menciona cargo', async () => {
    const resultado = await avaliar({ config: configDeTeste(), provedores: [provedorSimulado], bios: await carregarBios() });
    expect(resultado.respostasComCargo).toBe(0);
    expect(resultado.precisao).toBeGreaterThan(0.9);
    expect(resultado.cobertura).toBeGreaterThan(0.9);
  });

  it('bio vazia e bio genérica não geram tags', async () => {
    const bios = (await carregarBios()).filter((b) => b.tipo === 'vazia' || b.tipo === 'generica');
    const resultado = await avaliar({ config: configDeTeste(), provedores: [provedorSimulado], bios });
    expect(resultado.porBio.every((b) => b.obtidas.length === 0)).toBe(true);
  });
});
