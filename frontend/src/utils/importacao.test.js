import { describe, expect, it } from 'vitest';
import { LIMITE_ANALISE, LIMITE_BIO, lerArquivoDeTexto } from './importacao.js';

// O File do jsdom não implementa text(); este objeto tem só o que lerArquivoDeTexto usa.
const arquivoDeTexto = (conteudo) => ({ name: 'resumo.txt', type: 'text/plain', size: conteudo.length, text: async () => conteudo });

describe('limite do texto enviado à análise', () => {
  it('é o mesmo limite que a API aceita para a bio', () => {
    expect(LIMITE_ANALISE).toBe(1000);
    expect(LIMITE_ANALISE).toBe(LIMITE_BIO);
  });

  it('lê um arquivo com exatamente o limite', async () => {
    const texto = await lerArquivoDeTexto(arquivoDeTexto('a'.repeat(LIMITE_ANALISE)));
    expect(texto).toHaveLength(LIMITE_ANALISE);
  });

  it('recusa arquivo acima do limite em vez de cortar em silêncio', async () => {
    await expect(lerArquivoDeTexto(arquivoDeTexto('a'.repeat(LIMITE_ANALISE + 1)))).rejects.toThrow(/1000/);
  });
});
