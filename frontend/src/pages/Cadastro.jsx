import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../services/api.js';

// Primeiro passo do cadastro: confirma nome, unidade e cidade. O e-mail vem do login e não muda.
export default function Cadastro() {
  const { perfil, recarregarPerfil, sair } = useAuth();
  const navegar = useNavigate();
  const [nome, setNome] = useState(perfil.name ?? '');
  const [unidade, setUnidade] = useState(perfil.department ?? '');
  const [cidade, setCidade] = useState(perfil.location ?? '');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await API.atualizarPerfil({ name: nome, department: unidade, location: cidade });
      await recarregarPerfil();
      navegar('/perfil/bio');
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  function sairDaConta() {
    sair();
    navegar('/login', { replace: true });
  }

  return (
    <main className="tela tela--painel">
      <h1>Conecte-se à rede Avanade</h1>
      <p className="subtitulo">Só pedimos o que a conexão precisa: nome, unidade e cidade.</p>

      <form className="formulario" onSubmit={enviar}>
        <label className="campo">
          <span>Nome completo</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ana Silva" required minLength={2} maxLength={120} autoComplete="name" />
        </label>
        <label className="campo">
          <span>E-mail corporativo</span>
          <input value={perfil.email} readOnly />
        </label>
        <label className="campo">
          <span>Unidade</span>
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex.: Experience Design" required maxLength={80} />
        </label>
        <label className="campo">
          <span>Cidade</span>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: São Paulo" required maxLength={80} autoComplete="address-level2" />
        </label>
        <label className="marcar">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} required />
          <span>Li e concordo com os termos de uso e a política de privacidade do Avanade Connect.</span>
        </label>
        {erro && <p className="erro-campo" role="alert">{erro}</p>}
        <button type="submit" className="botao botao--primario" disabled={salvando || !aceite}>Conectar-se</button>
      </form>
      <button type="button" className="botao botao--texto" onClick={sairDaConta}>Entrei com a conta errada: sair</button>
    </main>
  );
}
