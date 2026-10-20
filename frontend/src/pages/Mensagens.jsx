import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Avatar, Carregando, Erro, Modal, Vazio } from '../components/Basicos.jsx';
import {
  IconeAtualizar,
  IconeBrilho,
  IconeBusca,
  IconeCalendario,
  IconeCha,
  IconeCheck,
  IconeCheckCirculo,
  IconeEmoji,
  IconeEnviar,
  IconeMensagem,
  IconePerfil,
  IconeRelogio,
  IconeVoltar,
} from '../components/Icones.jsx';
import MenuPessoa from '../components/MenuPessoa.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';
import {
  HORARIOS,
  cafeAgendado,
  lerMensagemDeCafe,
  proximosDiasUteis,
  registrarCafe,
  textoDoAceite,
  textoDoConvite,
} from '../utils/cafe.js';
import { diaDaConversa, hora, listaEmTexto, porcentagem, primeiroNome, quandoCurto, unidadeECidade } from '../utils/formatar.js';
import { lerLidas, marcarLida, naoLida } from '../utils/lidas.js';

const INTERVALO_MS = 5000;
const INTERVALO_LISTA_MS = 20000;
const PAGINA = 100;
const EMOJIS = ['😀', '😂', '😊', '👍', '🙌', '🎉', '☕', '🚀', '💡', '❤️', '👏', '🤝'];

// Todas as mensagens de uma conversa: a API devolve até 100 por vez, então pagina pelo último id.
async function todasMensagens(conexaoId, sinal) {
  let depois = 0;
  let todas = [];
  for (let i = 0; i < 20; i += 1) {
    const { messages } = await API.mensagens(conexaoId, depois, sinal);
    todas = todas.concat(messages);
    if (messages.length < PAGINA) break;
    depois = messages[messages.length - 1].id;
  }
  return todas;
}

