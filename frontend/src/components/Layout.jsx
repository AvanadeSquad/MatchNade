import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../services/api.js';
import { lerPreferencias } from '../utils/preferencias.js';
import { Avatar, Modal, plural } from './Basicos.jsx';
import { IconeAjuda, IconeBusca, IconeChat, IconeCoracao, IconeMaleta, IconeMatches, IconePerfil, IconeSino } from './Icones.jsx';

// `curto` e `Icone` aparecem na barra inferior do celular.
const ITENS = [
  { para: '/descobrir', rotulo: 'Descobrir', curto: 'Descobrir', Icone: IconeMaleta },
  { para: '/matches', rotulo: 'Matches Bilaterais', curto: 'Matches', Icone: IconeMatches },
  { para: '/chat', rotulo: 'Mensagens & Chat', curto: 'Chat', Icone: IconeChat },
  { para: '/eu', rotulo: 'Meu Perfil', curto: 'Perfil', Icone: IconePerfil },
];

const LayoutContext = createContext({ atualizarNotificacoes: () => {} });
export const useLayout = () => useContext(LayoutContext);

export function Marca() {
  return (
    <Link to="/descobrir" className="marca" aria-label="Avanade Connect, ir para Descobrir">
      <span>Avanade</span>
      <strong>Connect</strong>
    </Link>
  );
}

// Notificações do sino: solicitações recebidas e matches ainda não vistos.
function Notificacoes({ conexoes, mostrarPonto }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);
  const recebidas = conexoes?.recebidas ?? [];
  const novos = (conexoes?.confirmadas ?? []).filter((c) => c.new);
  const total = recebidas.length + novos.length;

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => !raiz.current?.contains(e.target) && setAberto(false);
    const teclar = (e) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', teclar);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', teclar);
    };
  }, [aberto]);

  return (
    <div className="notificacoes" ref={raiz}>
      <button
        type="button"
        className="icone-botao"
        aria-label={total ? `Notificações: ${total} novas` : 'Notificações'}
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        <IconeSino />
        {total > 0 && mostrarPonto && <span className="ponto-aviso" aria-hidden="true" />}
      </button>
      {aberto && (
        <div className="notificacoes__painel" role="dialog" aria-label="Notificações">
          <p className="rotulo">Notificações</p>
          {!total && <p className="pequeno">Nada novo por aqui.</p>}
          {recebidas.length > 0 && (
            <Link to="/matches" className="notificacoes__item" onClick={() => setAberto(false)}>
              <IconeCoracao />
              <span>{plural(recebidas.length, 'pessoa demonstrou', 'pessoas demonstraram')} interesse em você</span>
            </Link>
          )}
          {novos.map((c) => (
            <Link
              key={c.match_id}
              to={`/match/${c.match_id}`}
              state={{ pessoaId: c.employee_id }}
              className="notificacoes__item"
              onClick={() => setAberto(false)}
            >
              <Avatar nome={c.name} tamanho={28} />
              <span>Novo match com {c.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Busca() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const [texto, setTexto] = useState(pathname === '/descobrir' ? (params.get('q') ?? '') : '');

  function buscar(evento) {
    evento.preventDefault();
    const termo = texto.trim();
    navegar(termo ? `/descobrir?q=${encodeURIComponent(termo)}` : '/descobrir');
  }

  return (
    <form className="busca" role="search" onSubmit={buscar}>
      <IconeBusca />
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por skills, unidades, interesses..."
        aria-label="Buscar colaboradores"
      />
    </form>
  );
}

// Estrutura das telas do dia a dia: cabeçalho com navegação em pílulas, conteúdo e rodapé.
// No celular a navegação vai para uma barra fixa no rodapé.
export default function Layout() {
  const { perfil } = useAuth();
  const { pathname } = useLocation();
  const [conexoes, setConexoes] = useState(null);
  const [ajuda, setAjuda] = useState(false);

  // `espiar` mantém o selo "novo" dos matches até a pessoa abrir a tela de matches.
  const atualizarNotificacoes = useCallback(() => {
    API.conexoes({ espiar: true })
      .then(setConexoes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    atualizarNotificacoes();
  }, [pathname, atualizarNotificacoes]);

  const valor = useMemo(() => ({ atualizarNotificacoes, conexoes }), [atualizarNotificacoes, conexoes]);

  return (
    <LayoutContext.Provider value={valor}>
      <div className="app">
        <header className="topo">
          <div className="topo__conteudo">
            <Marca />
            <Busca key={pathname} />
            <nav className="topo__nav" aria-label="Navegação principal">
              {ITENS.map(({ para, rotulo }) => (
                <NavLink key={para} to={para} className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
                  {rotulo}
                </NavLink>
              ))}
            </nav>
            <div className="topo__acoes">
              <Link to="/descobrir" className="icone-botao topo__so-celular" aria-label="Buscar">
                <IconeBusca />
              </Link>
              <Notificacoes conexoes={conexoes} mostrarPonto={lerPreferencias(perfil.id).notificacoes} />
              <button type="button" className="icone-botao" aria-label="Como funciona" onClick={() => setAjuda(true)}>
                <IconeAjuda />
              </button>
              <Link to="/eu" className="topo__usuario" aria-label={`Meu perfil: ${perfil.name}`}>
                <Avatar nome={perfil.name} tamanho={36} />
                <span>
                  <strong>{perfil.name}</strong>
                  <span>{perfil.location}</span>
                </span>
              </Link>
            </div>
          </div>
        </header>

        <div className="app__conteudo">
          <Outlet />
        </div>

        <footer className="rodape">
          <div className="rodape__conteudo">
            <p>
              <strong>Avanade Connect</strong> <span>• Fostering Global Human Connection</span>
            </p>
            <nav aria-label="Links institucionais">
              <button type="button" onClick={() => setAjuda(true)}>
                Políticas de Conexão
              </button>
              <button type="button" onClick={() => setAjuda(true)}>
                Privacidade
              </button>
              <button type="button" onClick={() => setAjuda(true)}>
                Suporte & Mentoria
              </button>
            </nav>
            <p className="pequeno">© {new Date().getFullYear()} Avanade Connect. Uso interno.</p>
          </div>
        </footer>

        <nav className="nav-inferior" aria-label="Navegação principal (celular)">
          {ITENS.map(({ para, curto, Icone }) => (
            <NavLink key={para} to={para} className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
              <Icone />
              {curto}
            </NavLink>
          ))}
        </nav>
      </div>

      {ajuda && (
        <Modal titulo="Como funciona o Avanade Connect" aoFechar={() => setAjuda(false)}>
          <ul className="lista-pontos">
            <li>As sugestões são ordenadas pela afinidade entre os seus interesses profissionais e pessoais e os de cada colega.</li>
            <li>Cargo e senioridade nunca entram no cálculo nem aparecem na descoberta. Só ficam visíveis depois do match.</li>
            <li>O match só acontece quando as duas pessoas demonstram interesse. Aí o chat abre.</li>
            <li>Você tem uma cota semanal de solicitações (de 1 a 5), que renova toda segunda-feira.</li>
            <li>Você pode pausar sua exposição, bloquear, denunciar e excluir seus dados em Meu Perfil.</li>
          </ul>
          <button type="button" className="botao botao--contorno" onClick={() => setAjuda(false)}>
            Entendi
          </button>
        </Modal>
      )}
    </LayoutContext.Provider>
  );
}
