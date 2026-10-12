import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Carregando, Erro, Vazio } from '../components/Basicos.jsx';
import Navegacao from '../components/Navegacao.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';
import { porcentagem } from '../utils/formatar.js';

const ABAS = [
  { id: 'recebidas', rotulo: 'Recebidas', vazio: 'Quando alguém demonstrar interesse em você, aparece aqui.' },
  { id: 'confirmadas', rotulo: 'Confirmadas', vazio: 'Seus matches aparecem aqui. Demonstre interesse em quem tem a ver com você.' },
  { id: 'aguardando', rotulo: 'Aguardando', vazio: 'Interesses que você enviou e ainda não foram respondidos ficam aqui.' },
];

function CartaoConexao({ conexao, aba, aoResponder, ocupado }) {
  return (
    <li className={`cartao conexao${conexao.new ? ' cartao--destaque' : ''}`}>
      <Link className="conexao__principal" to={`/pessoa/${conexao.employee_id}`}>
        <Avatar nome={conexao.name} />
        <div>
          <p className="conexao__nome">
            {conexao.name} {conexao.new && <span className="chip chip--novo">Novo</span>}
          </p>
          <p className="pequeno">
            {conexao.department} • <span className="afinidade-roxa">{porcentagem(conexao.affinity_score)} de afinidade</span>
          </p>
          {aba === 'confirmadas' && conexao.position && <p className="pequeno">{conexao.position}</p>}
          <p className="pequeno" style={{ marginTop: 4 }}>
            {conexao.shared_interests.length ? `Em comum: ${conexao.shared_interests.join(', ')}` : 'Sem interesses em comum ainda'}
          </p>
        </div>
      </Link>
      {aba === 'recebidas' && (
        <div className="barra-acoes">
          <button type="button" className="botao botao--perigo botao--pequeno" disabled={ocupado} onClick={() => aoResponder(conexao, 'decline')}>Recusar</button>
          <button type="button" className="botao botao--sucesso botao--pequeno" disabled={ocupado} onClick={() => aoResponder(conexao, 'accept')}>Aceitar</button>
        </div>
      )}
      {aba === 'confirmadas' && (
        <Link className="botao botao--suave botao--pequeno" to={`/chat/${conexao.match_id}`}>Enviar mensagem</Link>
      )}
    </li>
  );
}

export default function Conexoes() {
  const navegar = useNavigate();
  const avisar = useAviso();
  const idBase = useId();
  const { dados, erro, carregando, recarregar } = useCarregar(() => API.conexoes(), []);
  const [aba, setAba] = useState('recebidas');
  const [ocupado, setOcupado] = useState(false);

  async function responder(conexao, acao) {
    setOcupado(true);
    try {
      const r = await API.responder(conexao.match_id, acao);
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

  // Setas esquerda e direita trocam de aba; Home e End vão para a primeira e a última.
  function aoTeclar(evento) {
    const indice = ABAS.findIndex((a) => a.id === aba);
    const destinos = {
      ArrowRight: (indice + 1) % ABAS.length,
      ArrowLeft: (indice - 1 + ABAS.length) % ABAS.length,
      Home: 0,
      End: ABAS.length - 1,
    };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    const proxima = ABAS[destinos[evento.key]];
    setAba(proxima.id);
    document.getElementById(`${idBase}-${proxima.id}`)?.focus();
  }

  const atual = ABAS.find((a) => a.id === aba);
  const lista = dados?.[aba] ?? [];

  return (
    <>
      <main className="tela tela--app">
        <h1>Conexões</h1>
        <div className="abas" role="tablist" aria-label="Tipos de conexão" onKeyDown={aoTeclar}>
          {ABAS.map(({ id, rotulo }) => (
            <button
              key={id}
              id={`${idBase}-${id}`}
              type="button"
              role="tab"
              aria-selected={aba === id}
              aria-controls={`${idBase}-painel`}
              tabIndex={aba === id ? 0 : -1}
              onClick={() => setAba(id)}
            >
              {rotulo}{dados ? ` (${dados[id].length})` : ''}
            </button>
          ))}
        </div>

        <div id={`${idBase}-painel`} role="tabpanel" aria-labelledby={`${idBase}-${aba}`}>
          {carregando && <Carregando />}
          {erro && <Erro erro={erro} aoTentarDeNovo={recarregar} />}
          {dados && !lista.length && <Vazio titulo="Nada por aqui" texto={atual.vazio} />}
          {dados && lista.length > 0 && (
            <ul className="lista lista--grade">
              {lista.map((c) => <CartaoConexao key={c.match_id} conexao={c} aba={aba} aoResponder={responder} ocupado={ocupado} />)}
            </ul>
          )}
        </div>
      </main>
      <Navegacao />
    </>
  );
}
