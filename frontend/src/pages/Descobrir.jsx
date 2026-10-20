import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, Carregando, Erro, Modal, Vazio } from '../components/Basicos.jsx';
import { Segmentado } from '../components/Controles.jsx';
import {
  IconeAjustes,
  IconeAtualizar,
  IconeBusca,
  IconeCha,
  IconeCoracao,
  IconeEscudoCheck,
  IconeEstrela,
  IconeLampada,
  IconeMaleta,
  IconePessoas,
  IconePino,
  IconeRaio,
  IconeSeta,
  IconeVoltar,
  IconeX,
} from '../components/Icones.jsx';
import { useLayout } from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { useCelular } from '../hooks/useCelular.js';
import { usePreferencias } from '../hooks/usePreferencias.js';
import { API } from '../services/api.js';
import { listaEmTexto, primeiroNome } from '../utils/formatar.js';
import { ignorar, lerIgnorados, limparIgnorados } from '../utils/ignorados.js';
import { FILTROS_DE_OBJETIVO, nomeDoObjetivo } from '../utils/objetivos.js';
import { CIDADE_DO_HUB, mesmaCidade } from '../utils/preferencias.js';

const ALCANCES = [
  { id: 'LOCAL', rotulo: 'Local' },
  { id: 'REGIONAL', rotulo: 'Brasil' },
  { id: 'CONTINENTAL', rotulo: 'LATAM' },
];
const BONUS_POLO = 0.05;

// Sinergia exibida: a afinidade da API reponderada pelo equilíbrio escolhido (profissional x pessoal).
// Com 50/50 coincide com a média dos dois eixos que a API usa. Polos habilitados ganham um pequeno bônus.
function sinergia(sugestao, detalhe, peso, cidadesDosPolos) {
  let valor = detalhe ? peso * detalhe.affinity.technical + (1 - peso) * detalhe.affinity.personal : sugestao.affinity_score;
  if (valor > 0 && cidadesDosPolos.some((c) => mesmaCidade(c, sugestao.city))) valor += BONUS_POLO;
  return Math.min(1, valor);
}

// Frase de apresentação montada com os interesses: a bio só é liberada pela API depois do match.
function apresentacao(detalhe) {
  if (!detalhe) return null;
  const tecnicas = detalhe.tags.technical.map((t) => t.name).slice(0, 3);
  const hobbies = detalhe.tags.hobby.map((t) => t.name).slice(0, 2);
  if (!tecnicas.length && !hobbies.length) return null;
  const partes = [];
  if (tecnicas.length) partes.push(`Curte ${listaEmTexto(tecnicas)} no dia a dia`);
  if (hobbies.length) partes.push(`${tecnicas.length ? 'e, fora do trabalho, ' : 'Fora do trabalho curte '}${listaEmTexto(hobbies)}`);
  return `${partes.join(' ')}.`;
}

const ICONES_AFINIDADE = [IconeLampada, IconeEstrela, IconePessoas, IconeCha];

