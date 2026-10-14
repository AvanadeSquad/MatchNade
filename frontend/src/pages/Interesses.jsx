import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Cabecalho, ChipEscolha, Carregando, Erro, plural } from '../components/Basicos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';

const MINIMO = 3;

// Valor inicial da seleção: o rascunho da revisão ou os interesses já salvos no perfil.
function selecaoInicial(rascunho, perfil) {
  const origem = rascunho
    ? [...rascunho.tecnicas.map((t) => ({ ...t, categoria: 'TECHNICAL' })), ...rascunho.hobbies.map((t) => ({ ...t, categoria: 'HOBBY' }))]
    : [
        ...perfil.tags.technical.map((t) => ({ nome: t.name, fonte: t.source, categoria: 'TECHNICAL' })),
        ...perfil.tags.hobby.map((t) => ({ nome: t.name, fonte: t.source, categoria: 'HOBBY' })),
      ];
  return new Map(origem.map((t) => [t.nome.toLowerCase(), t]));
}

export default function Interesses() {
  const { perfil, rascunho, setRascunho, definirPerfil } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const editando = params.get('de') === 'eu';

  const catalogo = useCarregar(() => API.tags(), []);
  const [selecionadas, setSelecionadas] = useState(() => selecaoInicial(rascunho, perfil));
  const [extras, setExtras] = useState([]);
  const [novo, setNovo] = useState({ nome: '', categoria: 'TECHNICAL' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Tags selecionadas que não existem no catálogo (vindas da análise ou recém-criadas) aparecem como opções.
  useEffect(() => {
    if (!catalogo.dados) return;
    const conhecidas = new Set(catalogo.dados.tags.map((t) => t.name.toLowerCase()));
    setExtras([...selecionadas.values()].filter((t) => !conhecidas.has(t.nome.toLowerCase())));
  }, [catalogo.dados]);

  const alternar = (nome, categoria) =>
    setSelecionadas((atual) => {
      const copia = new Map(atual);
      const chave = nome.toLowerCase();
      if (copia.has(chave)) copia.delete(chave);
      else copia.set(chave, { nome, categoria, fonte: 'MANUAL' });
      return copia;
    });

  async function criarTag(evento) {
    evento.preventDefault();
    setErro('');
    try {
      const tag = await API.criarTag(novo.nome, novo.categoria);
      const item = { nome: tag.name, categoria: tag.category, fonte: 'MANUAL' };
      setExtras((e) => (e.some((x) => x.nome.toLowerCase() === tag.name.toLowerCase()) ? e : [...e, item]));
      setSelecionadas((atual) => new Map(atual).set(tag.name.toLowerCase(), item));
      setNovo({ ...novo, nome: '' });
    } catch (e) {
      setErro(e.message);
    }
  }

  async function salvar() {
    setErro('');
    setSalvando(true);
    let atualizado;
    try {
      const interests = [...selecionadas.values()].map((t) => ({ name: t.nome, category: t.categoria, source: t.fonte === 'AI' ? 'AI' : 'MANUAL' }));
      atualizado = await API.salvarInteresses(interests);
      definirPerfil(atualizado);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    setRascunho(null);
    avisar('Interesses salvos.');
    navegar(editando || atualizado?.connection_goals.length ? '/eu' : '/perfil/objetivos');
  }

  if (catalogo.carregando) return <main className="tela"><Carregando /></main>;
  if (catalogo.erro) return <main className="tela"><Erro erro={catalogo.erro} aoTentarDeNovo={catalogo.recarregar} /></main>;

  const grupos = [
    { titulo: 'Interesses profissionais', categoria: 'TECHNICAL' },
    { titulo: 'Interesses pessoais', categoria: 'HOBBY' },
  ];
  const faltam = Math.max(0, MINIMO - selecionadas.size);

  return (
    <main className="tela tela--painel">
      <Cabecalho titulo="Seus interesses" acao={<button type="button" className="botao botao--texto botao--auto" onClick={() => setSelecionadas(new Map())}>Limpar</button>} />

      {grupos.map(({ titulo, categoria }) => {
        const doCatalogo = catalogo.dados.tags.filter((t) => t.category === categoria).map((t) => t.name);
        const novas = extras.filter((t) => t.categoria === categoria).map((t) => t.nome);
        return (
          <section key={categoria} aria-label={titulo} className="cartao">
            <h2 className="bloco__titulo">{titulo}</h2>
            <div className="chips">
              {[...doCatalogo, ...novas.filter((n) => !doCatalogo.includes(n))].map((nome) => (
                <ChipEscolha key={nome} selecionado={selecionadas.has(nome.toLowerCase())} aoAlternar={() => alternar(nome, categoria)}>
                  {nome}
                </ChipEscolha>
              ))}
            </div>
          </section>
        );
      })}

      <form className="cartao" onSubmit={criarTag}>
        <h2 className="bloco__titulo">+ Criar tag</h2>
        <div className="nova-tag">
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Jardinagem" aria-label="Nome da nova tag" maxLength={40} required />
          <select value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })} aria-label="Tipo da nova tag">
            <option value="TECHNICAL">Profissional</option>
            <option value="HOBBY">Pessoal</option>
          </select>
          <button type="submit" className="botao botao--suave">Criar</button>
        </div>
      </form>

      {erro && <p className="erro-campo" role="alert">{erro}</p>}

      <div className="rodape-fixo">
        <p className="contador" aria-live="polite">
          <span>{plural(selecionadas.size, 'selecionado', 'selecionados')}</span>
          {faltam > 0 && <span className="pequeno">Escolha mais {faltam}</span>}
        </p>
        <button type="button" className="botao botao--primario" disabled={selecionadas.size < MINIMO || salvando} onClick={salvar} style={{ marginTop: 8 }}>
          Salvar interesses
        </button>
      </div>
    </main>
  );
}
