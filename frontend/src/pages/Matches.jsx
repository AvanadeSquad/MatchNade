import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Carregando, Erro, Vazio } from '../components/Basicos.jsx';
import {
  IconeAjustes,
  IconeBrilho,
  IconeBusca,
  IconeCalendario,
  IconeCha,
  IconeCoracao,
  IconeMensagem,
  IconeRaio,
  IconeRelogio,
} from '../components/Icones.jsx';
import { useLayout } from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { useCelular } from '../hooks/useCelular.js';
import { API } from '../services/api.js';
import { lerCafes } from '../utils/cafe.js';
import { listaEmTexto, porcentagem, unidadeECidade } from '../utils/formatar.js';

const FILTROS = [
  { id: 'TODOS', rotulo: 'Todos' },
  { id: 'CONFIRMADOS', rotulo: 'Matches confirmados' },
  { id: 'AGUARDANDO', rotulo: 'Aguardando resposta' },
  { id: 'CAFE', rotulo: 'Com café agendado' },
];

const chaveDispensados = (usuarioId) => `matches-dispensados:${usuarioId}`;
function lerDispensados(usuarioId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(chaveDispensados(usuarioId)) ?? '[]'));
  } catch {
    return new Set();
  }
}
function dispensar(usuarioId, conexaoId) {
  const conjunto = lerDispensados(usuarioId);
  conjunto.add(conexaoId);
  try {
    localStorage.setItem(chaveDispensados(usuarioId), JSON.stringify([...conjunto]));
  } catch {
    // Sem armazenamento, a notificação some só até recarregar.
  }
}

