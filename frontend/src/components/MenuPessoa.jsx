import { useEffect, useRef, useState } from 'react';
import { useAviso } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import { Modal } from './Basicos.jsx';
import { IconeBandeira, IconeBloquear, IconeMais } from './Icones.jsx';

// Menu "..." com as ações de bloquear e denunciar uma pessoa. `aoBloquear` roda depois de bloquear.
export default function MenuPessoa({ pessoaId, nome, aoBloquear }) {
  const avisar = useAviso();
  const [aberto, setAberto] = useState(false);
  const [dialogo, setDialogo] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const raiz = useRef(null);
  const botao = useRef(null);

  // Com o menu aberto, Esc fecha e devolve o foco ao botão; clicar fora também fecha.
  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    };
    const aoClicarFora = (e) => !raiz.current?.contains(e.target) && setAberto(false);
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('mousedown', aoClicarFora);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('mousedown', aoClicarFora);
    };
  }, [aberto]);

  // Ao fechar o diálogo, o foco volta ao botão do menu: o item que o abriu já não existe mais na tela.
  const fechar = () => {
    setDialogo(null);
    setMotivo('');
    setErro('');
    requestAnimationFrame(() => botao.current?.focus());
  };

  const abrirDialogo = (tipo) => {
    setAberto(false);
    setDialogo(tipo);
  };

  async function confirmarBloqueio() {
    setEnviando(true);
    try {
      await API.bloquear(pessoaId);
      fechar();
      avisar(`Pessoa bloqueada: ${nome}.`);
      aoBloquear?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarDenuncia(evento) {
    evento.preventDefault();
    if (!motivo.trim()) {
      setErro('Informe o motivo.');
      return;
    }
    setEnviando(true);
    try {
      await API.denunciar(pessoaId, motivo.trim());
      fechar();
      avisar('Denúncia enviada. Agradecemos o aviso.');
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="menu" ref={raiz}>
        <button type="button" ref={botao} className="icone-botao" aria-label="Mais opções" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          <IconeMais />
        </button>
        {aberto && (
          <div className="menu__lista" role="menu">
            <button type="button" role="menuitem" onClick={() => abrirDialogo('bloquear')}>
              <IconeBloquear /> Bloquear
            </button>
            <button type="button" role="menuitem" onClick={() => abrirDialogo('denunciar')}>
              <IconeBandeira /> Denunciar
            </button>
          </div>
        )}
      </div>

      {dialogo === 'bloquear' && (
        <Modal titulo={`Bloquear ${nome}?`} aoFechar={fechar} ocupado={enviando}>
          <p>Vocês deixam de se ver na descoberta e a conversa é encerrada. Você pode desbloquear depois, em Perfil.</p>
          {erro && <p className="erro-campo" role="alert">{erro}</p>}
          <div className="modal__acoes">
            <button type="button" className="botao botao--contorno" onClick={fechar} disabled={enviando}>Cancelar</button>
            <button type="button" className="botao botao--perigo" disabled={enviando} onClick={confirmarBloqueio}>Bloquear</button>
          </div>
        </Modal>
      )}

      {dialogo === 'denunciar' && (
        <Modal titulo={`Denunciar ${nome}`} aoFechar={fechar} ocupado={enviando}>
          <form onSubmit={enviarDenuncia}>
            <label className="campo">
              <span>O que aconteceu?</span>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={4} placeholder="Descreva o motivo da denúncia" />
            </label>
            {erro && <p className="erro-campo" role="alert">{erro}</p>}
            <div className="modal__acoes">
              <button type="button" className="botao botao--contorno" onClick={fechar} disabled={enviando}>Cancelar</button>
              <button type="submit" className="botao botao--primario" disabled={enviando}>Enviar denúncia</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
