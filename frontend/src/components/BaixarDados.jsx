import { useState } from 'react';
import { API } from '../services/api.js';

// Entrega à pessoa uma cópia dos próprios dados, como arquivo JSON baixado pelo navegador.
export function baixarArquivoJson(dados, nome) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const endereco = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(endereco);
}

export default function BaixarDados() {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState('');

  async function baixar() {
    setErro('');
    setBaixando(true);
    try {
      baixarArquivoJson(await API.exportarDados(), 'meus-dados-avanade-connect.json');
    } catch (e) {
      setErro(e.status === 429 ? 'Você já baixou seus dados várias vezes. Tente de novo em uma hora.' : e.message);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      <button type="button" className="link-acao" onClick={baixar} disabled={baixando}>
        {baixando ? 'Preparando seus dados...' : 'Baixar meus dados'}
      </button>
      {erro && (
        <p className="erro-campo" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}