// Cartão compacto do celular: interesses em texto corrido e as ações de pular e de demonstrar interesse.
function CartaoSugestaoCelular({ sugestao, detalhe, valorSinergia, enviando, cotaEsgotada, aoPular, aoConectar }) {
  const tecnicas = detalhe?.tags.technical.map((t) => t.name) ?? [];
  const hobbies = detalhe?.tags.hobby.map((t) => t.name) ?? [];
  return (
    <>
      <article className="cartao sugestao-celular" aria-label={`Sugestão: ${sugestao.name}`}>
        <div className="sugestao-celular__topo">
          <Avatar nome={sugestao.name} tamanho={44} />
          <span>
            <strong>{sugestao.name}</strong>
            <span className="pequeno">{sugestao.department}</span>
          </span>
          <span className="pilula pilula--contorno">{Math.round(valorSinergia * 100)}% compatível</span>
        </div>
        <h2>{sugestao.name}</h2>
        {sugestao.city && (
          <p className="pequeno meta">
            <IconePino /> {sugestao.city}
          </p>
        )}
        {detalhe?.connection_goals.length > 0 && (
          <div className="chips">
            {detalhe.connection_goals.map((g) => (
              <span key={g} className="chip chip--cinza">
                {nomeDoObjetivo(g)}
              </span>
            ))}
          </div>
        )}
        {tecnicas.length > 0 && (
          <div className="sugestao-celular__grupo">
            <p className="rotulo">Interesses profissionais:</p>
            <p>{listaEmTexto(tecnicas)}.</p>
          </div>
        )}
        {hobbies.length > 0 && (
          <div className="sugestao-celular__grupo">
            <p className="rotulo">Interesses pessoais:</p>
            <p>{listaEmTexto(hobbies)}.</p>
          </div>
        )}
        <div className="sugestao-celular__grupo">
          <p className="rotulo">Interesses em comum:</p>
          <p>
            {sugestao.shared_interests.length
              ? `${listaEmTexto(sugestao.shared_interests)}.`
              : 'Nenhum ainda: pode ser um bom começo de conversa.'}
          </p>
        </div>
        <Link to={`/pessoa/${sugestao.employee_id}`} className="link-acao">
          Ver perfil completo
        </Link>
      </article>
      <div className="acoes-redondas">
        <button type="button" className="acao-redonda acao-redonda--nao" aria-label="Pular sugestão" onClick={aoPular} disabled={enviando}>
          <IconeX />
        </button>
        <button
          type="button"
          className="acao-redonda acao-redonda--sim"
          aria-label={`Demonstrar interesse em ${sugestao.name}`}
          onClick={aoConectar}
          disabled={enviando || cotaEsgotada}
        >
          <IconeCoracao />
        </button>
      </div>
    </>
  );
}

