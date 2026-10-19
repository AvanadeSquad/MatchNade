import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, Barra, Cabecalho, Carregando, Erro } from '../components/Basicos.jsx';
import {
  IconeCoracao,
  IconeEscudoCheck,
  IconeMaleta,
  IconeMensagem,
  IconePino,
  IconeRaio,
  IconeRelogio,
  IconeVoltar,
  IconeX,
} from '../components/Icones.jsx';
import { useLayout } from '../components/Layout.jsx';
import MenuPessoa from '../components/MenuPessoa.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { useCelular } from '../hooks/useCelular.js';
import { API } from '../services/api.js';
import { porcentagem, primeiroNome } from '../utils/formatar.js';
import { ignorar } from '../utils/ignorados.js';
import { nomeDoObjetivo } from '../utils/objetivos.js';

// Perfil de outra pessoa. Cargo e resumo só vêm da API depois do match.
export default function PerfilPessoa() {
  const { id } = useParams();
  const navegar = useNavigate();
  const avisar = useAviso();
  const { perfil, atualizarPerfilEmSilencio } = useAuth();
  const celular = useCelular();
  const { atualizarNotificacoes } = useLayout();
  const { dados: pessoa, erro, carregando, recarregar } = useCarregar(() => API.pessoa(id), [id]);
  const [enviando, setEnviando] = useState(false);

  // Executa a ação na API e depois atualiza a cota. Devolve a resposta, ou null se a ação falhou.
  async function executar(acao) {
    setEnviando(true);
    let resposta = null;
    try {
      resposta = await acao();
    } catch (e) {
      avisar(e.message, 'erro');
    }
    if (resposta) {
      await atualizarPerfilEmSilencio();
      atualizarNotificacoes();
    }
    setEnviando(false);
    return resposta;
  }

  async function demonstrarInteresse() {
    const r = await executar(() => API.demonstrarInteresse(pessoa.id));
    if (!r) return;
    if (r.status === 'ACCEPTED') navegar(`/match/${r.match_id}`, { state: { pessoaId: pessoa.id } });
    else {
      avisar('Interesse enviado. Se a outra pessoa também quiser, vira match.');
      recarregar();
    }
  }

  async function responder(acao) {
    const r = await executar(() => API.responder(pessoa.connection.match_id, acao));
    if (!r) return;
    if (r.status === 'ACCEPTED') navegar(`/match/${r.match_id}`, { state: { pessoaId: pessoa.id } });
    else navegar('/matches', { replace: true });
  }

  function ignorarPessoa() {
    ignorar(perfil.id, pessoa.id);
    navegar('/descobrir', { replace: true });
  }

  const voltar = (
    <button type="button" className="link-acao link-acao--cinza" onClick={() => navegar(-1)}>
      <IconeVoltar /> Voltar
    </button>
  );

  if (carregando)
    return (
      <main className="pagina">
        {voltar}
        <Carregando />
      </main>
    );
  if (erro)
    return (
      <main className="pagina">
        {voltar}
        <Erro erro={erro} aoTentarDeNovo={recarregar} />
      </main>
    );

  const { connection } = pessoa;
  const confirmada = connection?.status === 'ACCEPTED';
  const nome = primeiroNome(pessoa.name);

  // Celular: "Detalhes do Colaborador", com listas em tópicos e as ações fixas no rodapé.
  if (celular) {
    return (
      <main className="pagina pagina--detalhe">
        <Cabecalho
          titulo="Detalhes do Colaborador"
          acao={<MenuPessoa pessoaId={pessoa.id} nome={pessoa.name} aoBloquear={() => navegar('/descobrir', { replace: true })} />}
        />
        <div className="linha">
          <Avatar nome={pessoa.name} tamanho={64} />
          <div>
            <h1 className="perfil__nome">{pessoa.name}</h1>
            <p className="pequeno">{[confirmada && pessoa.position, pessoa.department, pessoa.city].filter(Boolean).join(' • ')}</p>
          </div>
        </div>
        <div className="chips">
          {pessoa.connection_goals.slice(0, 1).map((g) => (
            <span key={g} className="pilula pilula--laranja">
              {nomeDoObjetivo(g)}
            </span>
          ))}
          {pessoa.department && <span className="pilula pilula--contorno-cinza">{pessoa.department}</span>}
          {pessoa.city && <span className="pilula pilula--contorno-cinza">{pessoa.city}</span>}
        </div>
        <section className="caixa-afinidade" aria-label="Afinidade com você">
          <p className="caixa-afinidade__titulo">
            <span>Afinidade com você</span>
            <strong>{porcentagem(pessoa.affinity.score)}</strong>
          </p>
          <p>
            <span>Interesses profissionais</span>
            <strong>{porcentagem(pessoa.affinity.technical)}</strong>
          </p>
          <p>
            <span>Interesses pessoais</span>
            <strong>{porcentagem(pessoa.affinity.personal)}</strong>
          </p>
          <p>
            <span>Interesses em comum</span>
            <strong>{pessoa.shared_interests.length}</strong>
          </p>
        </section>
        <section className="detalhe__secao">
          <h2>Sobre {nome}</h2>
          <p className={confirmada && pessoa.bio ? 'texto-corrido' : 'pequeno'}>
            {confirmada
              ? pessoa.bio || `${nome} ainda não escreveu um resumo.`
              : 'O resumo profissional e o cargo aparecem depois do match.'}
          </p>
        </section>
        {[
          ['Interesses Profissionais', pessoa.tags.technical],
          ['Interesses Pessoais', pessoa.tags.hobby],
        ].map(([titulo, itens]) => (
          <section key={titulo} className="detalhe__secao">
            <h2>{titulo}</h2>
            {itens.length ? (
              <ul className="lista-pontos">
                {itens.map((t) => (
                  <li key={t.id}>{t.name}</li>
                ))}
              </ul>
            ) : (
              <p className="pequeno">Nada informado.</p>
            )}
          </section>
        ))}
        <div className="barra-fixa">
          {!connection && (
            <>
              <button type="button" className="botao botao--perigo" onClick={ignorarPessoa}>
                Ignorar
              </button>
              <button type="button" className="botao botao--sucesso" disabled={enviando} onClick={demonstrarInteresse}>
                Demonstrar Interesse
              </button>
            </>
          )}
          {connection?.status === 'PENDING' && connection.direction === 'SENT' && (
            <p className="nota-linha nota-linha--cinza" role="status">
              <IconeRelogio /> Aguardando a resposta de {nome}.
            </p>
          )}
          {connection?.status === 'PENDING' && connection.direction === 'RECEIVED' && (
            <>
              <button type="button" className="botao botao--perigo" disabled={enviando} onClick={() => responder('decline')}>
                Recusar
              </button>
              <button type="button" className="botao botao--sucesso" disabled={enviando} onClick={() => responder('accept')}>
                Aceitar
              </button>
            </>
          )}
          {confirmada && (
            <Link className="botao botao--primario" to={`/chat/${connection.match_id}`}>
              <IconeMensagem /> Abrir chat
            </Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="pagina">
      {voltar}
      <div className="perfil">
        <div className="coluna">
          <section className="cartao bloco perfil__cartao">
            <div className="linha linha--entre linha--topo">
              <Avatar nome={pessoa.name} tamanho={96} quadrado />
              <MenuPessoa pessoaId={pessoa.id} nome={pessoa.name} aoBloquear={() => navegar('/descobrir', { replace: true })} />
            </div>
            <div>
              <h1 className="perfil__nome">{pessoa.name}</h1>
              {confirmada && pessoa.position && <p>{pessoa.position}</p>}
              <p className="pequeno meta">
                <IconeMaleta /> {pessoa.department}
              </p>
              {pessoa.city && (
                <p className="pequeno meta">
                  <IconePino /> {pessoa.city}
                </p>
              )}
            </div>
            {pessoa.connection_goals.length > 0 && (
              <div className="chips">
                {pessoa.connection_goals.map((g) => (
                  <span className="pilula pilula--cinza pilula--maiuscula" key={g}>
                    {nomeDoObjetivo(g)}
                  </span>
                ))}
              </div>
            )}

            <div className="acoes-pessoa">
              {!connection && (
                <>
                  <button type="button" className="botao botao--cinza" onClick={ignorarPessoa}>
                    <IconeX /> Pular
                  </button>
                  <button type="button" className="botao botao--primario" disabled={enviando} onClick={demonstrarInteresse}>
                    <IconeCoracao /> Conectar com {nome}
                  </button>
                </>
              )}
              {connection?.status === 'PENDING' && connection.direction === 'SENT' && (
                <p className="nota-linha nota-linha--cinza" role="status">
                  <IconeRelogio /> Interesse enviado. Aguardando a resposta de {nome}.
                </p>
              )}
              {connection?.status === 'PENDING' && connection.direction === 'RECEIVED' && (
                <>
                  <button type="button" className="botao botao--perigo" disabled={enviando} onClick={() => responder('decline')}>
                    Recusar
                  </button>
                  <button type="button" className="botao botao--primario" disabled={enviando} onClick={() => responder('accept')}>
                    Aceitar conexão
                  </button>
                </>
              )}
              {confirmada && (
                <Link className="botao botao--primario" to={`/chat/${connection.match_id}`}>
                  <IconeMensagem /> Abrir chat
                </Link>
              )}
            </div>
          </section>

          <section className="cartao bloco afinidade">
            <div className="titulo-secao">
              <h3>Afinidade com você</h3>
              <span className="pilula pilula--verde">
                <IconeRaio /> {porcentagem(pessoa.affinity.score)}
              </span>
            </div>
            <Barra rotulo="Interesses profissionais" valor={pessoa.affinity.technical} />
            <Barra rotulo="Interesses pessoais" valor={pessoa.affinity.personal} />
            {pessoa.shared_interests.length > 0 && (
              <>
                <p className="rotulo">Em comum</p>
                <div className="chips">
                  {pessoa.shared_interests.map((t) => (
                    <span className="chip chip--laranja-suave" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="coluna">
          <section className="cartao bloco">
            <h3>Sobre {nome}</h3>
            {confirmada && pessoa.bio ? (
              <p className="texto-corrido">{pessoa.bio}</p>
            ) : (
              <p className="pequeno">
                <IconeEscudoCheck />{' '}
                {confirmada ? `${nome} ainda não escreveu um resumo.` : 'O resumo profissional e o cargo aparecem depois do match.'}
              </p>
            )}
          </section>
          {[
            ['Interesses profissionais', pessoa.tags.technical, 'chip--azul'],
            ['Interesses pessoais & hobbies', pessoa.tags.hobby, 'chip--pessego'],
          ].map(([titulo, itens, tom]) => (
            <section key={titulo} className="cartao bloco">
              <h3>{titulo}</h3>
              {itens.length ? (
                <div className="chips">
                  {itens.map((t) => (
                    <span key={t.id} className={`chip ${tom}`}>
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="pequeno">Nada informado.</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
