import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Avatar, Cabecalho } from '../components/Basicos.jsx';
import { IconeX } from '../components/Icones.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { unidadeECidade } from '../utils/formatar.js';

function EditorDeTags({ titulo, itens, aoMudar }) {
  const [novo, setNovo] = useState('');

  function adicionar(evento) {
    evento.preventDefault();
    const nome = novo.trim();
    if (!nome || itens.some((i) => i.nome.toLowerCase() === nome.toLowerCase())) return;
    aoMudar([...itens, { nome, fonte: 'MANUAL' }]);
    setNovo('');
  }

  return (
    <section className="cartao">
      <h2 className="bloco__titulo">{titulo}</h2>
      {itens.length > 0 && (
        <ul className="chips lista" style={{ flexDirection: 'row', marginBottom: 12 }}>
          {itens.map((item) => (
            <li key={item.nome} className="chip chip--remover">
              {item.nome}
              <button type="button" aria-label={`Remover ${item.nome}`} onClick={() => aoMudar(itens.filter((i) => i !== item))}>
                <IconeX />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="nova-tag" onSubmit={adicionar}>
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Adicionar"
          aria-label={`Adicionar em ${titulo}`}
          maxLength={40}
        />
        <button type="submit" className="botao botao--suave">
          Adicionar
        </button>
      </form>
    </section>
  );
}

// Revisão das tags sugeridas pela IA, antes de escolher o restante dos interesses.
export default function Revisao() {
  const { perfil, rascunho, setRascunho } = useAuth();
  const navegar = useNavigate();
  if (!rascunho) return <Navigate to="/perfil/bio" replace />;

  const total = rascunho.tecnicas.length + rascunho.hobbies.length;

  return (
    <main className="tela tela--painel">
      <Cabecalho titulo="Revise suas tags" />
      <section className="cartao linha">
        <Avatar nome={perfil.name} tamanho={56} />
        <div>
          <strong>{perfil.name}</strong>
          <p className="pequeno">{unidadeECidade(perfil.department, perfil.location)}</p>
        </div>
      </section>

      <EditorDeTags
        titulo="Interesses profissionais"
        itens={rascunho.tecnicas}
        aoMudar={(tecnicas) => setRascunho({ ...rascunho, tecnicas })}
      />
      <EditorDeTags titulo="Interesses pessoais" itens={rascunho.hobbies} aoMudar={(hobbies) => setRascunho({ ...rascunho, hobbies })} />

      <p className="pequeno">{total} interesses. Na próxima etapa você pode completar e criar tags novas.</p>
      <button type="button" className="botao botao--primario" onClick={() => navegar('/perfil/interesses')}>
        Salvar e continuar
      </button>
    </main>
  );
}
