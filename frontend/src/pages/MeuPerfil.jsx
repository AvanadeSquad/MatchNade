import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Cabecalho, Carregando, Modal } from '../components/Basicos.jsx';
import { Equilibrio, Interruptor, Polos, Segmentado } from '../components/Controles.jsx';
import DefinirSenha from '../components/DefinirSenha.jsx';
import { EditarBio, EditarDados, EditarInteresses, PreviewPublico } from '../components/EdicaoPerfil.jsx';
import {
  IconeAjustes,
  IconeBloquear,
  IconeCadeado,
  IconeBrilho,
  IconeCheck,
  IconeChevron,
  IconeCoracao,
  IconeEditar,
  IconeEngrenagem,
  IconeEscudo,
  IconeEscudoCheck,
  IconeEstrela,
  IconeInfo,
  IconePerfil,
  IconePino,
  IconeSair,
  IconeSino,
  IconeSomar,
  IconeSubtrair,
  IconeVerificado,
} from '../components/Icones.jsx';
import { useLayout } from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { useCelular } from '../hooks/useCelular.js';
import { usePreferencias } from '../hooks/usePreferencias.js';
import { API } from '../services/api.js';
import { limparIgnorados } from '../utils/ignorados.js';
import { OBJETIVOS, nomeDoObjetivo } from '../utils/objetivos.js';
import { ALCANCES, limparPreferencias } from '../utils/preferencias.js';

