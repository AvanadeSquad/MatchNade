import { useState } from 'react';
import { API } from '../services/api.js';
import { Modal } from './Basicos.jsx';

export const PRAZO_EXCLUSAO_DIAS = 30;

// Pedido de exclusão da conta: oculta a pessoa por 30 dias e só então apaga. Para confirmar, a pessoa digita
// o e-mail da própria conta (serve a quem entra pela Microsoft e não tem senha). `aoConcluir` recebe a data prevista.
export default function ExcluirConta({ email, aoFechar, aoConcluir }) {
  const [digitado, setDigitado] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const confere = digitado.trim().toLowerCase() === email.toLowerCase();

  async function enviar(evento) {
    evento.preventDefault();
    if (!confere || enviando) return;
    setErro('');
    setEnviando(true);
    try {
      const resposta = await API.solicitarExclusao(digitado.trim());
      aoConcluir(resposta.scheduled_for);
    } catch (e) {
      setErro(e.message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Excluir minha conta?" aoFechar={aoFechar} ocupado={enviando}>
      <form className="formulario" onSubmit={enviar}>
        <p>
          Sua conta fica oculta e é apagada de forma definitiva em {PRAZO_EXCLUSAO_DIAS} dias, com perfil, interesses, conexões e mensagens.
          Se você entrar de novo nesse prazo, pode cancelar a exclusão.
        </p>
        <label className="campo">
          <span>Para confirmar, digite o e-mail da sua conta</span>
          <input
            className="campo__controle"
            type="email"
            autoComplete="off"
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            placeholder={email}
            aria-describedby={erro ? 'erro-exclusao' : undefined}
          />
        </label>
        {erro && (
          <p id="erro-exclusao" className="erro-campo" role="alert">
            {erro}
          </p>
        )}
        <div className="modal__acoes">
          <button type="button" className="botao botao--contorno" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="botao botao--perigo-forte" disabled={!confere || enviando}>
            Excluir minha conta
          </button>
        </div>
      </form>
    </Modal>
  );
}
