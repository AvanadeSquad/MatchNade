import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cabecalho } from '../components/Basicos.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const LIMITE = 1000;

// Texto livre sobre a pessoa. A análise por IA é opcional: há sempre o caminho manual.
export default function Bio() {
  const { perfil } = useAuth();
  const navegar = useNavigate();
  const [bio, setBio] = useState(perfil.bio ?? '');

  return (
    <main className="tela tela--painel">
      <Cabecalho titulo="Sua bio" aoVoltar={() => navegar('/bem-vindo')} />
      <h1>Conte um pouco sobre você</h1>
      <p className="subtitulo">Escreva do seu jeito. A IA sugere seus interesses profissionais e pessoais a partir do texto, e você revisa antes de salvar.</p>

      <label className="campo">
        <span className="so-leitor">Sua bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={LIMITE}
          rows={7}
          placeholder="Conte o que você faz e do que gosta fora do trabalho"
        />
        <p className="campo__ajuda">{bio.length}/{LIMITE} caracteres. Não precisa citar cargo nem tempo de casa.</p>
      </label>

      <button type="button" className="botao botao--primario" disabled={!bio.trim()} onClick={() => navegar('/perfil/analisando', { state: { bio } })}>
        Analisar minha bio
      </button>
      <button type="button" className="botao botao--texto" onClick={() => navegar('/perfil/interesses')}>
        Preencher interesses manualmente
      </button>
    </main>
  );
}
