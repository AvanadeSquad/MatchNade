import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { IconeCheck, IconeChip } from '../components/Icones.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../services/api.js';

const ETAPAS = ['Lendo a bio', 'Identificando skills e tecnologias', 'Identificando hobbies'];
const INTERVALO_MS = 900;

// Salva a bio, pede a análise à API e mostra o andamento. Em falha, oferece o caminho manual.
export default function Analisando() {
  const { state } = useLocation();
  const navegar = useNavigate();
  const { setRascunho, recarregarPerfil } = useAuth();
  const [etapa, setEtapa] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const promessas = useRef(new Map());

  const bio = state?.bio;

  // Uma análise por tentativa: o Map evita repetir a chamada quando o efeito roda duas vezes em desenvolvimento.
  useEffect(() => {
    if (!bio) return undefined;
    let ativo = true;
    if (!promessas.current.has(tentativa)) {
      promessas.current.set(
        tentativa,
        API.atualizarPerfil({ bio })
          .then(() => recarregarPerfil())
          .then(() => API.analisarBio(bio)),
      );
    }
    promessas.current
      .get(tentativa)
      .then((dados) => ativo && setResultado(dados))
      .catch(() => ativo && setFalhou(true));
    return () => {
      ativo = false;
    };
  }, [bio, tentativa, recarregarPerfil]);

  // Avança as etapas enquanto aguarda, sem concluir a última antes da resposta.
  useEffect(() => {
    if (resultado || falhou) return undefined;
    const relogio = setInterval(() => setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1)), INTERVALO_MS);
    return () => clearInterval(relogio);
  }, [resultado, falhou, tentativa]);

  useEffect(() => {
    if (!resultado) return undefined;
    if (resultado.fallback || resultado.technical_tags.length + resultado.hobby_tags.length === 0) {
      setFalhou(true);
      return undefined;
    }
    setEtapa(ETAPAS.length);
    setRascunho({
      tecnicas: resultado.technical_tags.map((nome) => ({ nome, fonte: 'AI' })),
      hobbies: resultado.hobby_tags.map((nome) => ({ nome, fonte: 'AI' })),
    });
    const espera = setTimeout(() => navegar('/perfil/revisao', { replace: true }), 600);
    return () => clearTimeout(espera);
  }, [resultado, navegar, setRascunho]);

  if (!bio) return <Navigate to="/perfil/bio" replace />;

  function tentarDeNovo() {
    setFalhou(false);
    setResultado(null);
    setEtapa(0);
    setTentativa((t) => t + 1);
  }

  if (falhou) {
    return (
      <main className="tela tela--centro" role="alert">
        <h1>Não conseguimos analisar agora</h1>
        <p className="subtitulo">Sem problema: você escolhe seus interesses manualmente em poucos cliques.</p>
        <button type="button" className="botao botao--primario" onClick={() => navegar('/perfil/interesses', { replace: true })}>
          Preencher manualmente
        </button>
        <button type="button" className="botao botao--texto" onClick={tentarDeNovo}>
          Tentar de novo
        </button>
      </main>
    );
  }

  return (
    <main className="tela tela--centro">
      <div className="progresso" style={{ '--graus': `${Math.round(((etapa + 1) / (ETAPAS.length + 1)) * 100)}%` }}>
        <IconeChip />
      </div>
      <h1>Identificando seu perfil</h1>
      <p className="subtitulo">Estamos lendo sua bio para sugerir interesses profissionais e pessoais.</p>
      <ol className="etapas" aria-live="polite">
        {ETAPAS.map((texto, i) => {
          const estado = i < etapa ? 'feita' : i === etapa ? 'atual' : 'espera';
          return (
            <li key={texto} className={`etapa etapa--${estado}`}>
              <span className="etapa__marca">{estado === 'feita' ? <IconeCheck /> : <span className="etapa__ponto" />}</span>
              {texto}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
