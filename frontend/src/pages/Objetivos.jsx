import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Cabecalho } from '../components/Basicos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import { OBJETIVOS } from '../utils/objetivos.js';

// Seleção múltipla dos objetivos de conexão. Último passo do cadastro.
export default function Objetivos() {
  const { perfil, atualizarPerfilEmSilencio } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const editando = params.get('de') === 'eu';
  const [escolhidos, setEscolhidos] = useState(perfil.connection_goals ?? []);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const alternar = (id) => setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  async function continuar() {
    setErro('');
    setSalvando(true);
    try {
      await API.atualizarPerfil({ connection_goals: escolhidos });
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    await atualizarPerfilEmSilencio();
    avisar(editando ? 'Objetivos salvos.' : 'Tudo pronto! Veja quem tem a ver com você.');
    navegar(editando ? '/eu' : '/descobrir', { replace: true });
  }

  return (
    <main className="tela tela--painel">
      <Cabecalho titulo="Objetivos" />
      <h1>O que você quer construir aqui?</h1>
      <p className="subtitulo">Escolha um ou mais objetivos. Eles ajudam a pessoa certa a entender por que você quer conversar.</p>

      <div className="lista" role="group" aria-label="Objetivos de conexão">
        {OBJETIVOS.map(({ id, titulo, descricao, Icone }) => (
          <button key={id} type="button" className="opcao" aria-pressed={escolhidos.includes(id)} onClick={() => alternar(id)}>
            <span className="opcao__icone"><Icone /></span>
            <span>
              <strong>{titulo}</strong>
              <span className="pequeno">{descricao}</span>
            </span>
          </button>
        ))}
      </div>

      {erro && <p className="erro-campo" role="alert">{erro}</p>}
      <button type="button" className="botao botao--primario" disabled={!escolhidos.length || salvando} onClick={continuar}>Continuar</button>
    </main>
  );
}
