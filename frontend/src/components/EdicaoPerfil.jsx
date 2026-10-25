import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';
import { AREAS } from '../utils/preferencias.js';
import { Avatar, Carregando, Erro, Modal } from './Basicos.jsx';
import { IconePino } from './Icones.jsx';
import SeletorTags from './SeletorTags.jsx';

const LIMITE_BIO = 1000;

function MensagemDeErro({ erro }) {
  if (!erro) return null;
  return (
    <p className="erro-campo" role="alert">
      {erro}
    </p>
  );
}

// Resumo profissional (bio). Só aparece para outra pessoa depois do match.
export function EditarBio({ aoFechar }) {
  const { perfil, definirPerfil } = useAuth();
  const avisar = useAviso();
  const [bio, setBio] = useState(perfil.bio ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setSalvando(true);
    try {
      definirPerfil(await API.atualizarPerfil({ bio }));
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    avisar('Resumo profissional salvo.');
    aoFechar();
  }

  return (
    <Modal titulo="Resumo profissional" aoFechar={aoFechar} ocupado={salvando}>
      <form className="formulario" onSubmit={enviar}>
        <label className="campo">
          <span>Conte o que você faz e o que gosta de discutir</span>
          <textarea className="campo__controle" value={bio} onChange={(e) => setBio(e.target.value)} rows={6} maxLength={LIMITE_BIO} />
          <span className="campo__ajuda">
            {bio.length}/{LIMITE_BIO}. Só aparece para quem já deu match com você. Não precisa citar cargo nem tempo de casa.
          </span>
        </label>
        <MensagemDeErro erro={erro} />
        <div className="modal__acoes">
          <button type="button" className="botao botao--contorno" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Nome, unidade, cidade e cargo (opcional, só visível depois do match).
export function EditarDados({ aoFechar }) {
  const { perfil, definirPerfil } = useAuth();
  const avisar = useAviso();
  const [dados, setDados] = useState({
    name: perfil.name,
    department: perfil.department ?? '',
    location: perfil.location ?? '',
    position: perfil.position ?? '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const campo = (nome) => ({ value: dados[nome], onChange: (e) => setDados({ ...dados, [nome]: e.target.value }) });

  async function enviar(evento) {
    evento.preventDefault();
    setSalvando(true);
    try {
      definirPerfil(await API.atualizarPerfil(dados));
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    avisar('Perfil atualizado.');
    aoFechar();
  }

  return (
    <Modal titulo="Editar perfil" aoFechar={aoFechar} ocupado={salvando}>
      <form className="formulario" onSubmit={enviar}>
        <label className="campo">
          <span>Nome completo</span>
          <input className="campo__controle" {...campo('name')} required minLength={2} maxLength={120} />
        </label>
        <label className="campo">
          <span>Unidade de negócio / prática</span>
          <input className="campo__controle" {...campo('department')} list="areas-edicao" required maxLength={80} />
          <datalist id="areas-edicao">
            {AREAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="campo">
          <span>Cidade</span>
          <input className="campo__controle" {...campo('location')} required maxLength={80} />
        </label>
        <label className="campo">
          <span>Cargo (opcional)</span>
          <input className="campo__controle" {...campo('position')} maxLength={80} />
          <span className="campo__ajuda">Só aparece para quem já deu match com você, nunca na descoberta.</span>
        </label>
        <MensagemDeErro erro={erro} />
        <div className="modal__acoes">
          <button type="button" className="botao botao--contorno" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Interesses de uma categoria. Ao salvar, envia a lista completa (as duas categorias), como a API exige.
export function EditarInteresses({ categoria, aoFechar }) {
  const { perfil, definirPerfil } = useAuth();
  const avisar = useAviso();
  const catalogo = useCarregar(() => API.tags(categoria), [categoria]);
  const [selecionadas, setSelecionadas] = useState(
    () =>
      new Map(
        [
          ...perfil.tags.technical.map((t) => ({ nome: t.name, fonte: t.source, categoria: 'TECHNICAL' })),
          ...perfil.tags.hobby.map((t) => ({ nome: t.name, fonte: t.source, categoria: 'HOBBY' })),
        ].map((t) => [t.nome.toLowerCase(), t]),
      ),
  );
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const alternar = (nome, cat) =>
    setSelecionadas((atual) => {
      const copia = new Map(atual);
      if (copia.has(nome.toLowerCase())) copia.delete(nome.toLowerCase());
      else copia.set(nome.toLowerCase(), { nome, categoria: cat, fonte: 'MANUAL' });
      return copia;
    });

  async function criar(nome, cat) {
    const tag = await API.criarTag(nome, cat);
    setSelecionadas((atual) => new Map(atual).set(tag.name.toLowerCase(), { nome: tag.name, categoria: tag.category, fonte: 'MANUAL' }));
  }

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      const interests = [...selecionadas.values()].map((t) => ({
        name: t.nome,
        category: t.categoria,
        source: t.fonte === 'AI' ? 'AI' : 'MANUAL',
      }));
      definirPerfil(await API.salvarInteresses(interests));
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    avisar('Interesses salvos.');
    aoFechar();
  }

  const titulo = categoria === 'TECHNICAL' ? 'Interesses profissionais' : 'Interesses pessoais & hobbies';
  return (
    <Modal titulo={titulo} aoFechar={aoFechar} ocupado={salvando}>
      {catalogo.carregando && <Carregando />}
      {catalogo.erro && <Erro erro={catalogo.erro} aoTentarDeNovo={catalogo.recarregar} />}
      {catalogo.dados && (
        <SeletorTags
          categoria={categoria}
          catalogo={catalogo.dados.tags.map((t) => t.name)}
          uso={new Map(catalogo.dados.tags.map((t) => [t.name.toLowerCase(), t.uso ?? 0]))}
          selecionadas={selecionadas}
          aoAlternar={alternar}
          aoCriar={criar}
          tom={categoria === 'HOBBY' ? 'pessego' : 'laranja'}
        />
      )}
      <p className="pequeno">No total, escolha ao menos 3 interesses somando os dois tipos.</p>
      <MensagemDeErro erro={erro} />
      <div className="modal__acoes">
        <button type="button" className="botao botao--contorno" onClick={aoFechar} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="botao botao--primario" onClick={salvar} disabled={salvando || selecionadas.size < 3}>
          Salvar
        </button>
      </div>
    </Modal>
  );
}

// Como outra pessoa vê o seu cartão na descoberta: sem cargo e sem bio.
export function PreviewPublico({ aoFechar }) {
  const { perfil } = useAuth();
  return (
    <Modal titulo="Preview público do seu cartão" aoFechar={aoFechar}>
      <div className="preview">
        <div className="linha">
          <Avatar nome={perfil.name} tamanho={56} quadrado />
          <div>
            <strong>{perfil.name}</strong>
            <p className="pequeno">{perfil.department}</p>
            {perfil.location && (
              <p className="pequeno meta">
                <IconePino /> {perfil.location}
              </p>
            )}
          </div>
        </div>
        <div className="chips">
          {[...perfil.tags.technical, ...perfil.tags.hobby].map((t) => (
            <span key={t.id} className="chip">
              {t.name}
            </span>
          ))}
        </div>
      </div>
      <p className="pequeno">Cargo e resumo profissional só aparecem para quem já deu match com você.</p>
      <button type="button" className="botao botao--contorno" onClick={aoFechar}>
        Fechar
      </button>
    </Modal>
  );
}

// Percentual de preenchimento do perfil, a partir dos campos que pesam nas sugestões.
export function preenchimento(perfil) {
  const itens = [
    Boolean(perfil.name),
    Boolean(perfil.department),
    Boolean(perfil.location),
    Boolean(perfil.bio),
    perfil.tags.technical.length + perfil.tags.hobby.length >= 3,
    perfil.tags.technical.length > 0 && perfil.tags.hobby.length > 0,
    perfil.connection_goals.length > 0,
  ];
  return Math.round((itens.filter(Boolean).length / itens.length) * 100);
}
