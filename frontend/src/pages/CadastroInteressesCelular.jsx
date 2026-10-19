import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Cabecalho } from '../components/Basicos.jsx';
import { EditarBio, EditarDados } from '../components/EdicaoPerfil.jsx';
import {
  IconeCheckCirculo,
  IconeChip,
  IconeDocumento,
  IconeEditar,
  IconePerfil,
  IconePino,
  IconePredio,
  IconeVoltar,
} from '../components/Icones.jsx';
import SeletorTags from '../components/SeletorTags.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { usePreferencias } from '../hooks/usePreferencias.js';
import { LIMITE_BIO, analisarComIA, lerArquivoDeTexto } from '../utils/importacao.js';

// Textos e ícones dos propósitos na versão de celular.
const PROPOSITOS_CELULAR = {
  COLEGAS: { descricao: 'Encontre pessoas com interesses, projetos e experiências similares.', Icone: IconePerfil },
  OPORTUNIDADES: { descricao: 'Descubra oportunidades de colaboração, mentorias e novos projetos.', Icone: IconePredio },
};
const TITULOS = { COLEGAS: 'Conectar com colegas', OPORTUNIDADES: 'Encontrar oportunidades' };

const ETAPAS_IA = [
  'Leitura do perfil',
  'Identificando interesses pessoais',
  'Identificando skills e tecnologias',
  'Mapeando objetivos de aprendizado',
];
const INTERVALO_IA_MS = 900;

