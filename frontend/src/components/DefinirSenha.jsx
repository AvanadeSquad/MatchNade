import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import { Modal } from './Basicos.jsx';

const MINIMO = 10;

// Diálogo para definir a senha de acesso ou trocá-la. Quem já tem senha informa a atual.
export default function DefinirSenha({ aoFechar }) {
  const { perfil, definirPerfil } = useAuth();
  const avisar = useAviso();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');
    if (nova.length < MINIMO) {
      setErro(`A senha precisa ter pelo menos ${MINIMO} caracteres.`);
      return;
    }
    if (nova !== confirmacao) {
      setErro('A confirmação não é igual à nova senha.');
      return;
    }
    setSalvando(true);
    try {
      await API.definirSenha({ ...(perfil.has_password ? { senha_atual: atual } : {}), nova_senha: nova });
      definirPerfil({ ...perfil, has_password: true });
      avisar(perfil.has_password ? 'Senha alterada.' : 'Senha definida. Agora você pode entrar com e-mail e senha.');
      aoFechar();
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={perfil.has_password ? 'Alterar senha' : 'Definir senha'} aoFechar={aoFechar} ocupado={salvando}>
      <form onSubmit={salvar} className="formulario">
        {!perfil.has_password && (
          <p className="pequeno">
            Com uma senha você entra com o e-mail corporativo, sem depender do SSO. Use uma frase longa: quanto maior, mais segura.
          </p>
        )}
        {perfil.has_password && (
          <label className="campo">
            <span>Senha atual</span>
            <input
              className="campo__controle"
              type="password"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        )}
        <label className="campo">
          <span>Nova senha</span>
          <input
            className="campo__controle"
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            autoComplete="new-password"
            minLength={MINIMO}
            maxLength={128}
            required
          />
          <span className="campo__dica">De {MINIMO} a 128 caracteres.</span>
        </label>
        <label className="campo">
          <span>Confirmar nova senha</span>
          <input
            className="campo__controle"
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {erro && (
          <p className="erro-campo" role="alert">
            {erro}
          </p>
        )}
        <div className="modal__acoes">
          <button type="button" className="botao botao--contorno" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar senha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
