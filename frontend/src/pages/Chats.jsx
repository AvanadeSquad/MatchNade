import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { Avatar, Carregando, Erro, Vazio } from '../components/Basicos.jsx';
import { IconeEnviar, IconeVoltar } from '../components/Icones.jsx';
import MenuPessoa from '../components/MenuPessoa.jsx';
import Navegacao from '../components/Navegacao.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';
import { hora } from '../utils/formatar.js';

const INTERVALO_MS = 5000;

// Conversa aberta: histórico, sugestão de abertura e envio. Atualiza por polling a cada 5 s, só com a aba visível.
function Conversa({ id, conexao, aoVoltar, aoBloquear }) {
  const { perfil } = useAuth();
  const avisar = useAviso();
  const [estado, setEstado] = useState({ carregando: true, erro: null, indisponivel: false });
  const [mensagens, setMensagens] = useState([]);
  const [quebraGelo, setQuebraGelo] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ultimoId = useRef(0);
  const fim = useRef(null);

  const adicionar = useCallback((novas) => {
    if (!novas.length) return;
    ultimoId.current = Math.max(ultimoId.current, novas[novas.length - 1].id);
    setMensagens((atuais) => [...atuais, ...novas.filter((n) => !atuais.some((a) => a.id === n.id))]);
  }, []);

  const carregar = useCallback(async () => {
    setEstado({ carregando: true, erro: null, indisponivel: false });
    ultimoId.current = 0;
    setMensagens([]);
    try {
      const [{ messages }, gelo] = await Promise.all([API.mensagens(id), API.quebraGelo(id)]);
      adicionar(messages);
      setQuebraGelo(gelo.match_summary);
      setEstado({ carregando: false, erro: null, indisponivel: false });
    } catch (e) {
      const indisponivel = e.status === 403 || e.status === 404;
      setEstado({ carregando: false, erro: indisponivel ? null : e, indisponivel });
    }
  }, [id, adicionar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Polling: busca só as mensagens depois da última recebida e descarta a resposta se a conversa mudou.
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

  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: 'end' });
  }, [mensagens.length]);

  async function enviar(evento) {
    evento.preventDefault();
    const corpo = texto.trim();
    if (!corpo || enviando) return;
    setEnviando(true);
    try {
      adicionar([await API.enviarMensagem(id, corpo)]);
      setTexto('');
    } catch (e) {
      if (e.status === 403 || e.status === 404) setEstado({ carregando: false, erro: null, indisponivel: true });
      else avisar(e.message, 'erro');
    } finally {
      setEnviando(false);
    }
  }

  if (estado.carregando) return <Carregando />;
  if (estado.erro) return <Erro erro={estado.erro} aoTentarDeNovo={carregar} />;
  if (estado.indisponivel) {
    return (
      <Vazio titulo="Conversa indisponível" texto="Esta conversa não existe ou foi encerrada.">
        <Link className="botao botao--contorno botao--auto" to="/chat">Voltar às conversas</Link>
      </Vazio>
    );
  }

  return (
    <>
      <header className="chat__topo">
        <button type="button" className="icone-botao chat__voltar" aria-label="Voltar" onClick={aoVoltar}><IconeVoltar /></button>
        <Avatar nome={conexao.name} tamanho={40} />
        <div className="chat__quem">
          <strong>{conexao.name}</strong>
          <span className="chat__status">Match confirmado</span>
        </div>
        <MenuPessoa pessoaId={conexao.employee_id} nome={conexao.name} aoBloquear={aoBloquear} />
      </header>

      {quebraGelo && (
        <aside className="quebra-gelo" aria-label="Sugestão para começar a conversa">
          <span>{quebraGelo}</span>
          <button type="button" onClick={() => setQuebraGelo(null)}>Fechar</button>
        </aside>
      )}

      <div className="chat__mensagens" role="log" aria-live="polite" aria-label="Mensagens">
        {!mensagens.length && <p className="pequeno" style={{ textAlign: 'center' }}>Diga oi para {conexao.name.split(' ')[0]}.</p>}
        {mensagens.map((m) => (
          <div key={m.id} className={`bolha${m.sender_id === perfil.id ? ' bolha--minha' : ''}`}>
            {m.body}
            <time dateTime={new Date(m.created_at).toISOString()}>{hora(m.created_at)}</time>
          </div>
        ))}
        <div ref={fim} />
      </div>

      <form className="chat__envio" onSubmit={enviar}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite uma mensagem..." aria-label="Mensagem" maxLength={1000} />
        <button type="submit" aria-label="Enviar" disabled={!texto.trim() || enviando}><IconeEnviar /></button>
      </form>
    </>
  );
}

// Lista de conversas e conversa aberta. No desktop aparecem lado a lado; no celular, uma tela de cada vez.
export default function Chats() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { dados, erro, carregando, recarregar } = useCarregar(() => API.conexoes({ espiar: true }), []);
  const estado = id ? 'aberta' : 'fechada';
  const conexao = dados?.confirmadas.find((c) => String(c.match_id) === id);

  let painel = <p className="chats__vazio">Escolha uma conversa na lista para começar.</p>;
  if (id && carregando) painel = <Carregando />;
  else if (id && conexao) painel = <Conversa key={id} id={id} conexao={conexao} aoVoltar={() => navegar('/chat')} aoBloquear={() => { navegar('/chat', { replace: true }); recarregar(); }} />;
  else if (id && dados) {
    painel = (
      <Vazio titulo="Conversa indisponível" texto="Esta conversa não existe ou foi encerrada.">
        <Link className="botao botao--contorno botao--auto" to="/chat">Voltar às conversas</Link>
      </Vazio>
    );
  }

  return (
    <>
      <main className="tela tela--app tela--chats" data-conversa={estado}>
        <div className="chats" data-conversa={estado}>
          <section className="chats__lista" aria-label="Conversas">
            <h1>Conversas</h1>
            {carregando && !dados && <Carregando />}
            {erro && <Erro erro={erro} aoTentarDeNovo={recarregar} />}
            {dados && !dados.confirmadas.length && (
              <Vazio titulo="Nenhuma conversa ainda" texto="O chat abre quando duas pessoas demonstram interesse uma pela outra.">
                <Link className="botao botao--primario botao--auto" to="/descobrir">Descobrir pessoas</Link>
              </Vazio>
            )}
            {dados?.confirmadas.map((c) => (
              <NavLink key={c.match_id} className="chats__item" to={`/chat/${c.match_id}`}>
                <Avatar nome={c.name} />
                <span>
                  <strong>{c.name}</strong>
                  <span className="pequeno" style={{ display: 'block' }}>{c.department}</span>
                </span>
              </NavLink>
            ))}
          </section>
          <section className="chats__conversa" aria-label="Conversa">{painel}</section>
        </div>
      </main>
      <Navegacao />
    </>
  );
}