// Etapa 2 do cadastro no celular, dividida em telas: objetivo, importação, análise da IA, interesses e revisão do perfil.
// O estado (propósito e interesses escolhidos) e a gravação vêm da página principal, compartilhados com o desktop.
export default function CadastroInteressesCelular({
  catalogo,
  proposito,
  aoMudarProposito,
  selecionadas,
  aoAlternar,
  aoCriarTag,
  aoReceberDaIA,
  aoGravar,
  salvando,
  erro,
  editando,
  minimo,
}) {
  const { perfil, definirPerfil } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [preferencias] = usePreferencias();
  const [tela, setTela] = useState(editando ? 'interesses' : 'objetivo');
  const [texto, setTexto] = useState('');
  const [erroIA, setErroIA] = useState('');
  const [etapaIA, setEtapaIA] = useState(0);
  const [falhouIA, setFalhouIA] = useState(false);
  const [dialogo, setDialogo] = useState(null);
  const arquivo = useRef(null);

  // Avança as etapas da análise enquanto a API responde, sem concluir a última antes da resposta.
  useEffect(() => {
    if (tela !== 'analisando' || falhouIA || etapaIA >= ETAPAS_IA.length - 1) return undefined;
    const relogio = setTimeout(() => setEtapaIA((e) => e + 1), INTERVALO_IA_MS);
    return () => clearTimeout(relogio);
  }, [tela, falhouIA, etapaIA]);

  // Com todas as etapas concluídas, mostra os interesses já marcados pela IA.
  useEffect(() => {
    if (tela !== 'analisando' || etapaIA < ETAPAS_IA.length) return undefined;
    const espera = setTimeout(() => setTela('interesses'), 700);
    return () => clearTimeout(espera);
  }, [tela, etapaIA]);

  async function escolherArquivo(lista) {
    const escolhido = lista?.[0];
    if (!escolhido) return;
    setErroIA('');
    try {
      setTexto(await lerArquivoDeTexto(escolhido));
    } catch (e) {
      setErroIA(e.message);
    }
  }

  async function importar() {
    if (!texto.trim()) {
      setErroIA('Escolha um arquivo de texto ou cole um resumo sobre você para importar.');
      return;
    }
    setErroIA('');
    setFalhouIA(false);
    setEtapaIA(0);
    setTela('analisando');
    try {
      // O texto vira o resumo profissional só se ainda não houver um e se couber no limite da API.
      const r = await analisarComIA({ texto, usarComoBio: !perfil.bio && texto.trim().length <= LIMITE_BIO, definirPerfil });
      if (r.falhou) {
        setFalhouIA(true);
        return;
      }
      aoReceberDaIA(r.tecnicas, r.hobbies);
      avisar(`A IA marcou ${r.total} interesses. Revise antes de continuar.`);
      setEtapaIA(ETAPAS_IA.length);
    } catch (e) {
      setErroIA(e.message);
      setTela('importar');
    }
  }

  async function continuarInteresses() {
    if (!(await aoGravar())) return;
    if (editando) navegar('/eu');
    else setTela('revisao');
  }

  const qtd = selecionadas.size;
  const faltam = Math.max(0, minimo - qtd);
  const doTipo = (categoria) => catalogo.filter((t) => t.category === categoria).map((t) => t.name);

  if (tela === 'objetivo') {
    return (
      <main className="cadastro">
        <Cabecalho titulo="Conexão Avanade" aoVoltar={() => navegar('/cadastro/dados')} />
        <header className="cadastro__cabecalho">
          <h1>Qual é o seu objetivo de conexão?</h1>
          <p className="subtitulo">Escolha o que você quer construir dentro da Avanade.</p>
        </header>
        <div className="opcoes opcoes--cartao" role="radiogroup" aria-label="Objetivo de conexão">
          {Object.entries(PROPOSITOS_CELULAR).map(([id, { descricao, Icone }]) => (
            <label key={id} className={`opcao${proposito === id ? ' opcao--ativa' : ''}`}>
              <input
                type="radio"
                name="proposito"
                value={id}
                checked={proposito === id}
                onChange={() => aoMudarProposito(id)}
                className="so-leitor"
              />
              <span className="opcao__icone">
                <Icone />
              </span>
              <span>
                <strong>{TITULOS[id]}</strong>
                <span className="pequeno">{descricao}</span>
              </span>
            </label>
          ))}
        </div>
        <button type="button" className="botao botao--primario" onClick={() => setTela('importar')}>
          Continuar
        </button>
      </main>
    );
  }

  if (tela === 'importar') {
    return (
      <main className="cadastro">
        <Cabecalho titulo="" aoVoltar={() => setTela('objetivo')} />
        <header className="cadastro__cabecalho">
          <h1>Importe seus interesses</h1>
          <p className="subtitulo">
            Nosso sistema inteligente vai extrair seus interesses profissionais e pessoais para montar seu perfil em segundos.
          </p>
        </header>
        <div
          className="soltar soltar--grande"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            escolherArquivo(e.dataTransfer.files);
          }}
        >
          <button type="button" className="soltar__alvo" onClick={() => arquivo.current?.click()}>
            <span className="soltar__icone">
              <IconeDocumento />
            </span>
            <strong>Arraste ou toque para importar</strong>
            <span className="pequeno">Arquivos de texto (.txt ou .md) com seus interesses profissionais e pessoais (máx. 10MB)</span>
          </button>
          <input
            ref={arquivo}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="so-leitor"
            tabIndex={-1}
            onChange={(e) => escolherArquivo(e.target.files)}
          />
          <label className="so-leitor" htmlFor="texto-ia-celular">
            Resumo para importar
          </label>
          <textarea
            id="texto-ia-celular"
            className="campo__controle soltar__texto"
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={2000}
            placeholder="Ou cole aqui: o que você faz, tecnologias que usa e do que gosta fora do trabalho."
          />
        </div>
        {erroIA && (
          <p className="erro-campo" role="alert">
            {erroIA}
          </p>
        )}
        <button type="button" className="botao botao--primario" onClick={importar}>
          Importar interesses
        </button>
        <button type="button" className="botao botao--texto" onClick={() => setTela('interesses')}>
          Preencher interesses manualmente
        </button>
      </main>
    );
  }

  if (tela === 'analisando') {
    if (falhouIA) {
      return (
        <main className="cadastro cadastro--centro" role="alert">
          <h1>Não conseguimos analisar agora</h1>
          <p className="subtitulo">Sem problema: você escolhe seus interesses manualmente em poucos toques.</p>
          <button type="button" className="botao botao--primario" onClick={() => setTela('interesses')}>
            Preencher manualmente
          </button>
          <button type="button" className="botao botao--texto" onClick={() => setTela('importar')}>
            Tentar de novo
          </button>
        </main>
      );
    }
    const pct = Math.round((Math.min(etapaIA + 1, ETAPAS_IA.length) / ETAPAS_IA.length) * 100);
    return (
      <main className="cadastro cadastro--centro">
        <div className="progresso-ia" style={{ '--pct': `${pct}%` }} aria-hidden="true">
          <span>
            <IconeChip />
          </span>
        </div>
        <h1>IA identificando seu perfil...</h1>
        <p className="subtitulo">Skills, tecnologias, objetivos de aprendizado e interesses pessoais estão sendo mapeados.</p>
        <ol className="etapas-ia" aria-live="polite">
          {ETAPAS_IA.map((rotulo, i) => {
            const estado = i < etapaIA ? 'feita' : i === etapaIA ? 'atual' : 'espera';
            return (
              <li key={rotulo} className={`etapas-ia__item etapas-ia__item--${estado}`}>
                {estado === 'feita' ? <IconeCheckCirculo /> : <span className="etapas-ia__ponto" />}
                {rotulo}
              </li>
            );
          })}
        </ol>
      </main>
    );
  }

  if (tela === 'interesses') {
    return (
      <main className="cadastro">
        <Cabecalho titulo="Perfil Profissional" aoVoltar={() => (editando ? navegar('/eu') : setTela('importar'))} />
        <header className="cadastro__cabecalho">
          <h1>Quais são seus interesses?</h1>
          <p className="subtitulo">Selecione os temas que mais conectam você no trabalho e fora dele. Você pode alterar depois.</p>
        </header>
        <p className="rotulo">Eixos de match</p>
        <section className="cartao bloco eixo">
          <h2>Interesses profissionais</h2>
          <p className="eixo__legenda">Skills, tecnologias, projetos, áreas e aprendizado</p>
          <SeletorTags
            categoria="TECHNICAL"
            catalogo={doTipo('TECHNICAL')}
            selecionadas={selecionadas}
            aoAlternar={aoAlternar}
            aoCriar={aoCriarTag}
          />
        </section>
        <section className="cartao bloco eixo">
          <h2>Interesses pessoais</h2>
          <p className="eixo__legenda">Hobbies, esportes, literatura, cultura, causas sociais</p>
          <SeletorTags
            categoria="HOBBY"
            catalogo={doTipo('HOBBY')}
            selecionadas={selecionadas}
            aoAlternar={aoAlternar}
            aoCriar={aoCriarTag}
          />
        </section>
        {erro && (
          <p className="erro-campo" role="alert">
            {erro}
          </p>
        )}
        <div className="rodape-acao">
          <p className="pequeno centro" aria-live="polite">
            {faltam > 0 ? `Escolha mais ${faltam} (mínimo de ${minimo})` : `${qtd} interesses selecionados`}
          </p>
          <button type="button" className="botao botao--primario" disabled={faltam > 0 || salvando} onClick={continuarInteresses}>
            {salvando ? 'Salvando...' : 'Continuar'}
          </button>
        </div>
      </main>
    );
  }

  // Revisão do perfil antes das preferências.
  const unidade = preferencias.hub || perfil.department;
  return (
    <main className="cadastro">
      <header className="revisao__topo">
        <button type="button" className="icone-botao" aria-label="Voltar aos interesses" onClick={() => setTela('interesses')}>
          <IconeVoltar />
        </button>
        <h1>Perfil de Colaborador</h1>
        <button type="button" className="link-acao" onClick={() => navegar('/cadastro/preferencias')}>
          Confirmar
        </button>
      </header>

      <section className="cartao bloco revisao__pessoa">
        <Avatar nome={perfil.name} tamanho={64} />
        <div>
          <h2>{perfil.name}</h2>
          <p className="pequeno">{perfil.department || 'Colaborador Avanade'}</p>
          {perfil.location && (
            <p className="pequeno meta">
              <IconePino /> {perfil.location}
            </p>
          )}
        </div>
        <button type="button" className="icone-botao icone-botao--laranja" aria-label="Editar dados" onClick={() => setDialogo('dados')}>
          <IconeEditar />
        </button>
      </section>

      <section className="cartao bloco">
        <div className="titulo-secao">
          <h3 className="titulo-laranja">Resumo</h3>
          <button type="button" className="icone-botao" aria-label="Editar resumo" onClick={() => setDialogo('bio')}>
            <IconeEditar />
          </button>
        </div>
        <p className={perfil.bio ? 'texto-corrido' : 'pequeno'}>
          {perfil.bio || 'Adicione um resumo: ele aparece só para quem der match com você.'}
        </p>
      </section>

      <section className="cartao bloco">
        <div className="titulo-secao">
          <h3 className="titulo-laranja">Interesses profissionais</h3>
          <button type="button" className="icone-botao" aria-label="Editar interesses profissionais" onClick={() => setTela('interesses')}>
            <IconeEditar />
          </button>
        </div>
        <div className="chips">
          {perfil.tags.technical.map((t) => (
            <span key={t.id} className="chip chip--laranja-suave">
              {t.name}
            </span>
          ))}
        </div>
      </section>

      <section className="cartao bloco">
        <div className="titulo-secao">
          <h3 className="titulo-laranja">Interesses pessoais</h3>
          <button type="button" className="icone-botao" aria-label="Editar interesses pessoais" onClick={() => setTela('interesses')}>
            <IconeEditar />
          </button>
        </div>
        <div className="chips">
          {perfil.tags.hobby.map((t) => (
            <span key={t.id} className="chip chip--laranja-suave">
              {t.name}
            </span>
          ))}
        </div>
        {unidade && (
          <p className="pequeno">
            <strong>Unidade: {unidade}</strong>
            {perfil.location && <span className="bloco-linha">Cidade: {perfil.location}</span>}
          </p>
        )}
      </section>

      <button type="button" className="botao botao--primario" onClick={() => navegar('/cadastro/preferencias')}>
        Avançar para preferências
      </button>

      {dialogo === 'dados' && <EditarDados aoFechar={() => setDialogo(null)} />}
      {dialogo === 'bio' && <EditarBio aoFechar={() => setDialogo(null)} />}
    </main>
  );
}
