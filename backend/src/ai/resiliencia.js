import { ErroIa } from './provedores.js';

// Abre depois de `limite` falhas dentro de `janelaMs`. Volta a fechar sozinho quando
// as falhas saem da janela; um sucesso zera o histórico.
export class Disjuntor {
  constructor({ limite = 3, janelaMs = 60000, agora = () => Date.now() } = {}) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.falhas = [];
  }

  #limpar() {
    const corte = this.agora() - this.janelaMs;
    this.falhas = this.falhas.filter((instante) => instante > corte);
  }

  aberto() {
    this.#limpar();
    return this.falhas.length >= this.limite;
  }

  registrarFalha() {
    this.#limpar();
    this.falhas.push(this.agora());
  }

  registrarSucesso() {
    this.falhas = [];
  }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Tenta cada provedor em ordem respeitando o prazo total (slaMs). Cada chamada tem
// timeout próprio e, em erro repetível, uma nova tentativa após retryDelayMs.
// Devolve { texto, provedor, modelo, latenciaMs } ou lança ErroIa.
export async function executarComResiliencia({ provedores, disjuntores, requisicao, config }) {
  const inicio = Date.now();
  const restante = () => config.slaMs - (Date.now() - inicio);

  for (const provedor of provedores) {
    const disjuntor = disjuntores.get(provedor.nome);
    if (disjuntor?.aberto()) continue;

    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const prazo = Math.min(config.timeoutMs, restante());
      if (prazo <= 0) throw new ErroIa('prazo total esgotado', { repetivel: false });

      try {
        const texto = await provedor.gerar(requisicao, AbortSignal.timeout(prazo));
        disjuntor?.registrarSucesso();
        return { texto, provedor: provedor.nome, modelo: provedor.modelo, latenciaMs: Date.now() - inicio };
      } catch (erro) {
        const repetivel = erro instanceof ErroIa ? erro.repetivel : false;
        if (repetivel && tentativa === 0 && restante() > config.retryDelayMs) {
          await esperar(config.retryDelayMs);
          continue;
        }
        disjuntor?.registrarFalha();
        break;
      }
    }
  }
  throw new ErroIa('nenhum provedor de IA respondeu', { repetivel: false });
}
