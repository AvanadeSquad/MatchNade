import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Barra, Cabecalho, Carregando, Erro } from '../components/Basicos.jsx';
import MenuPessoa from '../components/MenuPessoa.jsx';
import Navegacao from '../components/Navegacao.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';
import { porcentagem, unidadeECidade } from '../utils/formatar.js';
import { ignorar } from '../utils/ignorados.js';
import { nomeDoObjetivo } from '../utils/objetivos.js';

export default function PerfilPessoa() {
  const { id } = useParams();
  const navegar = useNavigate();
  const avisar = useAviso();
  const { perfil, atualizarPerfilEmSilencio } = useAuth();
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
    if (resposta) await atualizarPerfilEmSilencio();
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
    else navegar('/conexoes', { replace: true });
  }

  function ignorarPessoa() {
    ignorar(perfil.id, pessoa.id);
    navegar('/descobrir', { replace: true });
  }

  if (carregando)
    return (
      <main className="tela">
        <Cabecalho titulo="Perfil" />
        <Carregando />
      </main>
    );
  if (erro)
    return (
      <main className="tela">
        <Cabecalho titulo="Perfil" />
        <Erro erro={erro} aoTentarDeNovo={recarregar} />
      </main>
    );

  const { connection } = pessoa;
  const confirmada = connection?.status === 'ACCEPTED';
  const primeiroNome = pessoa.name.split(' ')[0];

  return (
    <>
      <main className="tela tela--app">
        <Cabecalho
          titulo="Detalhes da pessoa"
          acao={<MenuPessoa pessoaId={pessoa.id} nome={pessoa.name} aoBloquear={() => navegar('/descobrir', { replace: true })} />}
        />

        <div className="duas-colunas">
          <div className="coluna">
            <div className="linha">
              <Avatar nome={pessoa.name} tamanho={72} />
              <div>
                <h2 style={{ fontSize: 24 }}>{pessoa.name}</h2>
                <p className="pequeno">{unidadeECidade(pessoa.department, pessoa.city)}</p>
                {confirmada && pessoa.position && <p className="pequeno">{pessoa.position}</p>}
              </div>
            </div>

            {pessoa.connection_goals.length > 0 && (
              <div className="chips">
                {pessoa.connection_goals.map((g) => (
                  <span className="chip" key={g}>
                    {nomeDoObjetivo(g)}
                  </span>
                ))}
              </div>
            )}

            <section className="afinidade" aria-label="Afinidade">
              <div className="afinidade__topo">
                <span>Afinidade</span>
                <strong>{porcentagem(pessoa.affinity.score)}</strong>
              </div>
              <Barra rotulo="Interesses profissionais" valor={pessoa.affinity.technical} />
              <Barra rotulo="Interesses pessoais" valor={pessoa.affinity.personal} />
              {pessoa.shared_interests.length > 0 && (
                <>
                  <p className="rotulo" style={{ color: 'var(--color-primary-text)' }}>
                    Em comum
                  </p>
                  <div className="chips">
                    {pessoa.shared_interests.map((t) => (
                      <span className="chip chip--marca" style={{ background: '#fff' }} key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>

            <div className="rodape-fixo">
              {!connection && (
                <div className="barra-acoes">
                  <button type="button" className="botao botao--perigo" onClick={ignorarPessoa}>
                    Ignorar
                  </button>
                  <button type="button" className="botao botao--sucesso" disabled={enviando} onClick={demonstrarInteresse}>
                    Demonstrar interesse
                  </button>
                </div>
              )}
              {connection?.status === 'PENDING' && connection.direction === 'SENT' && (
                <p className="pequeno" role="status">
                  Interesse enviado. Aguardando a resposta de {primeiroNome}.
                </p>
              )}
              {connection?.status === 'PENDING' && connection.direction === 'RECEIVED' && (
                <div className="barra-acoes">
                  <button type="button" className="botao botao--perigo" disabled={enviando} onClick={() => responder('decline')}>
                    Recusar
                  </button>
                  <button type="button" className="botao botao--sucesso" disabled={enviando} onClick={() => responder('accept')}>
                    Aceitar
                  </button>
                </div>
              )}
              {confirmada && (
                <button type="button" className="botao botao--primario" onClick={() => navegar(`/chat/${connection.match_id}`)}>
                  Enviar mensagem
                </button>
              )}
            </div>
          </div>

          <div className="coluna">
            {confirmada && pessoa.bio && (
              <section>
                <h2>Sobre {primeiroNome}</h2>
                <p style={{ marginTop: 8 }}>{pessoa.bio}</p>
              </section>
            )}
            {[
              ['Interesses profissionais', pessoa.tags.technical],
              ['Interesses pessoais', pessoa.tags.hobby],
            ].map(([titulo, itens]) => (
              <section key={titulo}>
                <h2>{titulo}</h2>
                {itens.length ? (
                  <ul className="lista-pontos" style={{ marginTop: 8 }}>
                    {itens.map((t) => (
                      <li key={t.id}>{t.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="pequeno" style={{ marginTop: 8 }}>
                    Nada informado.
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
      <Navegacao />
    </>
  );
}
