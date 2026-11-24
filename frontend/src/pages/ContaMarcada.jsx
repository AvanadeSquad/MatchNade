import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Basicos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import { dataPorExtenso } from '../utils/formatar.js';
import { limparIgnorados } from '../utils/ignorados.js';
import { limparPreferencias } from '../utils/preferencias.js';

// Tela única de uma conta marcada para exclusão: a pessoa só pode cancelar, apagar agora ou sair.
// O resto do app fica fechado, e a API responde 403 CONTA_EM_EXCLUSAO para qualquer outra rota.
export default function ContaMarcada() {
  const { perfil, definirPerfil, sair } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState('');
  const quando = dataPorExtenso(perfil.deletion.scheduled_for);

  async function cancelar() {
    setErro('');
    setOcupado(true);
    try {
      definirPerfil(await API.cancelarExclusao());
      avisar('Exclusão cancelada. Sua conta voltou ao normal.');
      navegar('/descobrir', { replace: true });
    } catch (e) {
      setErro(e.message);
      setOcupado(false);
    }
  }

  async function apagarAgora() {
    setErro('');
    setOcupado(true);
    try {
      await API.excluirPerfil();
    } catch (e) {
      setErro(e.message);
      setOcupado(false);
      setConfirmando(false);
      return;
    }
    limparPreferencias(perfil.id);
    limparIgnorados(perfil.id);
    sair();
    navegar('/login', { replace: true });
  }

  return (
    <main className="tela-centro">
      <section className="cartao conta-marcada">
        <p className="sobretitulo">Exclusão de conta</p>
        <h1>Sua conta está marcada para exclusão</h1>
        <p>
          Ela fica oculta para as outras pessoas e será apagada de forma definitiva em <strong>{quando}</strong>, com perfil, interesses,
          conexões e mensagens. Até lá você pode cancelar e voltar a usar o app normalmente.
        </p>
        {erro && (
          <p className="erro-campo" role="alert">
            {erro}
          </p>
        )}
        <div className="conta-marcada__acoes">
          <button type="button" className="botao botao--primario" onClick={cancelar} disabled={ocupado}>
            Cancelar a exclusão
          </button>
          <button type="button" className="botao botao--perigo-forte" onClick={() => setConfirmando(true)} disabled={ocupado}>
            Excluir agora
          </button>
          <button type="button" className="botao botao--texto botao--auto" onClick={sair} disabled={ocupado}>
            Sair da conta
          </button>
        </div>
      </section>
      {confirmando && (
        <Modal titulo="Excluir agora?" aoFechar={() => setConfirmando(false)} ocupado={ocupado}>
          <p>Tudo é apagado já, de forma definitiva. Esta ação não pode ser desfeita nem cancelada.</p>
          <div className="modal__acoes">
            <button type="button" className="botao botao--contorno" onClick={() => setConfirmando(false)} disabled={ocupado}>
              Voltar
            </button>
            <button type="button" className="botao botao--perigo-forte" onClick={apagarAgora} disabled={ocupado}>
              Excluir tudo agora
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
