import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { encontrarEquivalente, sugerirTags, trechosDestacados } from '../utils/buscaTags.js';
import { IconeCheck, IconeSomar } from './Icones.jsx';

const VISIVEIS = 10;

// Chips de interesses de uma categoria (TECHNICAL ou HOBBY): catálogo da API mais as tags já escolhidas
// que não estão nele (vindas da IA ou criadas agora). O campo de nova tag sugere tags do catálogo
// enquanto a pessoa digita e, ao adicionar, aproveita a tag que já existe em vez de criar uma duplicata.
// `uso` é opcional: Map do nome em minúsculas para quantas pessoas têm a tag, usado para ordenar sugestões.
export default function SeletorTags({ categoria, catalogo, selecionadas, aoAlternar, aoCriar, tom = 'laranja', uso }) {
  const [todas, setTodas] = useState(false);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);
  const [ativa, setAtiva] = useState(-1);
  const [fechada, setFechada] = useState(false);
  const [parecida, setParecida] = useState(null);
  const raiz = useRef(null);
  const idLista = useId();

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

  const sugestoes = useMemo(() => sugerirTags(catalogo, novo, { uso, selecionadas }), [catalogo, novo, uso, selecionadas]);
  const aberta = !fechada && sugestoes.length > 0;
  const idOpcao = (indice) => `${idLista}-opcao-${indice}`;

  // Clicar fora do campo e da lista fecha as sugestões.
  useEffect(() => {
    if (!aberta) return undefined;
    const aoClicarFora = (evento) => {
      if (!raiz.current?.contains(evento.target)) setFechada(true);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberta]);

  const limparCampo = () => {
    setNovo('');
    setAtiva(-1);
    setParecida(null);
  };

  const escolher = (nome) => {
    if (!selecionadas.has(nome.toLowerCase())) aoAlternar(nome, categoria);
    limparCampo();
  };

  function aoDigitar(evento) {
    setNovo(evento.target.value);
    setAtiva(-1);
    setFechada(false);
    setParecida(null);
  }

  function aoTeclar(evento) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      if (!sugestoes.length) return;
      evento.preventDefault();
      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      setFechada(false);
      setAtiva((atual) => (atual < 0 ? (passo > 0 ? 0 : sugestoes.length - 1) : (atual + passo + sugestoes.length) % sugestoes.length));
    } else if (evento.key === 'Enter' && aberta && ativa >= 0) {
      evento.preventDefault();
      escolher(sugestoes[ativa]);
    } else if (evento.key === 'Escape' && aberta) {
      // Fecha só a lista; sem isso, o Esc também fecharia o diálogo em volta, se houver.
      evento.preventDefault();
      evento.stopPropagation();
      setFechada(true);
      setAtiva(-1);
    }
  }

  async function criarDeFato(nome) {
    setErro('');
    setCriando(true);
    try {
      await aoCriar(nome, categoria);
      limparCampo();
    } catch (e) {
      setErro(e.message);
    } finally {
      setCriando(false);
    }
  }

  async function criar(evento) {
    evento.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    const equivalente = encontrarEquivalente([...catalogo, ...extras], nome);
    if (equivalente?.tipo === 'igual') {
      escolher(equivalente.nome);
      return;
    }
    if (equivalente?.tipo === 'parecida') {
      setFechada(true);
      setParecida(equivalente.nome);
      return;
    }
    await criarDeFato(nome);
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
        <div className="seletor-tags__busca" ref={raiz}>
          <form className="seletor-tags__novo" onSubmit={criar}>
            <input
              className="campo__controle campo__controle--pequeno"
              value={novo}
              onChange={aoDigitar}
              onKeyDown={aoTeclar}
              placeholder={categoria === 'TECHNICAL' ? 'Outra skill (ex.: Terraform)' : 'Outro hobby (ex.: Escalada)'}
              aria-label={categoria === 'TECHNICAL' ? 'Adicionar outra skill' : 'Adicionar outro hobby'}
              maxLength={40}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={aberta}
              aria-controls={idLista}
              aria-activedescendant={aberta && ativa >= 0 ? idOpcao(ativa) : undefined}
              autoComplete="off"
            />
            <button type="submit" className="botao botao--suave botao--pequeno botao--auto" disabled={!novo.trim() || criando}>
              <IconeSomar /> Adicionar
            </button>
          </form>
          <ul id={idLista} role="listbox" aria-label="Sugestões do catálogo" className="seletor-tags__sugestoes" hidden={!aberta}>
            {aberta &&
              sugestoes.map((nome, indice) => (
                <li
                  key={nome}
                  id={idOpcao(indice)}
                  role="option"
                  aria-selected={indice === ativa}
                  // O destaque divide o nome em trechos; o rótulo garante que o leitor de tela leia a tag inteira.
                  aria-label={nome}
                  className={`seletor-tags__sugestao${indice === ativa ? ' seletor-tags__sugestao--ativa' : ''}`}
                  // Mantém o foco no campo: sem isso, o clique tiraria o foco antes de escolher.
                  onMouseDown={(evento) => evento.preventDefault()}
                  onClick={() => escolher(nome)}
                >
                  {trechosDestacados(nome, novo).map((trecho, i) =>
                    trecho.destaque ? <mark key={i}>{trecho.texto}</mark> : <span key={i}>{trecho.texto}</span>,
                  )}
                </li>
              ))}
          </ul>
          {parecida && (
            <div className="seletor-tags__aviso" role="status">
              <p>Já existe: {parecida}. Usar essa?</p>
              <div className="seletor-tags__aviso-acoes">
                <button type="button" className="botao botao--primario botao--pequeno botao--auto" onClick={() => escolher(parecida)}>
                  Usar {parecida}
                </button>
                <button
                  type="button"
                  className="botao botao--contorno botao--pequeno botao--auto"
                  onClick={() => criarDeFato(novo.trim())}
                  disabled={criando}
                >
                  Criar mesmo assim
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {erro && (
        <p className="erro-campo" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
