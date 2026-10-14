# Design

Referência visual do app, exportada do Figma.

## Conteúdo

- `telas/`: PNG (390x844) das telas de celular, numerados na ordem do fluxo do usuário. São a referência de conteúdo e de estilo; a versão para desktop foi adaptada a partir delas (veja os ajustes abaixo).
- `telas/_auxiliares/`: PDFs de apoio (conteúdo rolável do login e da entrada, indicador da barra inferior).
- `telas/_fora-mvp-preferencias.png`: tela de preferências (prioridade entre interesses, alcance geográfico), fora do escopo do MVP.
- `tokens.css`: cores e formas usadas nas telas, como variáveis CSS. É a extração original do Figma. O frontend mantém a própria cópia em `frontend/src/styles/tokens.css`; ao mudar uma, atualize a outra.

| Arquivo | Tela |
|---|---|
| 01-entrada | Entrada |
| 02-login | Login |
| 03-cadastro | Cadastro |
| 04-bio | Bio |
| 05-analisando | Análise do perfil |
| 06-revisao-tags | Revisão das tags |
| 07-interesses | Escolha de interesses |
| 08-objetivos | Objetivos de conexão |
| 09-deck | Descoberta de pessoas |
| 10-perfil-pessoa | Perfil da pessoa |
| 11-match | Tela de match |
| 12-conexoes | Conexões |
| 13-chat | Chat |
| 14-perfil-config | Perfil e configurações |

## Ajustes aplicados na implementação

O app segue as telas, com estas diferenças deliberadas:

- Desktop primeiro: menu lateral, conteúdo em colunas (descoberta com painel da semana, perfil em duas colunas, chat com lista e conversa lado a lado). Abaixo de 900 px vira coluna única com barra de navegação inferior, como nas telas de celular.
- Nome do produto: Avanade Connect.
- Login só com Google. Sem senha, LinkedIn nem pedido de acesso por formulário.
- Avatar com as iniciais no lugar de foto. Sem busca e sem filtros na descoberta.
- Cadastro só com nome, unidade e cidade. A bio é texto livre, analisado por IA com revisão das tags.
- Objetivos de conexão de seleção múltipla: networking, troca de conhecimento, hobby, mentoria e só conhecer gente.
- Perfil da pessoa mostra a afinidade por eixo (profissional e pessoal) e os interesses em comum.
- Conexões em três abas: recebidas, confirmadas e aguardando.
- Chat com a sugestão de abertura e menu para bloquear e denunciar.
- Cores: `frontend/src/styles/theme.css` escurece o laranja usado em texto e botões e o cinza claro, para atingir contraste de 4,5:1 (WCAG AA). O laranja original continua em fundos grandes e ícones.