// Destaque do match mais recente ainda não visto.
function DestaqueMatch({ eu, conexao, aoDispensar }) {
  const comuns = conexao.shared_interests.slice(0, 3);
  return (
    <section className="destaque-match" aria-label="Nova conexão recíproca">
      <div className="destaque-match__avatares" aria-hidden="true">
        <Avatar nome={eu} tamanho={84} />
        <span className="destaque-match__coracao">
          <IconeCoracao />
        </span>
        <Avatar nome={conexao.name} tamanho={84} />
      </div>
      <div className="destaque-match__texto">
        <p className="sobretitulo">
          <IconeBrilho /> Nova conexão recíproca
        </p>
        <h2>É um Match Bilateral!</h2>
        <p>
          Você e <strong>{conexao.name}</strong> demonstraram interesse mútuo!
          {comuns.length > 0 && (
            <>
              {' '}
              Vocês têm afinidade confirmada em <strong>{listaEmTexto(comuns)}</strong>.
            </>
          )}
        </p>
        {comuns.length > 0 && (
          <div className="chips">
            {comuns.map((c, i) => (
              <span key={c} className={`chip ${i === comuns.length - 1 && comuns.length > 1 ? 'chip--pessego' : 'chip--azul'}`}>
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="destaque-match__acoes">
        <Link to={`/chat/${conexao.match_id}`} className="botao botao--primario">
          <IconeMensagem /> Iniciar conversa no chat
        </Link>
        <Link to={`/chat/${conexao.match_id}?cafe=1`} className="botao botao--suave">
          <IconeCalendario /> Agendar Coffee Chat
        </Link>
        <button type="button" className="link-acao link-acao--cinza" onClick={aoDispensar}>
          Dispensar notificação
        </button>
      </div>
    </section>
  );
}

function LinhaMatch({ conexao, tipo, cafe, aoResponder, ocupado }) {
  const navegar = useNavigate();
  const comuns = conexao.shared_interests.slice(0, 2);
  return (
    <li className="cartao linha-match">
      <Avatar nome={conexao.name} tamanho={56} quadrado>
        <span className={`selo-status selo-status--${tipo === 'confirmada' ? 'ativo' : 'espera'}`} aria-hidden="true" />
      </Avatar>
      <div className="linha-match__info">
        <p className="linha-match__nome">
          <strong>{conexao.name}</strong>
          <span className="pilula pilula--laranja">
            <IconeRaio /> {porcentagem(conexao.affinity_score)} compatível
          </span>
          {conexao.new && <span className="pilula pilula--cinza pilula--maiuscula">Match recente</span>}
          {cafe && (
            <span className="pilula pilula--verde">
              <IconeCha /> Café agendado
            </span>
          )}
          {tipo === 'recebida' && <span className="pilula pilula--azul">Quer se conectar com você</span>}
        </p>
        <p className="pequeno">{unidadeECidade(conexao.department, conexao.city)}</p>
        {tipo === 'aguardando' ? (
          <p className="nota-linha nota-linha--cinza">
            <IconeRelogio /> Aguardando resposta da sua solicitação
          </p>
        ) : cafe ? (
          <p className="nota-linha nota-linha--verde">
            <IconeRelogio /> Café agendado para {cafe}
          </p>
        ) : (
          comuns.length > 0 && (
            <p className="nota-linha">
              <IconeCoracao /> Vocês curtem: <strong>{comuns.join(' • ')}</strong>
            </p>
          )
        )}
      </div>
      <div className="linha-match__acoes">
        <button
          type="button"
          className="botao botao--cinza botao--pequeno botao--auto"
          onClick={() => navegar(`/pessoa/${conexao.employee_id}`)}
        >
          Ver Perfil
        </button>
        {tipo === 'confirmada' &&
          (cafe ? (
            <Link to={`/chat/${conexao.match_id}`} className="botao botao--verde botao--pequeno botao--auto">
              <IconeCalendario /> Ver Detalhes do Encontro
            </Link>
          ) : (
            <Link to={`/chat/${conexao.match_id}`} className="botao botao--primario botao--pequeno botao--auto">
              <IconeMensagem /> Abrir Chat
            </Link>
          ))}
        {tipo === 'aguardando' && (
          <button type="button" className="botao botao--suave botao--pequeno botao--auto" disabled>
            <IconeRelogio /> Aguardando
          </button>
        )}
        {tipo === 'recebida' && (
          <>
            <button
              type="button"
              className="botao botao--perigo botao--pequeno botao--auto"
              disabled={ocupado}
              onClick={() => aoResponder(conexao, 'decline')}
            >
              Recusar
            </button>
            <button
              type="button"
              className="botao botao--primario botao--pequeno botao--auto"
              disabled={ocupado}
              onClick={() => aoResponder(conexao, 'accept')}
            >
              Aceitar
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// Linha compacta da lista no celular.
function LinhaCelular({ conexao, tipo, cafe, aoResponder, ocupado }) {
  const comuns = conexao.shared_interests;
  const conteudo = (
    <>
      <Avatar nome={conexao.name} tamanho={52} quadrado />
      <span className="linha-celular__texto">
        <span className="linha-celular__topo">
          <strong>{conexao.name}</strong>
          {tipo === 'aguardando' && <span className="pequeno">Aguardando</span>}
          {cafe && <span className="pequeno destaque-verde">Café agendado</span>}
        </span>
        <span className="pequeno">
          Unidade: {conexao.department} • <span className="destaque-roxo">{porcentagem(conexao.affinity_score)} compatibilidade</span>
        </span>
        <span className="linha-celular__comum">
          {comuns.length
            ? `${comuns.length} ${comuns.length === 1 ? 'interesse' : 'interesses'} em comum: ${comuns.join(', ')}`
            : 'Sem interesses em comum ainda'}
        </span>
      </span>
      {conexao.new && <span className="ponto ponto--laranja" aria-label="Match novo" />}
    </>
  );

  if (tipo === 'recebida') {
    return (
      <li className="cartao linha-celular linha-celular--recebida">
        <Link to={`/pessoa/${conexao.employee_id}`} className="linha-celular__link">
          {conteudo}
        </Link>
        <div className="linha-celular__acoes">
          <button
            type="button"
            className="botao botao--perigo botao--pequeno"
            disabled={ocupado}
            onClick={() => aoResponder(conexao, 'decline')}
          >
            Recusar
          </button>
          <button
            type="button"
            className="botao botao--sucesso botao--pequeno"
            disabled={ocupado}
            onClick={() => aoResponder(conexao, 'accept')}
          >
            Aceitar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={`cartao linha-celular${conexao.new ? ' linha-celular--nova' : ''}`}>
      <Link to={tipo === 'confirmada' ? `/chat/${conexao.match_id}` : `/pessoa/${conexao.employee_id}`} className="linha-celular__link">
        {conteudo}
      </Link>
    </li>
  );
}

export default function Matches() {
  const { perfil } = useAuth();
  const { atualizarNotificacoes } = useLayout();
  const avisar = useAviso();
  const navegar = useNavigate();
  // Sem `espiar`: abrir esta tela marca os matches como vistos (o selo "novo" ainda vem nesta resposta).
  const { dados, erro, carregando, recarregar } = useCarregar(() => API.conexoes(), []);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('TODOS');
  const [menuFiltro, setMenuFiltro] = useState(false);
  const [dispensados, setDispensados] = useState(() => lerDispensados(perfil.id));
  const [ocupado, setOcupado] = useState(false);
  const cafes = useMemo(() => lerCafes(perfil.id), [perfil.id]);
  const raizFiltro = useRef(null);
  const celular = useCelular();

  useEffect(() => {
    if (dados) atualizarNotificacoes();
  }, [dados, atualizarNotificacoes]);

  useEffect(() => {
    if (!menuFiltro) return undefined;
    const fechar = (e) => !raizFiltro.current?.contains(e.target) && setMenuFiltro(false);
    const teclar = (e) => e.key === 'Escape' && setMenuFiltro(false);
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', teclar);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', teclar);
    };
  }, [menuFiltro]);

  async function responder(conexao, acao) {
    setOcupado(true);
    try {
      const r = await API.responder(conexao.match_id, acao);
      atualizarNotificacoes();
      if (r.status === 'ACCEPTED') navegar(`/match/${r.match_id}`, { state: { pessoaId: conexao.employee_id } });
      else {
        avisar('Solicitação recusada.');
        recarregar();
      }
    } catch (e) {
      avisar(e.message, 'erro');
    } finally {
      setOcupado(false);
    }
  }

  const confirmadas = dados?.confirmadas ?? [];
  const recebidas = dados?.recebidas ?? [];
  const aguardando = dados?.aguardando ?? [];
  const novos = confirmadas.filter((c) => c.new);
  const destaque = novos.find((c) => !dispensados.has(c.match_id));
  const cafesMarcados = confirmadas.filter((c) => cafes[c.match_id]).length;

  const termo = busca.trim().toLowerCase();
  const casaBusca = (c) => !termo || [c.name, c.department, c.city, ...c.shared_interests].some((t) => t?.toLowerCase().includes(termo));
  const linhas = [
    ...(filtro === 'TODOS' || filtro === 'CONFIRMADOS' || filtro === 'CAFE'
      ? confirmadas.filter((c) => filtro !== 'CAFE' || cafes[c.match_id]).map((c) => ({ c, tipo: 'confirmada' }))
      : []),
    ...(filtro === 'TODOS' || filtro === 'AGUARDANDO' ? aguardando.map((c) => ({ c, tipo: 'aguardando' })) : []),
  ].filter(({ c }) => casaBusca(c));

  // Celular: lista compacta "Conexões Bilaterais"; tocar numa linha abre o chat (ou o perfil, se ainda aguarda).
  if (celular) {
    return (
      <main className="pagina">
        <h1>Conexões Bilaterais</h1>
        <label className="busca busca--clara">
          <IconeBusca />
          <span className="so-leitor">Buscar conexões</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, interesses ou unidade..."
          />
        </label>
        {carregando && <Carregando />}
        {erro && <Erro erro={erro} aoTentarDeNovo={recarregar} />}
        {recebidas.filter(casaBusca).length > 0 && (
          <section className="bloco-lista" aria-labelledby="recebidas-celular">
            <h2 id="recebidas-celular" className="rotulo">
              Querem se conectar com você <span className="contador-pilula">{recebidas.length}</span>
            </h2>
            <ul className="lista-matches">
              {recebidas.filter(casaBusca).map((c) => (
                <LinhaCelular key={c.match_id} conexao={c} tipo="recebida" aoResponder={responder} ocupado={ocupado} />
              ))}
            </ul>
          </section>
        )}
        {dados && !confirmadas.length && !aguardando.length && !recebidas.length && (
          <Vazio titulo="Nenhuma conexão ainda" texto="Demonstre interesse em quem tem a ver com você. Quando for recíproco, aparece aqui.">
            <Link to="/descobrir" className="botao botao--primario botao--auto">
              Descobrir colaboradores
            </Link>
          </Vazio>
        )}
        {linhas.length > 0 && (
          <ul className="lista-matches">
            {linhas.map(({ c, tipo }) => (
              <LinhaCelular key={c.match_id} conexao={c} tipo={tipo} cafe={tipo === 'confirmada' ? cafes[c.match_id] : null} />
            ))}
          </ul>
        )}
      </main>
    );
  }

  return (
    <main className="pagina">
      <header className="pagina__cabecalho">
        <div>
          <p className="sobretitulo">
            Sinergia & conexões ativas{' '}
            {novos.length > 0 && (
              <span className="pilula pilula--laranja">
                ● {novos.length} {novos.length === 1 ? 'novo match' : 'novos matches'}
              </span>
            )}
          </p>
          <h1>Matches Bilaterais</h1>
          <p className="subtitulo">Colaboradores com interesse mútuo confirmado para troca de experiências, mentoria e café virtual.</p>
        </div>
        <div className="estatisticas">
          <div className="cartao estatistica">
            <IconeCoracao className="estatistica__icone estatistica__icone--verde" />
            <span>
              <strong>{confirmadas.length}</strong> Matches ativos
            </span>
          </div>
          <div className="cartao estatistica">
            <IconeCha className="estatistica__icone estatistica__icone--laranja" />
            <span>
              <strong>{cafesMarcados}</strong> Cafés marcados
            </span>
          </div>
        </div>
      </header>

      {carregando && <Carregando />}
      {erro && <Erro erro={erro} aoTentarDeNovo={recarregar} />}

      {dados && (
        <>
          {destaque && (
            <DestaqueMatch
              eu={perfil.name}
              conexao={destaque}
              aoDispensar={() => {
                dispensar(perfil.id, destaque.match_id);
                setDispensados(lerDispensados(perfil.id));
              }}
            />
          )}

          {recebidas.length > 0 && (
            <section className="bloco-lista" aria-labelledby="recebidas-titulo">
              <div className="cartao barra-lista">
                <h2 id="recebidas-titulo">
                  Solicitações recebidas <span className="contador-pilula">{recebidas.length}</span>
                </h2>
                <p className="pequeno">Aceitar não gasta sua cota semanal. Recusar é discreto: ninguém é avisado.</p>
              </div>
              <ul className="lista-matches">
                {recebidas.map((c) => (
                  <LinhaMatch key={c.match_id} conexao={c} tipo="recebida" aoResponder={responder} ocupado={ocupado} />
                ))}
              </ul>
            </section>
          )}

          <section className="bloco-lista" aria-labelledby="ativos-titulo">
            <div className="cartao barra-lista">
              <h2 id="ativos-titulo">
                Todos os seus Matches Ativos <span className="contador-pilula">{confirmadas.length}</span>
              </h2>
              <div className="barra-lista__ferramentas">
                <label className="busca busca--clara">
                  <IconeBusca />
                  <span className="so-leitor">Buscar matches</span>
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar matches por nome, área ou interesse."
                  />
                </label>
                <div className="menu" ref={raizFiltro}>
                  <button
                    type="button"
                    className="botao botao--contorno botao--pequeno botao--auto"
                    aria-haspopup="true"
                    aria-expanded={menuFiltro}
                    onClick={() => setMenuFiltro(!menuFiltro)}
                  >
                    <IconeAjustes /> {filtro === 'TODOS' ? 'Filtros' : FILTROS.find((f) => f.id === filtro).rotulo}
                  </button>
                  {menuFiltro && (
                    <div className="menu__lista" role="group" aria-label="Filtrar matches">
                      {FILTROS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={filtro === f.id}
                          onClick={() => {
                            setFiltro(f.id);
                            setMenuFiltro(false);
                          }}
                        >
                          {f.rotulo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!confirmadas.length && !aguardando.length ? (
              <div className="cartao">
                <Vazio
                  titulo="Nenhum match ainda"
                  texto="Demonstre interesse em quem tem a ver com você. Quando for recíproco, aparece aqui."
                >
                  <Link to="/descobrir" className="botao botao--primario botao--auto">
                    Descobrir colaboradores
                  </Link>
                </Vazio>
              </div>
            ) : linhas.length ? (
              <ul className="lista-matches">
                {linhas.map(({ c, tipo }) => (
                  <LinhaMatch key={c.match_id} conexao={c} tipo={tipo} cafe={tipo === 'confirmada' ? cafes[c.match_id] : null} />
                ))}
              </ul>
            ) : (
              <p className="pequeno centro">Nenhum match encontrado com esse filtro.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
