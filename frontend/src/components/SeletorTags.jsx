import { useState } from 'react';
import { IconeCheck, IconeSomar } from './Icones.jsx';

const VISIVEIS = 10;

// Chips de interesses de uma categoria (TECHNICAL ou HOBBY): catálogo da API mais as tags já escolhidas
// que não estão nele (vindas da IA ou criadas agora). Permite criar uma tag nova pela API.
export default function SeletorTags({ categoria, catalogo, selecionadas, aoAlternar, aoCriar, tom = 'laranja' }) {
  const [todas, setTodas] = useState(false);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);

  const escolhidasDaCategoria = [...selecionadas.values()].filter((t) => t.categoria === categoria).map((t) => t.nome);
  const conhecidas = new Set(catalogo.map((n) => n.toLowerCase()));
  const extras = escolhidasDaCategoria.filter((n) => !conhecidas.has(n.toLowerCase()));
  // As escolhidas aparecem primeiro, para nunca ficarem escondidas atrás do "ver mais".
  const ordenadas = [
    ...extras,
    ...catalogo.filter((n) => selecionadas.has(n.toLowerCase())),
    ...catalogo.filter((n) => !selecionadas.has(n.toLowerCase())),
  ];
  const visiveis = todas ? ordenadas : ordenadas.slice(0, Math.max(VISIVEIS, escolhidasDaCategoria.length));

  async function criar(evento) {
    evento.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    setErro('');
    setCriando(true);
    try {
      await aoCriar(nome, categoria);
      setNovo('');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="seletor-tags">
      <div className="chips">
        {visiveis.map((nome) => {
          const ativo = selecionadas.has(nome.toLowerCase());
          return (
            <button
              key={nome}
              type="button"
              className={`chip chip--escolha chip--${tom}${ativo ? ' chip--ativo' : ''}`}
              aria-pressed={ativo}
              onClick={() => aoAlternar(nome, categoria)}
            >
              {nome}
              {ativo && <IconeCheck />}
            </button>
          );
        })}
        {ordenadas.length > visiveis.length && (
          <button type="button" className="chip chip--mais" onClick={() => setTodas(true)}>
            + {ordenadas.length - visiveis.length} opções
          </button>
        )}
      </div>
      {aoCriar && (
        <form className="seletor-tags__novo" onSubmit={criar}>
          <input
            className="campo__controle campo__controle--pequeno"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder={categoria === 'TECHNICAL' ? 'Outra skill (ex.: Terraform)' : 'Outro hobby (ex.: Escalada)'}
            aria-label={categoria === 'TECHNICAL' ? 'Adicionar outra skill' : 'Adicionar outro hobby'}
            maxLength={40}
          />
          <button type="submit" className="botao botao--suave botao--pequeno botao--auto" disabled={!novo.trim() || criando}>
            <IconeSomar /> Adicionar
          </button>
        </form>
      )}
      {erro && (
        <p className="erro-campo" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
