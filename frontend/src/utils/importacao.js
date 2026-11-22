import { API } from '../services/api.js';

// Importação de interesses com IA, compartilhada pelas versões desktop e celular do cadastro.
export const LIMITE_BIO = 1000;
// Mesmo limite da API (POST /profile/enrich-bio recusa acima disso).
export const LIMITE_ANALISE = LIMITE_BIO;
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

// Lê um arquivo de texto escolhido ou arrastado. PDF e DOCX ainda não são lidos no navegador.
export async function lerArquivoDeTexto(arquivo) {
  if (!/\.(txt|md)$/i.test(arquivo.name) && !arquivo.type.startsWith('text/')) {
    throw new Error('Por enquanto a leitura automática aceita arquivos de texto (.txt ou .md). Para PDF ou DOCX, copie e cole o conteúdo.');
  }
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error('O arquivo passa de 10 MB.');
  const conteudo = (await arquivo.text()).trim();
  if (conteudo.length > LIMITE_ANALISE) {
    throw new Error(
      `O texto do arquivo tem ${conteudo.length} caracteres e o limite é ${LIMITE_ANALISE}. Deixe só o trecho principal e tente de novo.`,
    );
  }
  return conteudo;
}

// Envia o texto para a análise de bio da API. Com `usarComoBio`, salva antes o texto como resumo profissional.
// Devolve { falhou: true } quando a IA não respondeu ou não achou nada, ou { tecnicas, hobbies, total }.
export async function analisarComIA({ texto, usarComoBio, definirPerfil }) {
  const conteudo = texto.trim();
  if (!conteudo) throw new Error('Cole um texto sobre você ou escolha um arquivo para analisar.');
  if (usarComoBio) definirPerfil(await API.atualizarPerfil({ bio: conteudo.slice(0, LIMITE_BIO) }));
  const resposta = await API.analisarBio(conteudo);
  const total = resposta.technical_tags.length + resposta.hobby_tags.length;
  if (resposta.fallback || !total) return { falhou: true };
  return { tecnicas: resposta.technical_tags, hobbies: resposta.hobby_tags, total };
}
