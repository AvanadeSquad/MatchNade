import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Avatar, Carregando, Erro } from '../components/Basicos.jsx';
import { IconeCoracao } from '../components/Icones.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';
import { listaEmTexto } from '../utils/formatar.js';

// Tela de comemoração do match. A pessoa vem do estado da navegação ou é descoberta pela lista de conexões.
export default function Match() {
  const { id } = useParams();
  const { state } = useLocation();
  const { perfil } = useAuth();
  const navegar = useNavigate();

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
      <main className="tela">
        <Carregando texto="Preparando seu match..." />
      </main>
    );
  if (erro)
    return (
      <main className="tela">
        <Erro erro={erro} aoTentarDeNovo={recarregar} />
        <Link className="botao botao--contorno" to="/conexoes">
          Voltar
        </Link>
      </main>
    );

  const { pessoa, quebraGelo } = dados;
  const comuns = pessoa.shared_interests.slice(0, 3);

  return (
    <main className="tela tela--centro match">
      <div className="match__icone">
        <IconeCoracao />
      </div>
      <h1>É um match!</h1>
      <p>
        Você e <strong>{pessoa.name}</strong> demonstraram interesse mútuo.
      </p>

      <div className="match__avatares">
        <Avatar nome={perfil.name} tamanho={88} />
        <Avatar nome={pessoa.name} tamanho={88} />
      </div>

      {comuns.length > 0 && (
        <div>
          <p className="rotulo" style={{ color: '#fff' }}>
            Conexão em comum
          </p>
          <p style={{ fontSize: 20, fontWeight: 700 }}>{listaEmTexto(comuns)}</p>
        </div>
      )}

      <section className="match__porque" aria-label="Por que houve match?">
        <p className="rotulo">Por que houve match?</p>
        <p style={{ marginTop: 6 }}>
          {quebraGelo?.match_summary ??
            (comuns.length ? `Vocês têm em comum ${listaEmTexto(comuns)}.` : 'Vocês demonstraram interesse um no outro.')}
        </p>
      </section>

      <button type="button" className="botao botao--primario" onClick={() => navegar(`/chat/${id}`)}>
        Enviar mensagem
      </button>
      <button type="button" className="botao botao--contorno" onClick={() => navegar('/descobrir')}>
        Continuar descobrindo
      </button>
    </main>
  );
}