function CartaoSugestao({ sugestao, detalhe, valorSinergia, enviando, cotaEsgotada, aoPular, aoConectar, aoCafe }) {
  const nome = primeiroNome(sugestao.name);
  const tecnicasDela = new Set(detalhe?.tags.technical.map((t) => t.name.toLowerCase()) ?? []);
  const frase = apresentacao(detalhe);

  return (
    <article className="cartao sugestao" aria-label={`Sugestão: ${sugestao.name}`}>
      <div className="sugestao__faixa">
        <span>
          <IconeEscudoCheck /> Perfil verificado Avanade • {sugestao.department}
        </span>
        <span className="pilula pilula--verde">
          <IconeRaio /> {Math.round(valorSinergia * 100)}% de sinergia
        </span>
      </div>

      <div className="sugestao__corpo">
        <div className="sugestao__pessoa">
          <Avatar nome={sugestao.name} tamanho={128} quadrado>
            <span className="selo-disponivel">● Disponível</span>
          </Avatar>
          <div className="sugestao__dados">
            <div className="sugestao__nome">
              <h2>{sugestao.name}</h2>
              <span className="pilula pilula--laranja pilula--maiuscula">{sugestao.department}</span>
            </div>
            <p className="sugestao__meta">
              <span>
                <IconeMaleta /> {sugestao.department}
              </span>
              {sugestao.city && (
                <span>
                  <IconePino /> {sugestao.city}
                </span>
              )}
              <span>
                <IconeCoracao /> {sugestao.shared_interests.length} em comum
              </span>
              {detalhe?.connection_goals.length > 0 && (
                <span>
                  <IconeAjustes /> {detalhe.connection_goals.map(nomeDoObjetivo).join(', ')}
                </span>
              )}
            </p>
            {frase && (
              <blockquote className="sugestao__frase">
                “{frase}”<span className="pequeno"> O resumo completo de {nome} aparece depois do match.</span>
              </blockquote>
            )}
          </div>
        </div>

        <section className="sugestao__secao" aria-label="Afinidades em comum">
          <div className="titulo-secao">
            <h3>
              <IconePessoas /> Afinidades em comum com você
            </h3>
            <span className="pequeno">Calculado por afinidade de perfil</span>
          </div>
          {sugestao.shared_interests.length ? (
            <ul className="afinidades">
              {sugestao.shared_interests.slice(0, 4).map((tag, i) => {
                const Icone = ICONES_AFINIDADE[i % ICONES_AFINIDADE.length];
                return (
                  <li key={tag}>
                    <Icone />
                    <span>
                      <strong>{tag}</strong>
                      <span>{tecnicasDela.has(tag.toLowerCase()) ? 'Interesse profissional' : 'Interesse pessoal'}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pequeno">Nenhum interesse em comum ainda, mas pode ser um bom começo de conversa.</p>
          )}
          {detalhe && (
            <div className="eixos">
              <span>
                Profissional <strong>{Math.round(detalhe.affinity.technical * 100)}%</strong>
              </span>
              <span>
                Pessoal <strong>{Math.round(detalhe.affinity.personal * 100)}%</strong>
              </span>
            </div>
          )}
        </section>

        {detalhe?.tags.hobby.length > 0 && (
          <section className="sugestao__secao" aria-label="Interesses pessoais e hobbies">
            <h3>
              <IconeEstrela /> Interesses Pessoais & Hobbies
            </h3>
            <div className="chips">
              {detalhe.tags.hobby.map((t) => (
                <span key={t.id} className="chip chip--cinza">
                  {t.name}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="sugestao__acoes">
          <button type="button" className="botao botao--cinza botao--auto" onClick={aoPular} disabled={enviando}>
            <IconeX /> Pular sugestão
          </button>
          <Link to={`/pessoa/${sugestao.employee_id}`} className="link-acao">
            Ver perfil completo
          </Link>
          <div className="sugestao__principais">
            <button type="button" className="botao botao--suave botao--auto" onClick={aoCafe} disabled={enviando || cotaEsgotada}>
              <IconeCha /> Agendar Coffee Chat
            </button>
            <button type="button" className="botao botao--primario botao--auto" onClick={aoConectar} disabled={enviando || cotaEsgotada}>
              <IconeCoracao /> Conectar com {nome}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Descobrir() {
  const { perfil, atualizarPerfilEmSilencio } = useAuth();
  const { atualizarNotificacoes } = useLayout();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const busca = (params.get('q') ?? '').trim().toLowerCase();
  const [preferencias] = usePreferencias();
  const { dados, erro, carregando, recarregar } = useCarregar(() => API.recomendacoes(20), []);
  const [detalhes, setDetalhes] = useState(() => new Map());
  const [ignorados, setIgnorados] = useState(() => lerIgnorados(perfil.id));
  const [areas, setAreas] = useState(() => new Set());
  const [alcance, setAlcance] = useState(preferencias.alcance);
  const [cidade, setCidade] = useState('');
  const [objetivo, setObjetivo] = useState(null);
  const [indice, setIndice] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const celular = useCelular();
  const [textoBusca, setTextoBusca] = useState(params.get('q') ?? '');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Detalhes de cada sugestão (interesses, objetivos e afinidade por eixo) para o cartão, os filtros e a ordenação.
  useEffect(() => {
    const lista = dados?.recommendations ?? [];
    if (!lista.length) return undefined;
    let ativo = true;
    Promise.allSettled(lista.map((s) => API.pessoa(s.employee_id))).then((resultados) => {
      if (!ativo) return;
      const mapa = new Map();
      resultados.forEach((r, i) => r.status === 'fulfilled' && mapa.set(lista[i].employee_id, r.value));
      setDetalhes(mapa);
    });
    return () => {
      ativo = false;
    };
  }, [dados]);

  const peso = preferencias.pesoProfissional / 100;
  const cidadesDosPolos = useMemo(() => preferencias.polos.map((p) => CIDADE_DO_HUB[p]).filter(Boolean), [preferencias.polos]);
  const todas = useMemo(() => (dados?.recommendations ?? []).filter((s) => !ignorados.has(s.employee_id)), [dados, ignorados]);
  const unidades = useMemo(() => [...new Set(todas.map((s) => s.department).filter(Boolean))].sort(), [todas]);
  const cidades = useMemo(() => [...new Set(todas.map((s) => s.city).filter(Boolean))].sort(), [todas]);

  const fila = useMemo(() => {
    const filtroObjetivo = FILTROS_DE_OBJETIVO.find((f) => f.id === objetivo);
    return todas
      .filter((s) => !areas.size || areas.has(s.department))
      .filter((s) => alcance !== 'LOCAL' || mesmaCidade(s.city, perfil.location))
      .filter((s) => !cidade || s.city === cidade)
      .filter((s) => {
        if (!filtroObjetivo) return true;
        const metas = detalhes.get(s.employee_id)?.connection_goals ?? [];
        return metas.some((m) => filtroObjetivo.objetivos.includes(m));
      })
      .filter((s) => {
        if (!busca) return true;
        const d = detalhes.get(s.employee_id);
        const textos = [
          s.name,
          s.department,
          s.city,
          ...s.shared_interests,
          ...(d ? [...d.tags.technical, ...d.tags.hobby].map((t) => t.name) : []),
        ];
        return textos.some((t) => t?.toLowerCase().includes(busca));
      })
      .map((s) => ({ ...s, sinergia: sinergia(s, detalhes.get(s.employee_id), peso, cidadesDosPolos) }))
      .sort((a, b) => b.sinergia - a.sinergia || a.name.localeCompare(b.name));
  }, [todas, areas, alcance, cidade, objetivo, busca, detalhes, peso, cidadesDosPolos, perfil.location]);

  const posicao = Math.min(indice, Math.max(fila.length - 1, 0));
  const atual = fila[posicao];
  const cotaEsgotada = perfil.quota.used >= perfil.quota.max;
  const filtrosAtivos = areas.size > 0 || alcance !== preferencias.alcance || cidade || objetivo || busca;

  function limparFiltros() {
    setAreas(new Set());
    setAlcance(preferencias.alcance);
    setCidade('');
    setObjetivo(null);
    setIndice(0);
    if (busca) setParams({});
  }

  const alternarArea = (area) => {
    setIndice(0);
    setAreas((atuais) => {
      const copia = new Set(atuais);
      if (copia.has(area)) copia.delete(area);
      else copia.add(area);
      return copia;
    });
  };

  function tirarDaFila(pessoaId) {
    ignorar(perfil.id, pessoaId);
    setIgnorados(lerIgnorados(perfil.id));
  }

  async function demonstrarInteresse(comCafe) {
    const pessoa = atual;
    setEnviando(true);
    let resposta;
    try {
      resposta = await API.demonstrarInteresse(pessoa.employee_id);
    } catch (e) {
      avisar(e.message, 'erro');
      if (e.code === 'COTA_ESGOTADA') await atualizarPerfilEmSilencio();
      setEnviando(false);
      return;
    }
    await atualizarPerfilEmSilencio();
    atualizarNotificacoes();
    setEnviando(false);
    if (resposta.status === 'ACCEPTED') {
      if (comCafe) navegar(`/chat/${resposta.match_id}?cafe=1`);
      else navegar(`/match/${resposta.match_id}`, { state: { pessoaId: pessoa.employee_id } });
      return;
    }
    tirarDaFila(pessoa.employee_id);
    avisar(
      comCafe
        ? `Interesse enviado para ${pessoa.name}. Quando virar match, vocês poderão marcar o café pelo chat.`
        : `Interesse enviado para ${pessoa.name}. Se a outra pessoa também quiser, vira match.`,
    );
  }

  let conteudo;
  if (carregando) conteudo = <Carregando texto="Buscando colegas com afinidade..." />;
  else if (erro) conteudo = <Erro erro={erro} aoTentarDeNovo={recarregar} />;
  else if (!atual) {
    const semNinguem = !todas.length;
    conteudo = (
      <div className="cartao">
        <Vazio
          titulo={semNinguem ? (cotaEsgotada ? 'Você usou a cota da semana' : 'Por enquanto é só') : 'Nenhuma sugestão com esses filtros'}
          texto={
            semNinguem
              ? (dados.message ?? 'Você já viu todas as sugestões. Volte mais tarde.')
              : 'Ajuste ou limpe os filtros para ver mais colegas.'
          }
        >
          {semNinguem ? (
            <button
              type="button"
              className="botao botao--contorno botao--auto"
              onClick={() => {
                limparIgnorados(perfil.id);
                setIgnorados(new Set());
                recarregar();
              }}
            >
              <IconeAtualizar /> Atualizar sugestões
            </button>
          ) : (
            <button type="button" className="botao botao--contorno botao--auto" onClick={limparFiltros}>
              Limpar filtros
            </button>
          )}
        </Vazio>
      </div>
    );
  } else {
    conteudo = (
      <>
        {celular ? (
          <CartaoSugestaoCelular
            key={atual.employee_id}
            sugestao={atual}
            detalhe={detalhes.get(atual.employee_id)}
            valorSinergia={atual.sinergia}
            enviando={enviando}
            cotaEsgotada={cotaEsgotada}
            aoPular={() => tirarDaFila(atual.employee_id)}
            aoConectar={() => demonstrarInteresse(false)}
          />
        ) : (
          <CartaoSugestao
            key={atual.employee_id}
            sugestao={atual}
            detalhe={detalhes.get(atual.employee_id)}
            valorSinergia={atual.sinergia}
            enviando={enviando}
            cotaEsgotada={cotaEsgotada}
            aoPular={() => tirarDaFila(atual.employee_id)}
            aoConectar={() => demonstrarInteresse(false)}
            aoCafe={() => demonstrarInteresse(true)}
          />
        )}
        {cotaEsgotada && (
          <p className="erro-campo centro">
            Você já usou suas {perfil.quota.max} solicitações desta semana. A cota renova na segunda-feira.
          </p>
        )}
        <nav className="paginacao" aria-label="Navegar entre sugestões">
          <button type="button" className="link-acao link-acao--cinza" disabled={posicao === 0} onClick={() => setIndice(posicao - 1)}>
            <IconeVoltar /> Anterior
          </button>
          <span aria-live="polite">
            <strong>{posicao + 1}</strong> de {fila.length} sugestões ativas
          </span>
          <button
            type="button"
            className="link-acao link-acao--cinza"
            disabled={posicao >= fila.length - 1}
            onClick={() => setIndice(posicao + 1)}
          >
            Próximo <IconeSeta />
          </button>
        </nav>
      </>
    );
  }

  const painelFiltros = (
    <section className="cartao bloco filtros">
      <div className="titulo-secao">
        <h2>
          <IconeAjustes /> Filtros Essenciais
        </h2>
        {filtrosAtivos && (
          <button type="button" className="link-acao" onClick={limparFiltros}>
            <IconeAtualizar /> Limpar
          </button>
        )}
      </div>

      {unidades.length > 0 && (
        <div className="filtros__grupo">
          <p className="rotulo">Áreas profissionais</p>
          <div className="chips">
            {unidades.map((u) => (
              <button
                key={u}
                type="button"
                className={`chip chip--escolha chip--laranja${areas.has(u) ? ' chip--ativo' : ''}`}
                aria-pressed={areas.has(u)}
                onClick={() => alternarArea(u)}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filtros__grupo">
        <p className="rotulo">Alcance geográfico</p>
        <Segmentado
          rotulo="Alcance geográfico"
          opcoes={ALCANCES.map((a) =>
            a.id === 'LOCAL' && perfil.location ? { ...a, rotulo: `Local (${perfil.location.split(',')[0]})` } : a,
          )}
          valor={alcance}
          aoMudar={(v) => {
            setAlcance(v);
            setIndice(0);
          }}
        />
      </div>

      <label className="filtros__grupo">
        <span className="rotulo">Polo Avanade</span>
        <select
          className="campo__controle campo__controle--pequeno"
          value={cidade}
          onChange={(e) => {
            setCidade(e.target.value);
            setIndice(0);
          }}
        >
          <option value="">Todos os polos</option>
          {cidades.map((c) => (
            <option key={c} value={c}>
              Avanade {c}
            </option>
          ))}
        </select>
      </label>

      <div className="filtros__grupo">
        <p className="rotulo">Objetivo principal</p>
        <div className="chips">
          {FILTROS_DE_OBJETIVO.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              type="button"
              className={`chip chip--escolha chip--laranja${objetivo === id ? ' chip--ativo' : ''}`}
              aria-pressed={objetivo === id}
              onClick={() => {
                setObjetivo(objetivo === id ? null : id);
                setIndice(0);
              }}
            >
              <Icone /> {rotulo}
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  if (celular) {
    return (
      <main className="pagina pagina--descobrir">
        <form
          className="descobrir__busca"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const termo = textoBusca.trim();
            setIndice(0);
            setParams(termo ? { q: termo } : {});
          }}
        >
          <label className="busca busca--clara">
            <IconeBusca />
            <span className="so-leitor">Buscar colaborador</span>
            <input
              type="search"
              value={textoBusca}
              onChange={(e) => setTextoBusca(e.target.value)}
              placeholder="Buscar colaborador ou unidade..."
            />
          </label>
          <button
            type="button"
            className={`icone-botao icone-botao--contorno${filtrosAtivos ? ' icone-botao--marcado' : ''}`}
            aria-label="Filtros"
            onClick={() => setFiltrosAbertos(true)}
          >
            <IconeAjustes />
          </button>
        </form>
        <div className="descobrir__principal">{conteudo}</div>
        {filtrosAbertos && (
          <Modal titulo="Filtros" aoFechar={() => setFiltrosAbertos(false)}>
            {painelFiltros}
            <button type="button" className="botao botao--primario" onClick={() => setFiltrosAbertos(false)}>
              Ver {fila.length} {fila.length === 1 ? 'sugestão' : 'sugestões'}
            </button>
          </Modal>
        )}
      </main>
    );
  }

  return (
    <main className="pagina">
      <header className="pagina__cabecalho">
        <div>
          <p className="sobretitulo">Matchmaking inteligente • Avanade People</p>
          <h1>Descobrir Colaboradores</h1>
          <p className="subtitulo">Conecte-se com colegas da Avanade com base em afinidades profissionais e pessoais em comum.</p>
        </div>
        {dados && (
          <span className="pilula pilula--branca">
            <span className="ponto ponto--laranja" aria-hidden="true" /> {todas.length} sugestões hoje
          </span>
        )}
      </header>

      {busca && (
        <p className="filtro-busca">
          Resultados para <strong>“{params.get('q')}”</strong>
          <button type="button" className="link-acao" onClick={() => setParams({})}>
            Limpar busca
          </button>
        </p>
      )}

      <div className="descobrir">
        <aside className="descobrir__lateral" aria-label="Filtros">
          {painelFiltros}
          <section className="cartao cartao--suave nota-segura">
            <IconeEscudoCheck />
            <div>
              <strong>Conexões Mútuas & Seguras</strong>
              <p className="pequeno">
                Mensagens e reuniões só são liberadas após o interesse mútuo de ambos os colaboradores. Respeito ao tempo e foco de todos.
              </p>
              <p className="pequeno cota">
                Solicitações desta semana: <strong>{perfil.quota.used}</strong> de {perfil.quota.max}
              </p>
            </div>
          </section>
        </aside>

        <div className="descobrir__principal">{conteudo}</div>
      </div>
    </main>
  );
}
