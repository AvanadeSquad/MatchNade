import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Carregando, Erro, Vazio } from '../components/Basicos.jsx';
import { IconeCoracao, IconePino, IconeX } from '../components/Icones.jsx';
import Navegacao from '../components/Navegacao.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';
import { porcentagem } from '../utils/formatar.js';
import { ignorar, lerIgnorados, limparIgnorados } from '../utils/ignorados.js';

export default function Deck() {
  const { perfil, atualizarPerfilEmSilencio } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const { dados, erro, carregando, recarregar } = useCarregar(() => API.recomendacoes(20), []);
  const [ignorados, setIgnorados] = useState(() => lerIgnorados(perfil.id));
  const [enviando, setEnviando] = useState(false);

  const fila = useMemo(() => (dados?.recommendations ?? []).filter((p) => !ignorados.has(p.employee_id)), [dados, ignorados]);
  const atual = fila[0];
  const cotaEsgotada = perfil.quota.used >= perfil.quota.max;

  const marcarComoVista = (pessoaId) => {
    ignorar(perfil.id, pessoaId);
    setIgnorados(lerIgnorados(perfil.id));
  };

  async function demonstrarInteresse() {
    setEnviando(true);
    let resposta;
    try {
      resposta = await API.demonstrarInteresse(atual.employee_id);
    } catch (e) {
      avisar(e.message, 'erro');
      if (e.code === 'COTA_ESGOTADA') await atualizarPerfilEmSilencio();
      setEnviando(false);
      return;
    }
    await atualizarPerfilEmSilencio();
    setEnviando(false);
    if (resposta.status === 'ACCEPTED') {
      navegar(`/match/${resposta.match_id}`, { state: { pessoaId: atual.employee_id } });
      return;
    }
    marcarComoVista(atual.employee_id);
    avisar(`Interesse enviado para ${atual.name}. Se a outra pessoa também quiser, vira match.`);
  }

  let conteudo;
  if (carregando) conteudo = <Carregando texto="Buscando pessoas para você..." />;
  else if (erro) conteudo = <Erro erro={erro} aoTentarDeNovo={recarregar} />;
  else if (!atual) {
    conteudo = (
      <Vazio titulo={cotaEsgotada ? 'Você usou a cota da semana' : 'Por enquanto é só'} texto={dados.message ?? 'Você já viu todas as pessoas. Volte mais tarde para ver novidades.'}>
        <button type="button" className="botao botao--contorno botao--auto" onClick={() => { limparIgnorados(perfil.id); setIgnorados(new Set()); recarregar(); }}>Atualizar</button>
      </Vazio>
    );
  } else {
    conteudo = (
      <>
        <article className="cartao cartao-pessoa" aria-label={`Sugestão: ${atual.name}`}>
          <div className="linha">
            <Avatar nome={atual.name} tamanho={56} />
            <span className="selo">{porcentagem(atual.affinity_score)} de afinidade</span>
          </div>
          <div>
            <h2>{atual.name}</h2>
            <p className="pequeno">{atual.department}</p>
          </div>
          {atual.city && <p className="meta"><IconePino /> {atual.city}</p>}
          <div>
            <p className="rotulo">Interesses em comum</p>
            {atual.shared_interests.length ? (
              <div className="chips" style={{ marginTop: 8 }}>
                {atual.shared_interests.map((tag) => <span className="chip chip--marca" key={tag}>{tag}</span>)}
              </div>
            ) : (
              <p className="pequeno" style={{ marginTop: 8 }}>Nenhum ainda, mas pode ser um bom começo de conversa.</p>
            )}
          </div>
          <Link className="link-simples" to={`/pessoa/${atual.employee_id}`}>Ver perfil completo</Link>
        </article>

        <div className="acoes">
          <button type="button" className="acao acao--pular" aria-label="Ignorar" onClick={() => marcarComoVista(atual.employee_id)} disabled={enviando}><IconeX /></button>
          <button type="button" className="acao acao--curtir" aria-label="Demonstrar interesse" onClick={demonstrarInteresse} disabled={enviando || cotaEsgotada}><IconeCoracao /></button>
        </div>
        {cotaEsgotada && <p className="erro-campo" style={{ textAlign: 'center' }}>Você já usou suas {perfil.quota.max} solicitações desta semana.</p>}
      </>
    );
  }

  return (
    <>
      <main className="tela tela--app">
        <h1>Descobrir</h1>
        <div className="deck">
          <div className="coluna">{conteudo}</div>
          <aside className="deck__lateral" aria-label="Sua semana">
            <section className="cartao">
              <p className="rotulo">Sua semana</p>
              <p className="quota">
                <strong>{perfil.quota.used} de {perfil.quota.max}</strong>
                <span>Solicitações desta semana: {perfil.quota.used} de {perfil.quota.max}</span>
              </p>
              <p className="pequeno" style={{ marginTop: 8 }}>A cota renova toda segunda-feira. Receber ou aceitar um pedido não gasta a sua.</p>
            </section>
            <section className="cartao">
              <p className="rotulo">Como funciona</p>
              <p className="pequeno" style={{ marginTop: 8 }}>Demonstre interesse em quem tem a ver com você. Se a outra pessoa também quiser, vira match e o chat abre. Cargo e senioridade não aparecem aqui.</p>
            </section>
          </aside>
        </div>
      </main>
      <Navegacao />
    </>
  );
}
