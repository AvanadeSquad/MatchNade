import { carregarVetores, recalcularSimilaridades } from './semantica-carga.js';

// Gera, em segundo plano, o vetor das tags que ainda não têm e refaz a tabela de pares (score semântico, S4-14).
// Quem cria a tag só chama `agendar()` e segue: chamadas feitas durante uma rodada viram uma rodada extra, e a
// tabela só é refeita quando nasceu algum vetor novo. A IA nunca bloqueia: falha do provedor deixa a tag sem vetor
// e ela vale só pelo score exato até a próxima rodada ou até `npm run embeddings`.
export function criarVetorizador({ banco, provedor, limiar }) {
  let rodando = null;
  let pendente = false;

  async function rodada() {
    while (pendente) {
      pendente = false;
      try {
        const { geradas } = await carregarVetores({ banco, provedor });
        if (geradas > 0) await recalcularSimilaridades({ banco, limiar });
      } catch {
        // Sem vetor nem tabela atualizada: vale o score exato.
      }
    }
  }

  return {
    agendar() {
      if (!provedor) return;
      pendente = true;
      if (!rodando) {
        rodando = rodada().finally(() => {
          rodando = null;
        });
      }
    },
    // Para os testes e para o desligamento limpo: espera a rodada em andamento.
    aguardar() {
      return rodando ?? Promise.resolve();
    },
  };
}
