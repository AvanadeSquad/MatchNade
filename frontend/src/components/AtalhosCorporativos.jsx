import { useEffect, useState } from 'react';
import { API } from '../services/api.js';
import { DURACAO_CAFE_MINUTOS, dataDoCafe } from '../utils/cafe.js';
import { IconeBaixar, IconeCalendario, IconeMensagem } from './Icones.jsx';

// Abre a conversa com a pessoa no Teams. O link vem pronto da API e só existe depois do match;
// se a API recusar ou falhar, o atalho simplesmente não aparece.
export function LinkTeams({ conexaoId, className = 'botao botao--contorno botao--pequeno botao--auto', somenteIconeNoCelular = false }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let ativo = true;
    setUrl(null);
    API.contato(conexaoId)
      .then((r) => ativo && setUrl(r.teams_url))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [conexaoId]);

  if (!url) return null;
  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir no Teams" title="Abrir no Teams">
      <IconeMensagem /> <span className={somenteIconeNoCelular ? 'so-desktop' : undefined}>Abrir no Teams</span>
    </a>
  );
}

function baixarArquivo(nome, texto) {
  const endereco = URL.createObjectURL(new Blob([texto], { type: 'text/calendar;charset=utf-8' }));
  const ancora = document.createElement('a');
  ancora.href = endereco;
  ancora.download = nome;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  URL.revokeObjectURL(endereco);
}

// Convite do Coffee Chat já combinado: abre o Outlook preenchido ou baixa o arquivo .ics.
export function AtalhosOutlook({ conexaoId, quando }) {
  const [convite, setConvite] = useState(null);

  useEffect(() => {
    let ativo = true;
    setConvite(null);
    const inicio = dataDoCafe(quando);
    if (!inicio) return undefined;
    API.convite(conexaoId, inicio.toISOString(), DURACAO_CAFE_MINUTOS)
      .then((r) => ativo && setConvite(r))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [conexaoId, quando]);

  if (!convite) return null;
  return (
    <span className="convite__atalhos">
      <a className="botao botao--contorno botao--pequeno botao--auto" href={convite.outlook_url} target="_blank" rel="noopener noreferrer">
        <IconeCalendario /> Adicionar ao Outlook
      </a>
      <button
        type="button"
        className="botao botao--contorno botao--pequeno botao--auto"
        onClick={() => baixarArquivo(convite.ics_filename, convite.ics)}
      >
        <IconeBaixar /> Baixar .ics
      </button>
    </span>
  );
}
