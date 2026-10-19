import { Link, useLocation, useParams } from 'react-router-dom';
import { Avatar, Carregando, Erro } from '../components/Basicos.jsx';
import { IconeBrilho, IconeCalendario, IconeCoracao, IconeMensagem } from '../components/Icones.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { useCelular } from '../hooks/useCelular.js';
import { API } from '../services/api.js';
import { listaEmTexto, porcentagem } from '../utils/formatar.js';

// Comemoração do match. A pessoa vem do estado da navegação ou é descoberta pela lista de conexões.
export default function Match() {
  const { id } = useParams();
  const { state } = useLocation();
  const { perfil } = useAuth();
  const celular = useCelular();

  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    let pessoaId = state?.pessoaId;
    if (!pessoaId) {
      const { confirmadas } = await API.conexoes({ espiar: true });
      pessoaId = confirmadas.find((c) => String(c.match_id) === id)?.employee_id;
    }
    if (!pessoaId) throw new Error('Esta conexão não está disponível.');
    // A sugestão da IA é opcional: se falhar, a tela segue com os interesses em comum.
    const [pessoa, quebraGelo] = await Promise.all([API.pessoa(pessoaId), API.quebraGelo(id).catch(() => null)]);
    return { pessoa, quebraGelo };
  }, [id]);

  if (carregando)
    return (
      <main className="pagina">
        <Carregando texto="Preparando seu match..." />
      </main>
    );
  if (erro)
    return (
      <main className="pagina">
        <Erro erro={erro} aoTentarDeNovo={recarregar} />
        <Link className="botao botao--contorno botao--auto" to="/matches">
          Voltar aos matches
        </Link>
      </main>
    );

  const { pessoa, quebraGelo } = dados;
  const comuns = pessoa.shared_interests.slice(0, 3);

  // Celular: tela cheia laranja, como no layout mobile.
  if (celular) {
    return (
      <main className="match-celular">
        <span className="match-celular__icone" aria-hidden="true">
          <IconeCoracao />
        </span>
        <h1>É um Match!</h1>
        <p>
          Você e <strong>{pessoa.name}</strong> demonstraram interesse mútuo!
        </p>
        <div className="match-celular__avatares" aria-hidden="true">
          <Avatar nome={perfil.name} tamanho={88} />
          <span className="match-celular__wow">WOW</span>
          <Avatar nome={pessoa.name} tamanho={88} />
        </div>
        {comuns.length > 0 && (
          <div className="match-celular__comum">
            <p className="rotulo">Conexão em comum</p>
            <p>{comuns.slice(0, 2).join(' + ')}</p>
          </div>
        )}
        <div className="match-celular__porque">
          <p className="rotulo">Por que houve match?</p>
          <p>
            {quebraGelo?.match_summary ??
              (comuns.length
                ? `Vocês compartilham interesse em ${listaEmTexto(comuns)}. Que tal marcar um Coffee Chat?`
                : 'Vocês demonstraram interesse um no outro. Que tal marcar um Coffee Chat?')}
          </p>
        </div>
        <Link to={`/chat/${id}?cafe=1`} className="botao botao--branco">
          Iniciar Coffee Chat
        </Link>
        <Link to="/descobrir" className="botao botao--contorno-branco">
          Continuar Descobrindo
        </Link>
      </main>
    );
  }

  return (
    <main className="pagina pagina--estreita">
      <section className="cartao celebracao">
        <p className="sobretitulo">
          <IconeBrilho /> Nova conexão recíproca
        </p>
        <div className="destaque-match__avatares" aria-hidden="true">
          <Avatar nome={perfil.name} tamanho={104} />
          <span className="destaque-match__coracao">
            <IconeCoracao />
          </span>
          <Avatar nome={pessoa.name} tamanho={104} />
        </div>
        <h1>É um Match Bilateral!</h1>
        <p>
          Você e <strong>{pessoa.name}</strong> demonstraram interesse mútuo. Afinidade de{' '}
          <strong className="destaque">{porcentagem(pessoa.affinity.score)}</strong>.
        </p>
        {comuns.length > 0 && (
          <div className="chips chips--centro">
            {comuns.map((c) => (
              <span key={c} className="chip chip--azul">
                {c}
              </span>
            ))}
          </div>
        )}
        <div className="celebracao__porque">
          <p className="rotulo">Para começar a conversa</p>
          <p>
            {quebraGelo?.match_summary ??
              (comuns.length ? `Vocês têm em comum ${listaEmTexto(comuns)}.` : 'Vocês demonstraram interesse um no outro.')}
          </p>
        </div>
        <div className="celebracao__acoes">
          <Link to={`/chat/${id}`} className="botao botao--primario">
            <IconeMensagem /> Enviar mensagem
          </Link>
          <Link to={`/chat/${id}?cafe=1`} className="botao botao--suave">
            <IconeCalendario /> Agendar Coffee Chat
          </Link>
          <Link to="/descobrir" className="link-acao link-acao--cinza">
            Continuar descobrindo
          </Link>
        </div>
      </section>
    </main>
  );
}