function Bloqueados({ aoFechar }) {
  const avisar = useAviso();
  const { dados, carregando, recarregar } = useCarregar(() => API.bloqueados(), []);

  async function desbloquear(pessoa) {
    try {
      await API.desbloquear(pessoa.id);
      avisar(`Pessoa desbloqueada: ${pessoa.name}.`);
      recarregar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  }

  return (
    <Modal titulo="Pessoas bloqueadas" aoFechar={aoFechar}>
      {carregando && <Carregando />}
      {dados && !dados.blocked.length && <p>Você não bloqueou ninguém.</p>}
      {dados && dados.blocked.length > 0 && (
        <ul className="lista-simples">
          {dados.blocked.map((p) => (
            <li key={p.id} className="linha linha--entre">
              <span>{p.name}</span>
              <button type="button" className="botao botao--contorno botao--pequeno botao--auto" onClick={() => desbloquear(p)}>
                Desbloquear
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="botao botao--contorno" onClick={aoFechar}>
        Fechar
      </button>
    </Modal>
  );
}

export default function MeuPerfil() {
  const { perfil, definirPerfil, atualizarPerfilEmSilencio, sair } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [preferencias, atualizarPreferencias] = usePreferencias();
  const conexoes = useCarregar(() => API.conexoes({ espiar: true }), []);
  const [dialogo, setDialogo] = useState(null);
  const [pausado, setPausado] = useState(perfil.is_paused);
  const [salvandoObjetivos, setSalvandoObjetivos] = useState(false);
  const [salvandoCota, setSalvandoCota] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [secao, setSecao] = useState(null);
  const celular = useCelular();
  const layout = useLayout();
  const fechar = () => setDialogo(null);

  // Muda o interruptor na hora e só desfaz se a API recusar.
  async function alternarVisibilidade(visivel) {
    setPausado(!visivel);
    try {
      await API.pausar(!visivel);
    } catch (e) {
      setPausado(visivel);
      avisar(e.message, 'erro');
      return;
    }
    await atualizarPerfilEmSilencio();
    avisar(visivel ? 'Você está visível para novos matches.' : 'Exposição pausada: você saiu da descoberta. Seus matches continuam.');
  }

  async function alternarObjetivo(id) {
    const atuais = perfil.connection_goals;
    const novos = atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id];
    if (!novos.length) {
      avisar('Mantenha ao menos um objetivo de contato.', 'erro');
      return;
    }
    setSalvandoObjetivos(true);
    try {
      definirPerfil(await API.atualizarPerfil({ connection_goals: novos }));
    } catch (e) {
      avisar(e.message, 'erro');
    } finally {
      setSalvandoObjetivos(false);
    }
  }

  async function alterarCota(delta) {
    const nova = Math.min(5, Math.max(1, perfil.max_weekly_matches + delta));
    if (nova === perfil.max_weekly_matches || salvandoCota) return;
    setSalvandoCota(true);
    try {
      definirPerfil(await API.atualizarPerfil({ max_weekly_matches: nova }));
    } catch (e) {
      avisar(e.message, 'erro');
    } finally {
      setSalvandoCota(false);
    }
  }

  async function excluir() {
    setApagando(true);
    try {
      await API.excluirPerfil();
    } catch (e) {
      avisar(e.message, 'erro');
      setApagando(false);
      return;
    }
    limparPreferencias(perfil.id);
    limparIgnorados(perfil.id);
    sair();
    navegar('/login', { replace: true });
  }

  function sairDaConta() {
    sair();
    navegar('/login', { replace: true });
  }

  const totalConexoes = conexoes.dados
    ? conexoes.dados.confirmadas.length + conexoes.dados.aguardando.length + conexoes.dados.recebidas.length
    : 'n/d';
  const mapeadosPorIA = perfil.tags.technical.some((t) => t.source === 'AI');
  const visivel = !pausado;

  // Seções compartilhadas: no desktop ficam em duas colunas; no celular, cada item do menu abre algumas delas.
  const secaoResumo = (
    <section className="cartao bloco">
      <div className="titulo-secao">
        <h3>
          <IconePerfil className="destaque" /> Resumo Profissional
        </h3>
        <button type="button" className="link-acao" onClick={() => setDialogo('bio')}>
          <IconeEditar /> Editar
        </button>
      </div>
      <p className={perfil.bio ? 'texto-corrido' : 'pequeno'}>
        {perfil.bio || 'Você ainda não escreveu um resumo. Ele aparece só para quem já deu match com você.'}
      </p>
    </section>
  );

  const secaoTecnicas = (
    <section className="cartao bloco">
      <div className="titulo-secao">
        <h3>
          <IconeBrilho className="destaque" /> Interesses Profissionais
        </h3>
        {mapeadosPorIA && <span className="pilula pilula--verde pilula--maiuscula">Mapeados por IA</span>}
      </div>
      <p className="pequeno">Habilidades e tecnologias destacadas para matching técnico e colaboração cruzada.</p>
      <div className="chips">
        {perfil.tags.technical.map((t) => (
          <span key={t.id} className={`chip ${t.source === 'AI' ? 'chip--pessego' : 'chip--azul'}`}>
            {t.name}
          </span>
        ))}
        <button type="button" className="chip chip--mais" onClick={() => setDialogo('tecnicas')}>
          <IconeSomar /> Adicionar skill
        </button>
      </div>
    </section>
  );

  const secaoPessoais = (
    <section className="cartao bloco">
      <div className="titulo-secao">
        <h3>
          <IconeEstrela className="destaque" /> Interesses Pessoais & Hobbies
        </h3>
        <span className="rotulo">Gelo quebrado</span>
      </div>
      <p className="pequeno">Afinidades compartilhadas para puxar assunto no primeiro café virtual.</p>
      <div className="chips">
        {perfil.tags.hobby.map((t) => (
          <span key={t.id} className="chip chip--pessego">
            {t.name}
          </span>
        ))}
        <button type="button" className="chip chip--mais" onClick={() => setDialogo('hobbies')}>
          <IconeSomar /> Adicionar
        </button>
      </div>
      <button type="button" className="link-acao" onClick={() => setDialogo('preview')}>
        Ver como colegas veem meu cartão
      </button>
    </section>
  );

  const secaoParametros = (
    <section className="cartao bloco">
      <div className="titulo-secao">
        <div>
          <h3>
            <IconeAjustes className="destaque" /> Parâmetros do Algoritmo de Match
          </h3>
          <p className="pequeno">Personalize o balanceamento de conexões sugeridas na sua descoberta.</p>
        </div>
        <span title="Guardado neste navegador: reordena e filtra as sugestões da API.">
          <IconeInfo className="texto-suave" />
        </span>
      </div>
      <Equilibrio valor={preferencias.pesoProfissional} aoMudar={(v) => atualizarPreferencias({ pesoProfissional: v })} compacto />

      <div className="parametro">
        <h4>Alcance Geográfico Preferencial</h4>
        <p className="pequeno">Determine a abrangência territorial para as recomendações.</p>
        <Segmentado
          rotulo="Alcance geográfico preferencial"
          opcoes={ALCANCES}
          valor={preferencias.alcance}
          aoMudar={(v) => atualizarPreferencias({ alcance: v })}
        />
      </div>

      <div className="parametro">
        <h4>Polos & Unidades Ativas</h4>
        <Polos polos={preferencias.polos} aoMudar={(polos) => atualizarPreferencias({ polos })} />
      </div>
    </section>
  );

  const secaoObjetivos = (
    <section className="cartao bloco">
      <h3>
        <IconeEstrela className="destaque" /> Objetivos de Contato Padrão
      </h3>
      <p className="pequeno">
        Defina os tipos de convite que você está receptiva(o) a aceitar sem atrito. Aparecem no seu perfil para colegas.
      </p>
      <ul className="objetivos">
        {OBJETIVOS.map(({ id, titulo, descricao, Icone }) => {
          const marcado = perfil.connection_goals.includes(id);
          return (
            <li key={id}>
              <label className={`objetivo${marcado ? ' objetivo--ativo' : ''}`}>
                <input type="checkbox" checked={marcado} disabled={salvandoObjetivos} onChange={() => alternarObjetivo(id)} />
                <span>
                  <strong>
                    {titulo} <Icone className="destaque" />
                  </strong>
                  <span className="pequeno">{descricao}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const interruptorVisivel = (
    <Interruptor
      titulo="Visível para novos matches"
      descricao="Desligado, você some da descoberta. Seus matches e conversas continuam."
      ligado={visivel}
      aoMudar={alternarVisibilidade}
    />
  );

  const interruptorAvisos = (
    <Interruptor
      titulo="Avisos de novos matches no app"
      descricao="Mostra o ponto laranja no sino quando houver solicitações ou matches novos (neste navegador)."
      ligado={preferencias.notificacoes}
      aoMudar={(v) => atualizarPreferencias({ notificacoes: v })}
    />
  );

  const controleCota = (
    <div className="interruptor">
      <span>
        <strong id="cota-perfil">Solicitações por semana</strong>
        <span className="pequeno">De 1 a 5, de segunda a domingo.</span>
      </span>
      <div className="passo" role="group" aria-labelledby="cota-perfil">
        <button
          type="button"
          aria-label="Diminuir"
          onClick={() => alterarCota(-1)}
          disabled={perfil.max_weekly_matches <= 1 || salvandoCota}
        >
          <IconeSubtrair />
        </button>
        <output aria-live="polite">{perfil.max_weekly_matches}</output>
        <button
          type="button"
          aria-label="Aumentar"
          onClick={() => alterarCota(1)}
          disabled={perfil.max_weekly_matches >= 5 || salvandoCota}
        >
          <IconeSomar />
        </button>
      </div>
    </div>
  );

  const botaoSenha = (
    <button type="button" className="interruptor interruptor--botao" onClick={() => setDialogo('senha')}>
      <span>
        <strong>{perfil.has_password ? 'Alterar senha' : 'Definir senha'}</strong>
        <span className="pequeno">
          {perfil.has_password ? 'Você entra com e-mail e senha ou pelo SSO.' : 'Entre com e-mail e senha, sem depender do SSO.'}
        </span>
      </span>
      <IconeCadeado />
    </button>
  );

  const botaoBloqueados = (
    <button type="button" className="interruptor interruptor--botao" onClick={() => setDialogo('bloqueados')}>
      <span>
        <strong>Pessoas bloqueadas</strong>
        <span className="pequeno">Veja e desfaça bloqueios.</span>
      </span>
      <IconeBloquear />
    </button>
  );

  const avisoPrivacidade = (
    <div className="aviso-privacidade">
      <IconeEscudoCheck />
      <div>
        <strong>Privacidade e proteção de dados</strong>
        <p className="pequeno">Cargo e resumo só aparecem depois do match. Cargo e senioridade nunca entram no cálculo.</p>
      </div>
      <button type="button" className="link-acao" onClick={() => setDialogo('diretrizes')}>
        Ler diretrizes
      </button>
    </div>
  );

  const linkExcluir = (
    <button type="button" className="link-acao link-acao--perigo" onClick={() => setDialogo('excluir')}>
      Excluir meus dados definitivamente
    </button>
  );

  const dialogos = (
    <>
      {dialogo === 'dados' && <EditarDados aoFechar={fechar} />}
      {dialogo === 'bio' && <EditarBio aoFechar={fechar} />}
      {dialogo === 'tecnicas' && <EditarInteresses categoria="TECHNICAL" aoFechar={fechar} />}
      {dialogo === 'hobbies' && <EditarInteresses categoria="HOBBY" aoFechar={fechar} />}
      {dialogo === 'preview' && <PreviewPublico aoFechar={fechar} />}
      {dialogo === 'bloqueados' && <Bloqueados aoFechar={fechar} />}
      {dialogo === 'senha' && <DefinirSenha aoFechar={fechar} />}
      {dialogo === 'diretrizes' && (
        <Modal titulo="Diretrizes de privacidade" aoFechar={fechar}>
          <ul className="lista-pontos">
            <li>A API guarda nome, e-mail corporativo, unidade, cidade, interesses, objetivos, resumo e cargo (opcional).</li>
            <li>Cargo e resumo só aparecem para outra pessoa depois do match.</li>
            <li>O hub e os parâmetros do algoritmo ficam só neste navegador.</li>
            <li>Você pode pausar sua exposição, bloquear, denunciar e excluir seus dados a qualquer momento. A exclusão é definitiva.</li>
          </ul>
          <button type="button" className="botao botao--contorno" onClick={fechar}>
            Fechar
          </button>
        </Modal>
      )}
      {dialogo === 'sobre' && (
        <Modal titulo="Sobre o Avanade Global Connect" aoFechar={fechar}>
          <p>
            Plataforma interna para colaboradores da Avanade se conhecerem por interesses profissionais e pessoais. A conexão só acontece
            quando as duas pessoas querem, e cargo ou senioridade nunca entram na escolha.
          </p>
          <button type="button" className="botao botao--contorno" onClick={fechar}>
            Fechar
          </button>
        </Modal>
      )}
      {dialogo === 'excluir' && (
        <Modal titulo="Excluir meus dados?" aoFechar={fechar} ocupado={apagando}>
          <p>Seu perfil, interesses, conexões e mensagens são apagados de forma definitiva. Esta ação não pode ser desfeita.</p>
          <div className="modal__acoes">
            <button type="button" className="botao botao--contorno" onClick={fechar} disabled={apagando}>
              Cancelar
            </button>
            <button type="button" className="botao botao--perigo-forte" disabled={apagando} onClick={excluir}>
              Excluir tudo
            </button>
          </div>
        </Modal>
      )}
    </>
  );

  // Celular: menu em lista; cada item abre uma subtela com as seções correspondentes.
  if (celular) {
    const recebidas = layout.conexoes?.recebidas ?? [];
    const novos = (layout.conexoes?.confirmadas ?? []).filter((c) => c.new);
    const SECOES = {
      conta: {
        titulo: 'Conta',
        conteudo: (
          <>
            {secaoResumo}
            {secaoObjetivos}
            <section className="cartao bloco">
              <p className="pequeno">E-mail corporativo: {perfil.email}</p>
              {linkExcluir}
            </section>
          </>
        ),
      },
      notificacoes: {
        titulo: 'Notificações',
        conteudo: (
          <section className="cartao bloco">
            {interruptorAvisos}
            {!recebidas.length && !novos.length && <p className="pequeno">Nada novo por aqui.</p>}
            {recebidas.length > 0 && (
              <Link to="/matches" className="notificacoes__item">
                <IconeCoracao /> {recebidas.length} {recebidas.length === 1 ? 'pessoa quer' : 'pessoas querem'} se conectar com você
              </Link>
            )}
            {novos.map((c) => (
              <Link key={c.match_id} to={`/match/${c.match_id}`} state={{ pessoaId: c.employee_id }} className="notificacoes__item">
                <Avatar nome={c.name} tamanho={28} /> Novo match com {c.name}
              </Link>
            ))}
          </section>
        ),
      },
      busca: {
        titulo: 'Preferências de Busca',
        conteudo: (
          <>
            {secaoParametros}
            <section className="cartao bloco">{controleCota}</section>
          </>
        ),
      },
      privacidade: {
        titulo: 'Privacidade',
        conteudo: (
          <section className="cartao bloco">
            {interruptorVisivel}
            {botaoSenha}
            {botaoBloqueados}
            {avisoPrivacidade}
          </section>
        ),
      },
      interesses: {
        titulo: 'Interesses',
        conteudo: (
          <>
            {secaoTecnicas}
            {secaoPessoais}
          </>
        ),
      },
    };

    if (secao && SECOES[secao]) {
      return (
        <main className="pagina">
          <Cabecalho titulo={SECOES[secao].titulo} aoVoltar={() => setSecao(null)} />
          {SECOES[secao].conteudo}
          {dialogos}
        </main>
      );
    }

    const ITENS_MENU = [
      { id: 'conta', rotulo: 'Conta', Icone: IconePerfil },
      { id: 'notificacoes', rotulo: 'Notificações', Icone: IconeSino, aviso: recebidas.length + novos.length > 0 },
      { id: 'busca', rotulo: 'Preferências de Busca', Icone: IconeAjustes },
      { id: 'unidade', rotulo: 'Unidade / Cidade', Icone: IconePino, abrir: () => setDialogo('dados') },
      { id: 'privacidade', rotulo: 'Privacidade', Icone: IconeEscudo },
      { id: 'interesses', rotulo: 'Interesses', Icone: IconeEstrela },
      { id: 'sobre', rotulo: 'Sobre o Avanade Global Connect', Icone: IconeInfo, abrir: () => setDialogo('sobre') },
    ];

    return (
      <main className="pagina">
        <Cabecalho
          titulo="Meu Perfil Avanade"
          semVoltar
          acao={
            <button type="button" className="icone-botao" aria-label="Preferências de busca" onClick={() => setSecao('busca')}>
              <IconeEngrenagem />
            </button>
          }
        />
        <section className="cartao bloco perfil-celular">
          <Avatar nome={perfil.name} tamanho={64}>
            <span className="selo-check" role="img" aria-label="Perfil verificado">
              <IconeCheck />
            </span>
          </Avatar>
          <div>
            <h1 className="perfil__nome">{perfil.name}</h1>
            <p className="pequeno">{perfil.position || perfil.department || 'Colaborador Avanade'}</p>
            <button type="button" className="link-acao" onClick={() => setDialogo('dados')}>
              <IconeEditar /> Editar perfil
            </button>
          </div>
        </section>
        <div className="numeros">
          <div className="cartao numero">
            <strong className="destaque">{perfil.connections_count}</strong>
            <span>Matches</span>
          </div>
          <div className="cartao numero">
            <strong className="destaque">{totalConexoes}</strong>
            <span>Conexões</span>
          </div>
          <div className="cartao numero">
            <strong className="destaque">
              {perfil.quota.used}/{perfil.quota.max}
            </strong>
            <span>Pedidos</span>
          </div>
        </div>
        <nav className="menu-perfil" aria-label="Opções do perfil">
          {ITENS_MENU.map(({ id, rotulo, Icone, abrir, aviso }) => (
            <button key={id} type="button" className="cartao menu-perfil__item" onClick={abrir ?? (() => setSecao(id))}>
              <Icone className="destaque" />
              <span>{rotulo}</span>
              {aviso && <span className="ponto ponto--laranja" aria-label="Novidades" />}
              <IconeChevron className="texto-suave" />
            </button>
          ))}
          <button type="button" className="cartao menu-perfil__item menu-perfil__item--perigo" onClick={sairDaConta}>
            <IconeSair />
            <span>Sair da Conta</span>
            <IconeChevron />
          </button>
        </nav>
        {dialogos}
      </main>
    );
  }

  return (
    <main className="pagina">
      <header className="pagina__cabecalho">
        <div>
          <p className="sobretitulo">Governança de conexão & identidade</p>
          <h1>Meu Perfil Corporativo</h1>
          <p className="subtitulo">
            Gerencie suas informações, afinidades mapeadas pela IA e parâmetros de disponibilidade na rede Avanade.
          </p>
        </div>
        <p className="pilula pilula--branca">
          <span className={`ponto ${visivel ? 'ponto--verde' : 'ponto--cinza'}`} aria-hidden="true" />
          {visivel ? 'Visível para novos matches' : 'Exposição pausada'}
          <button type="button" className="link-acao" onClick={() => alternarVisibilidade(!visivel)}>
            Alterar
          </button>
        </p>
      </header>

      <div className="perfil">
        <div className="coluna">
          <section className="cartao bloco perfil__cartao">
            <div className="linha linha--entre linha--topo">
              <Avatar nome={perfil.name} tamanho={84}>
                <span className="selo-check" role="img" aria-label="Perfil verificado">
                  <IconeCheck />
                </span>
              </Avatar>
              <button type="button" className="botao botao--cinza botao--pequeno botao--auto" onClick={() => setDialogo('dados')}>
                <IconeEditar /> Editar perfil
              </button>
            </div>
            <div>
              <h2 className="perfil__nome">
                {perfil.name} <IconeVerificado className="icone-verificado" aria-hidden="true" />
              </h2>
              <p>{[perfil.position, perfil.department].filter(Boolean).join(' • ')}</p>
              {perfil.location && (
                <p className="pequeno meta">
                  <IconePino /> {perfil.location}
                </p>
              )}
            </div>
            <div className="chips">
              {perfil.connection_goals.slice(0, 3).map((g) => (
                <span key={g} className="pilula pilula--cinza pilula--maiuscula">
                  <IconeEstrela /> {nomeDoObjetivo(g)}
                </span>
              ))}
            </div>
          </section>

          <div className="numeros">
            <div className="cartao numero">
              <strong className="destaque">{perfil.connections_count}</strong>
              <span>Matches ativos</span>
            </div>
            <div className="cartao numero">
              <strong>{totalConexoes}</strong>
              <span>Conexões totais</span>
            </div>
            <div className="cartao numero">
              <strong>
                {perfil.quota.used}/{perfil.quota.max}
              </strong>
              <span>Pedidos na semana</span>
            </div>
          </div>

          {secaoResumo}
          {secaoTecnicas}
          {secaoPessoais}
        </div>

        <div className="coluna">
          {secaoParametros}
          {secaoObjetivos}

          <section className="cartao bloco">
            <h3>
              <IconeEscudo className="destaque" /> Governança, Notificações & Privacidade
            </h3>
            <p className="pequeno">Controles de exposição e segurança da sua conta.</p>
            {interruptorVisivel}
            {interruptorAvisos}
            {controleCota}
            {botaoSenha}
            {botaoBloqueados}
            {avisoPrivacidade}
            <div className="sessao">
              <div>
                <strong>Sessão corporativa</strong>
                <p className="pequeno">Encerrar o acesso ativo deste navegador.</p>
              </div>
              <button type="button" className="botao botao--perigo botao--pequeno botao--auto" onClick={sairDaConta}>
                <IconeSair /> Sair da conta
              </button>
            </div>
            {linkExcluir}
          </section>
        </div>
      </div>

      {dialogos}
    </main>
  );
}