// Escolha de dia e horário para o convite de Coffee Chat.
function PropostaCafe({ nome, aoFechar, aoEnviar }) {
  const dias = proximosDiasUteis(5);
  const [dia, setDia] = useState(dias[0]);
  const [horario, setHorario] = useState('10:30');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    const ok = await aoEnviar(`${dia} às ${horario}`);
    setEnviando(false);
    if (ok) aoFechar();
  }

  return (
    <Modal titulo={`Propor Coffee Chat com ${nome}`} aoFechar={aoFechar} ocupado={enviando}>
      <form className="formulario" onSubmit={enviar}>
        <p className="pequeno">
          15 minutos, sem pauta formal. O convite chega como mensagem no chat e a outra pessoa pode aceitar ou sugerir outro horário.
        </p>
        <label className="campo">
          <span>Dia</span>
          <select className="campo__controle" value={dia} onChange={(e) => setDia(e.target.value)}>
            {dias.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <fieldset className="campo">
          <legend>Horário</legend>
          <div className="chips">
            {HORARIOS.map((h) => (
              <button
                key={h}
                type="button"
                className={`chip chip--escolha chip--laranja${horario === h ? ' chip--ativo' : ''}`}
                aria-pressed={horario === h}
                onClick={() => setHorario(h)}
              >
                {h}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="modal__acoes">
          <button type="button" className="botao botao--contorno" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="botao botao--primario" disabled={enviando}>
            <IconeCha /> Enviar convite
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CartaoConvite({ mensagem, quando, minha, estado, nomeOutra, aoAceitar, aoSugerir, ocupado }) {
  return (
    <div className={`convite${minha ? ' convite--minha' : ''}`}>
      <div className="convite__topo">
        <span className="convite__icone">
          <IconeCha />
        </span>
        <div>
          <p className="sobretitulo">Convite Coffee Chat</p>
          <strong>Coffee Chat Virtual (15 min)</strong>
          <p className="convite__quando">
            <IconeCalendario /> Sugerido: {quando}
          </p>
          <p className="pequeno">15 minutos • Sem pauta formal • Descontração & Networking</p>
        </div>
        <span className="pequeno convite__hora">{hora(mensagem.created_at)}</span>
      </div>
      {estado === 'aceito' && (
        <p className="convite__estado convite__estado--ok">
          <IconeCheckCirculo /> Convite aceito
        </p>
      )}
      {estado === 'substituido' && <p className="convite__estado">Substituído por uma nova sugestão de horário</p>}
      {estado === 'aberto' && minha && (
        <p className="convite__estado">
          <IconeRelogio /> Aguardando resposta de {nomeOutra}
        </p>
      )}
      {estado === 'aberto' && !minha && (
        <div className="convite__acoes">
          <button type="button" className="botao botao--cinza botao--pequeno" onClick={aoSugerir} disabled={ocupado}>
            <IconeRelogio /> Sugerir outro
          </button>
          <button type="button" className="botao botao--primario botao--pequeno" onClick={() => aoAceitar(quando)} disabled={ocupado}>
            <IconeCheckCirculo /> Aceitar convite
          </button>
        </div>
      )}
    </div>
  );
}

// Conversa aberta: histórico, sugestão de abertura, convites de café e envio. Polling a cada 5 s com a aba visível.
function Conversa({ id, conexao, abrirCafe, aoConsumirCafe, aoVoltar, aoBloquear, aoAtualizar }) {
  const { perfil } = useAuth();
  const avisar = useAviso();
  const [estado, setEstado] = useState({ carregando: true, erro: null, indisponivel: false });
  const [mensagens, setMensagens] = useState([]);
  const [quebraGelo, setQuebraGelo] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [proposta, setProposta] = useState(abrirCafe);
  const [emojis, setEmojis] = useState(false);
  const ultimoId = useRef(0);
  const fim = useRef(null);
  const campo = useRef(null);
  const nome = primeiroNome(conexao.name);

  // `avancar` é falso para a mensagem recém-enviada: o polling continua de onde parou e não pula
  // mensagens da outra pessoa com id menor que o da enviada.
  const adicionar = useCallback((novas, avancar = true) => {
    if (!novas.length) return;
    if (avancar) ultimoId.current = Math.max(ultimoId.current, novas[novas.length - 1].id);
    setMensagens((atuais) => [...atuais, ...novas.filter((n) => !atuais.some((a) => a.id === n.id))].sort((a, b) => a.id - b.id));
  }, []);

  const carregar = useCallback(async () => {
    setEstado({ carregando: true, erro: null, indisponivel: false });
    ultimoId.current = 0;
    setMensagens([]);
    try {
      const [lista, gelo] = await Promise.all([todasMensagens(id), API.quebraGelo(id).catch(() => null)]);
      adicionar(lista);
      setQuebraGelo(gelo?.match_summary ?? null);
      setEstado({ carregando: false, erro: null, indisponivel: false });
    } catch (e) {
      const indisponivel = e.status === 403 || e.status === 404;
      setEstado({ carregando: false, erro: indisponivel ? null : e, indisponivel });
    }
  }, [id, adicionar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O pedido de abrir a proposta de café (?cafe=1) vale uma vez: depois de lido, sai da URL.
  useEffect(() => {
    if (abrirCafe) aoConsumirCafe();
  }, [abrirCafe, aoConsumirCafe]);

  useEffect(() => {
    if (estado.carregando || estado.erro || estado.indisponivel) return undefined;
    const controle = new AbortController();
    const relogio = setInterval(async () => {
      if (document.hidden) return;
      try {
        const { messages } = await API.mensagens(id, ultimoId.current, controle.signal);
        if (!controle.signal.aborted) adicionar(messages);
      } catch (e) {
        if (e.name === 'AbortError') return;
        if (e.status === 403 || e.status === 404) setEstado({ carregando: false, erro: null, indisponivel: true });
      }
    }, INTERVALO_MS);
    return () => {
      clearInterval(relogio);
      controle.abort();
    };
  }, [id, estado, adicionar]);

  // Mantém a lista de conversas, as lidas e o registro de cafés em dia com o que está aberto.
  useEffect(() => {
    if (estado.carregando) return;
    const ultima = mensagens[mensagens.length - 1];
    if (ultima) marcarLida(perfil.id, id, ultima.id);
    registrarCafe(perfil.id, id, cafeAgendado(mensagens));
    aoAtualizar(id, mensagens);
    fim.current?.scrollIntoView?.({ block: 'end' });
  }, [mensagens, estado.carregando, perfil.id, id, aoAtualizar]);

  async function enviarCorpo(corpo) {
    setEnviando(true);
    try {
      adicionar([await API.enviarMensagem(id, corpo)], false);
      return true;
    } catch (e) {
      if (e.status === 403 || e.status === 404) setEstado({ carregando: false, erro: null, indisponivel: true });
      else avisar(e.message, 'erro');
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    const corpo = texto.trim();
    if (!corpo || enviando) return;
    if (await enviarCorpo(corpo)) setTexto('');
  }

  async function aceitarConvite(quando) {
    if (await enviarCorpo(textoDoAceite(quando))) avisar(`Coffee Chat confirmado: ${quando}.`);
  }

  async function enviarConvite(quando) {
    const ok = await enviarCorpo(textoDoConvite(quando));
    if (ok) avisar(`Convite enviado para ${nome}.`);
    return ok;
  }

  if (estado.carregando) return <Carregando texto="Abrindo conversa..." />;
  if (estado.erro) return <Erro erro={estado.erro} aoTentarDeNovo={carregar} />;
  if (estado.indisponivel) {
    return (
      <Vazio titulo="Conversa indisponível" texto="Esta conversa não existe ou foi encerrada.">
        <Link className="botao botao--contorno botao--auto" to="/chat">
          Voltar às conversas
        </Link>
      </Vazio>
    );
  }

  // Estado de cada convite: aceito, substituído por um convite mais novo, ou aberto.
  const cafes = mensagens.map((m) => ({ m, cafe: lerMensagemDeCafe(m.body) }));
  const aceitos = new Set(cafes.filter((c) => c.cafe?.tipo === 'aceite').map((c) => c.cafe.quando));
  const ultimoConvite = [...cafes].reverse().find((c) => c.cafe?.tipo === 'convite')?.m.id;
  const estadoDoConvite = (m, quando) => (aceitos.has(quando) ? 'aceito' : m.id !== ultimoConvite ? 'substituido' : 'aberto');
  const comuns = conexao.shared_interests.slice(0, 3);

  return (
    <>
      <header className="conversa__topo">
        <button type="button" className="icone-botao conversa__voltar" aria-label="Voltar às conversas" onClick={aoVoltar}>
          <IconeVoltar />
        </button>
        <Avatar nome={conexao.name} tamanho={44}>
          <span className="selo-status selo-status--ativo" aria-hidden="true" />
        </Avatar>
        <div className="conversa__quem">
          <p>
            <strong>{conexao.name}</strong> {conexao.new && <span className="pilula pilula--verde">Match recente</span>}
          </p>
          <p className="pequeno so-desktop">
            {unidadeECidade(conexao.department, conexao.city)} <span className="destaque-verde">• Conexão confirmada</span>
          </p>
          <p className="pequeno so-celular">
            <span className="ponto ponto--verde" aria-hidden="true" /> Match bilateral
          </p>
        </div>
        <div className="conversa__acoes">
          <button type="button" className="botao botao--suave botao--pequeno botao--auto" onClick={() => setProposta(true)}>
            <IconeCha /> Propor Coffee Chat (15 min)
          </button>
          <Link to={`/pessoa/${conexao.employee_id}`} className="icone-botao" aria-label={`Ver perfil de ${conexao.name}`}>
            <IconePerfil />
          </Link>
          <MenuPessoa pessoaId={conexao.employee_id} nome={conexao.name} aoBloquear={aoBloquear} />
        </div>
      </header>

      <aside className="sinergia" aria-label="Sinergia em comum">
        <span className="sinergia__icone">
          <IconeBrilho />
        </span>
        <div>
          <p>
            <strong>{comuns.length ? 'Vocês têm sinergia em comum: ' : 'Vocês deram match!'}</strong>
            {comuns.length > 0 && <span className="destaque">{listaEmTexto(comuns)}</span>}
          </p>
          {quebraGelo && <p className="pequeno">{quebraGelo}</p>}
        </div>
        <span className="sinergia__valor">{porcentagem(conexao.affinity_score)} afinidade</span>
      </aside>

      <div className="conversa__mensagens" role="log" aria-live="polite" aria-label="Mensagens">
        {!mensagens.length && <p className="pequeno centro">Diga oi para {nome} ou proponha um Coffee Chat rápido.</p>}
        {cafes.map(({ m, cafe }, i) => {
          const anterior = mensagens[i - 1];
          const novoDia = !anterior || new Date(anterior.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const minha = m.sender_id === perfil.id;
          let corpo;
          if (cafe?.tipo === 'convite') {
            corpo = (
              <CartaoConvite
                mensagem={m}
                quando={cafe.quando}
                minha={minha}
                estado={estadoDoConvite(m, cafe.quando)}
                nomeOutra={nome}
                aoAceitar={aceitarConvite}
                aoSugerir={() => setProposta(true)}
                ocupado={enviando}
              />
            );
          } else if (cafe?.tipo === 'aceite') {
            corpo = (
              <p className="evento">
                <IconeCheckCirculo /> {minha ? 'Você confirmou' : `${nome} confirmou`} o Coffee Chat: <strong>{cafe.quando}</strong>
              </p>
            );
          } else {
            corpo = (
              <div className={`mensagem${minha ? ' mensagem--minha' : ''}`}>
                {!minha && <Avatar nome={conexao.name} tamanho={28} />}
                <div>
                  <p className="mensagem__bolha">{m.body}</p>
                  <p className="mensagem__meta">
                    <time dateTime={new Date(m.created_at).toISOString()}>{hora(m.created_at)}</time> • {minha ? 'Você' : nome}
                    {minha && <IconeCheck />}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <Fragment key={m.id}>
              {novoDia && <p className="separador-dia">{diaDaConversa(m.created_at)}</p>}
              {corpo}
            </Fragment>
          );
        })}
        <div ref={fim} />
      </div>

      <form className="conversa__envio" onSubmit={enviar}>
        <div className="menu so-desktop">
          <button
            type="button"
            className="icone-botao"
            aria-label="Inserir emoji"
            aria-expanded={emojis}
            onClick={() => setEmojis(!emojis)}
          >
            <IconeEmoji />
          </button>
          {emojis && (
            <div className="emojis" role="group" aria-label="Emojis">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setTexto((t) => t + e);
                    setEmojis(false);
                    campo.current?.focus();
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="icone-botao icone-botao--laranja"
          aria-label="Propor Coffee Chat"
          onClick={() => setProposta(true)}
        >
          <IconeCha />
        </button>
        <input
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma mensagem ou proponha um café..."
          aria-label="Mensagem"
          maxLength={1000}
        />
        <button
          type="submit"
          className="botao botao--primario botao--auto conversa__enviar"
          aria-label="Enviar"
          disabled={!texto.trim() || enviando}
        >
          <span className="so-desktop">Enviar</span> <IconeEnviar />
        </button>
      </form>

      {proposta && <PropostaCafe nome={nome} aoFechar={() => setProposta(false)} aoEnviar={enviarConvite} />}
    </>
  );
}

// Lista de conversas e conversa aberta, lado a lado no desktop e uma de cada vez no celular.
export default function Mensagens() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const { perfil } = useAuth();
  const { dados, erro, carregando, recarregar } = useCarregar(() => API.conexoes({ espiar: true }), []);
  const [previas, setPrevias] = useState(() => new Map());
  const [lidas, setLidas] = useState(() => lerLidas(perfil.id));
  const [filtro, setFiltro] = useState('TODAS');
  const [busca, setBusca] = useState('');
  const abrirCafe = params.get('cafe') === '1';

  const consumirCafe = useCallback(() => setParams({}, { replace: true }), [setParams]);

  // Última mensagem e café de cada conversa, para a lista. Atualiza a cada 20 s com a aba visível.
  const confirmadas = dados?.confirmadas;
  useEffect(() => {
    if (!confirmadas?.length) return undefined;
    const controle = new AbortController();
    const atualizar = async () => {
      if (document.hidden) return;
      const resultados = await Promise.allSettled(confirmadas.map((c) => todasMensagens(c.match_id, controle.signal)));
      if (controle.signal.aborted) return;
      const mapa = new Map();
      resultados.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const conexaoId = String(confirmadas[i].match_id);
        const cafe = cafeAgendado(r.value);
        mapa.set(conexaoId, { ultima: r.value[r.value.length - 1] ?? null, cafe });
        registrarCafe(perfil.id, conexaoId, cafe);
      });
      setPrevias(mapa);
      setLidas(lerLidas(perfil.id));
    };
    atualizar();
    const relogio = setInterval(atualizar, INTERVALO_LISTA_MS);
    return () => {
      clearInterval(relogio);
      controle.abort();
    };
  }, [confirmadas, perfil.id]);

  const aoAtualizar = useCallback(
    (conexaoId, mensagens) => {
      setPrevias((atual) =>
        new Map(atual).set(String(conexaoId), { ultima: mensagens[mensagens.length - 1] ?? null, cafe: cafeAgendado(mensagens) }),
      );
      setLidas(lerLidas(perfil.id));
    },
    [perfil.id],
  );

  const conexao = confirmadas?.find((c) => String(c.match_id) === id);
  const termo = busca.trim().toLowerCase();
  const itens = (confirmadas ?? [])
    .map((c) => ({ c, previa: previas.get(String(c.match_id)) }))
    .map((item) => ({ ...item, naoLida: naoLida(item.previa?.ultima, String(item.c.match_id), perfil.id, lidas) }))
    .filter(({ c }) => !termo || [c.name, c.department, c.city].some((t) => t?.toLowerCase().includes(termo)))
    .sort((a, b) => (b.previa?.ultima?.id ?? 0) - (a.previa?.ultima?.id ?? 0));
  const totalNaoLidas = itens.filter((i) => i.naoLida).length;
  const visiveis = itens.filter((i) => filtro === 'TODAS' || (filtro === 'NAO_LIDAS' ? i.naoLida : i.previa?.cafe));

  let painel = (
    <div className="conversa__vazia">
      <IconeMensagem />
      <p>Escolha uma conversa na lista para começar.</p>
    </div>
  );
  if (id && carregando) painel = <Carregando />;
  else if (id && conexao)
    painel = (
      <Conversa
        key={id}
        id={id}
        conexao={conexao}
        abrirCafe={abrirCafe}
        aoConsumirCafe={consumirCafe}
        aoVoltar={() => navegar('/chat')}
        aoAtualizar={aoAtualizar}
        aoBloquear={() => {
          navegar('/chat', { replace: true });
          recarregar();
        }}
      />
    );
  else if (id && dados) {
    painel = (
      <Vazio titulo="Conversa indisponível" texto="Esta conversa não existe ou foi encerrada.">
        <Link className="botao botao--contorno botao--auto" to="/chat">
          Voltar às conversas
        </Link>
      </Vazio>
    );
  }

  const textoPrevia = (previa) => {
    if (!previa?.ultima) return 'Nenhuma mensagem ainda. Diga oi!';
    const cafe = lerMensagemDeCafe(previa.ultima.body);
    const autor = previa.ultima.sender_id === perfil.id ? 'Você: ' : '';
    if (cafe?.tipo === 'convite') return `${autor}Convite para Coffee Chat`;
    if (cafe?.tipo === 'aceite') return `Coffee Chat confirmado: ${cafe.quando}`;
    return `${autor}${previa.ultima.body}`;
  };

  return (
    <main className="pagina pagina--chat" data-conversa={id ? 'aberta' : 'fechada'}>
      <header className="pagina__cabecalho">
        <div>
          <p className="sobretitulo">
            <IconeMensagem /> Avanade hub de conexões
          </p>
          <h1>Mensagens & Chat Corporativo</h1>
          <p className="subtitulo">
            Converse com seus matches e alinhe rodadas de Coffee Chat rápidas e informais para fortalecer a rede global.
          </p>
        </div>
        {confirmadas && (
          <span className="pilula pilula--branca">
            <span className="ponto ponto--verde" aria-hidden="true" /> {confirmadas.length}{' '}
            {confirmadas.length === 1 ? 'conversa ativa' : 'conversas ativas'}
          </span>
        )}
      </header>

      <div className="chat" data-conversa={id ? 'aberta' : 'fechada'}>
        <section className="cartao chat__lista" aria-label="Conversas">
          <label className="busca busca--clara">
            <IconeBusca />
            <span className="so-leitor">Buscar conversa</span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conversa ou colega..." />
          </label>
          <div className="abas-pilula" role="group" aria-label="Filtrar conversas">
            {[
              ['TODAS', 'Todas'],
              ['NAO_LIDAS', 'Não lidas'],
              ['CAFE', 'Com café agendado'],
            ].map(([valor, rotulo]) => (
              <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
                {rotulo}
                {valor === 'NAO_LIDAS' && totalNaoLidas > 0 && <span className="contador-pilula">{totalNaoLidas}</span>}
              </button>
            ))}
          </div>

          {carregando && !dados && <Carregando />}
          {erro && <Erro erro={erro} aoTentarDeNovo={recarregar} />}
          {dados && !dados.confirmadas.length && (
            <Vazio titulo="Nenhuma conversa ainda" texto="O chat abre quando duas pessoas demonstram interesse uma pela outra.">
              <Link className="botao botao--primario botao--auto" to="/descobrir">
                Descobrir colaboradores
              </Link>
            </Vazio>
          )}
          {dados && dados.confirmadas.length > 0 && !visiveis.length && <p className="pequeno centro">Nenhuma conversa neste filtro.</p>}

          <ul className="chat__itens">
            {visiveis.map(({ c, previa, naoLida: pendente }) => (
              <li key={c.match_id}>
                <NavLink to={`/chat/${c.match_id}`} className={({ isActive }) => `chat__item${isActive ? ' ativo' : ''}`}>
                  <Avatar nome={c.name} tamanho={44}>
                    <span className="selo-status selo-status--ativo" aria-hidden="true" />
                  </Avatar>
                  <span className="chat__item-texto">
                    <span className="chat__item-linha">
                      <strong>{c.name}</strong>
                      {previa?.ultima && (
                        <span className={`pequeno${pendente ? ' destaque' : ''}`}>{quandoCurto(previa.ultima.created_at)}</span>
                      )}
                    </span>
                    <span className="pequeno">{c.department}</span>
                    {previa?.cafe ? (
                      <span className="chat__item-cafe">
                        <IconeCalendario /> Café agendado: {previa.cafe}
                      </span>
                    ) : (
                      <span className={`chat__item-previa${pendente ? ' chat__item-previa--nova' : ''}`}>{textoPrevia(previa)}</span>
                    )}
                  </span>
                  {pendente && <span className="ponto ponto--laranja" aria-label="Mensagem não lida" />}
                </NavLink>
              </li>
            ))}
          </ul>

          <p className="chat__rodape">
            <span>
              <IconeAtualizar /> Atualização automática a cada 5 s
            </span>
          </p>
        </section>

        <section className="cartao chat__conversa" aria-label="Conversa">
          {painel}
        </section>
      </div>
    </main>
  );
}
