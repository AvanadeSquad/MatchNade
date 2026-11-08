# Desenho: exclusão de conta e personalização de perfil

Estado: **desenho fechado em 08/11/2026, nada implementado.** Origem: pedido da reunião de avaliação de 28/10 (pensar a personalização do perfil, incluindo a exclusão de conta). As decisões abaixo são do P.O. do projeto. A construção está dividida em três fatias, cada uma em um pull request (seção 9).

## 1. Situação hoje
- `DELETE /profile` (`backend/src/services/perfil.js`, `excluirPerfil`) apaga na hora: remove `ai_interaction_log` da pessoa e depois o `employee`, com `ON DELETE CASCADE` nas demais tabelas (interesses, conexões, mensagens, bloqueios e **denúncias, tanto as feitas quanto as recebidas**).
- A tela Meu perfil (`frontend/src/pages/MeuPerfil.jsx`) tem o link "Excluir meus dados definitivamente" e um diálogo com um botão "Excluir tudo", sem confirmação forte.
- Três estados existem no banco: pausar (`is_paused`, visível na tela), inativo (`is_active`, sem tela, só por banco) e excluir. A pessoa não tem como entender a diferença.
- Personalização hoje: nome, unidade, cidade, cargo, bio, objetivos, cota semanal e interesses. O avatar são as iniciais.
- O login é por e-mail e senha ou pela Microsoft. Quem entra pela Microsoft **não tem senha local**.

## 2. Decisões

### Exclusão
| Tema | Decisão |
|---|---|
| Prazo de arrependimento | **30 dias.** A conta fica oculta e marcada; entrar de novo no prazo permite cancelar. Depois, exclusão definitiva automática. |
| Confirmação | **Digitar o próprio e-mail** num diálogo. Serve a qualquer conta, com ou sem senha. |
| O outro lado de um match | **A conexão e o chat somem**, como hoje. Sem aviso de "pessoa removida". |
| Denúncias recebidas | **Guardar de forma totalmente anônima: só motivo e data.** Sem e-mail, sem hash, sem unidade. |
| Exportar os próprios dados | **Entra.** Arquivo JSON baixado na tela Meu perfil. |
| Estados | **Dois: Pausar e Excluir.** "Desativar" (`is_active`) deixa de ser conceito da pessoa e fica só para administração. |

### Personalização (primeira versão)
| Item | Decisão |
|---|---|
| Pronomes | Campo opcional, texto curto. Não entra em nenhum cálculo de afinidade. |
| Horários preferidos de Coffee Chat | Pré-seleciona horários no seletor que já existe no chat. |
| Visibilidade "só minha unidade" | Controla **quem pode me ver nas recomendações**. Eu continuo vendo todas as unidades. |
| Foto ou avatar | **Avatares prontos, sem upload.** Um conjunto fixo de ilustrações e cores do próprio app, guardado como um código na conta. |

## 3. Exclusão: como funciona

### Fluxo
1. Meu perfil, "Excluir minha conta": o diálogo explica o prazo, o que some e o que fica, e pede para **digitar o próprio e-mail**.
2. `POST /profile/deletion` com `{ confirm_email }`. O servidor confere que o e-mail é o da conta (sem diferenciar maiúsculas). Erro: `400 CONFIRMACAO_INVALIDA`.
3. A conta passa a `is_active = false` e grava `deletion_requested_at = agora`. Os tokens antigos são invalidados (incrementa `token_version`), então todas as sessões caem. Os filtros que já existem por `is_active` escondem a pessoa das recomendações, das conexões e das buscas das outras pessoas, sem mudar essas consultas.
4. A pessoa pode entrar de novo durante os 30 dias, mas só vê a tela "Conta marcada para exclusão em DD/MM": **cancelar** ou **excluir agora**. Qualquer outra rota responde `403 CONTA_EM_EXCLUSAO`.
5. `POST /profile/deletion/cancel` volta `is_active = true` e limpa `deletion_requested_at`. As conexões e mensagens voltam, porque nada foi apagado ainda.
6. Passados 30 dias, a exclusão definitiva roda (seção 5).
7. "Excluir agora" (`DELETE /profile`, que já existe) fica disponível na tela de conta marcada e apaga na hora, seguindo o mesmo caminho da exclusão definitiva.

### Login durante o prazo
Hoje o login recusa conta inativa com a mesma resposta de senha errada. Uma conta **marcada para exclusão** é um caso à parte: o login passa a emitir o token, e o middleware de autenticação deixa passar só `GET /profile`, `POST /profile/deletion/cancel`, `DELETE /profile` e `GET /profile/export`. Conta inativa por outro motivo continua recusada como hoje. Detalhe de segurança: a resposta de login não pode revelar se um e-mail inexistente tem conta; o desvio vale só depois de a senha ou o token da Microsoft serem aceitos.

### Dados
- Migração: `employee.deletion_requested_at TIMESTAMPTZ NULL`.
- Nada é apagado durante os 30 dias.

## 4. Denúncias anônimas
Hoje uma denúncia recebida some quando a pessoa é excluída. Pelo desenho, antes de apagar, cada denúncia **recebida** é copiada para uma tabela própria só com motivo e data, sem nenhuma chave para a pessoa:

```
moderation_report_archive (id, reason TEXT, created_at TIMESTAMPTZ, archived_at TIMESTAMPTZ)
```

- Sem `reported_id`, sem `reporter_id`, sem unidade, sem hash. Serve a estatística de moderação, não a reconhecer reincidente. Quem se cadastrar de novo começa limpo, e isso é uma consequência aceita da decisão.
- **O motivo é texto livre**, então a pessoa que denuncia pode ter escrito nome ou e-mail. Antes de arquivar, o texto precisa passar pelo mesmo filtro de dados sensíveis que o app já usa, ou ser guardado só se curto e sem padrão de e-mail e telefone. Isso fica como decisão de implementação e precisa de teste.
- **Denúncias feitas pela própria pessoa (contra outras) são apagadas com ela**, como hoje. Suposição a confirmar: a decisão do P.O. falou só das recebidas.
- A cópia e a exclusão acontecem na mesma transação.

## 5. Exclusão definitiva e agendamento
- A função de exclusão definitiva reaproveita `excluirPerfil` (apaga `ai_interaction_log` e o `employee`, com cascata) e arquiva as denúncias recebidas antes.
- **Quem dispara os 30 dias:** o Render gratuito hiberna e não tem agendador. Proposta: uma varredura na própria API, ao iniciar e a cada hora enquanto estiver de pé (`setInterval`), sob trava consultiva do PostgreSQL (como a do seed e das migrações) para duas instâncias não rodarem juntas. Como a API pode estar hibernada, a varredura também roda **no login de qualquer pessoa** e antes de listar recomendações, por uma consulta barata. Contas vencidas ficam ocultas de qualquer forma, então um atraso não expõe ninguém; só adia o apagamento.
- Para o primeiro deploy: documentar que o prazo de 30 dias é "no mínimo 30 dias, apagado na próxima execução da varredura".
- Registrar em log estruturado, sem dado pessoal, só a quantidade de contas apagadas por execução.

## 6. Exportar os próprios dados
- `GET /profile/export` devolve um JSON baixado pelo navegador, com: dados do perfil, interesses (nome e categoria), objetivos, conexões (com a outra pessoa só pelo nome e o estado), as **mensagens enviadas pela própria pessoa** e as recebidas, bloqueios que ela fez e denúncias que ela fez.
- Não inclui: hash de senha, hash da resposta de segurança, versão de sessão, contadores de bloqueio, nem dados pessoais da outra pessoa além do nome.
- Sem tarefa agendada: é uma rota de leitura, autenticada, com limite de requisições por pessoa (por exemplo 5 por hora).
- A tela mostra um botão "Baixar meus dados" ao lado da exclusão.

## 7. Personalização: como funciona
Colunas novas em `employee`, numa migração própria.

| Coluna | Tipo | Regras |
|---|---|---|
| `pronouns` | `TEXT NULL` | até 30 caracteres, texto simples, sem dado sensível (passa pelo filtro que já existe). Não entra em afinidade nem em texto de IA. |
| `visibility` | `TEXT NOT NULL DEFAULT 'ALL'` com `CHECK IN ('ALL','UNIT')` | `UNIT`: só quem é da mesma unidade me recebe nas recomendações. |
| `avatar_id` | `TEXT NULL` | um dos códigos de uma lista fixa no backend (por exemplo 12). Fora da lista, `400`. `NULL` mantém as iniciais. |
| `preferred_coffee_slots` | `JSONB NOT NULL DEFAULT '[]'` | lista de horários do conjunto que o chat já oferece (`HORARIOS`), no máximo 5. |

### Visibilidade, em detalhe
- **Recomendações:** quem tem `UNIT` só aparece para pessoas da mesma unidade.
- **Já conectados:** conexões existentes continuam, e o chat segue funcionando.
- **Demonstrar interesse em quem restringiu a unidade:** de outra unidade, responde `400 RECEIVER_INVALIDO` com a mensagem genérica "Esta pessoa não está disponível", a mesma de hoje para pausados e inativos, sem revelar o motivo.
- **Perfil de outra pessoa (`GET /employees/:id`):** quem restringiu e é de outra unidade responde `404`, salvo se já houver conexão.
- **Trocar de unidade:** a restrição passa a valer para a nova unidade.
- **Risco de produto:** a descoberta entre unidades é um pilar (bônus de 0,05). O padrão é `ALL`, a escolha é explícita e deve vir com um texto claro ("você aparece só para a sua unidade"). Medir quantas pessoas escolhem `UNIT`: se passar de uma fração relevante, rediscutir.
- A pessoa que restringe **continua vendo todas as unidades**. Só a exposição dela muda.

### Avatar
- O backend só valida o código. O frontend tem o mapa de código para ilustração (SVG, sem emoji) e cor, e mostra o avatar nos mesmos lugares em que hoje aparecem as iniciais.
- Sem upload, sem armazenamento de arquivo e sem moderação de imagem.

### Horários preferidos
- No seletor do Coffee Chat, os horários marcados vêm pré-selecionados e destacados. O fluxo de convite, o texto da mensagem e o arquivo `.ics` não mudam.

## 8. LGPD e privacidade
- Base: eliminação a pedido do titular. O prazo de 30 dias é uma reserva para arrependimento e deve estar escrito na tela e na política de privacidade.
- Depois do prazo, o dado pessoal é apagado do banco. **Cópias de segurança do provedor do banco** (por exemplo Neon) podem guardar o dado por mais tempo: verificar a retenção quando o banco hospedado for escolhido e escrever na política.
- A denúncia arquivada não permite identificar ninguém por si só, mas o texto livre pode: o filtro de texto acima é obrigatório.
- A exportação entrega os dados da própria pessoa, nunca dados pessoais de terceiros além do nome de quem já era conexão.
- A regra do produto continua: cargo e senioridade só aparecem depois do match, e nada aqui os expõe antes.

## 9. Fatias de implementação (cada uma, um pull request)
1. **Exclusão com prazo e confirmação por e-mail:** migração, `POST /profile/deletion`, cancelamento, login em conta marcada, rotas permitidas, diálogo e tela de conta marcada, varredura, arquivo anônimo de denúncias, documentação, testes de borda e ponta a ponta. É a fatia grande e a mais sensível.
2. **Exportar os próprios dados:** `GET /profile/export`, botão, limite de requisições, testes (inclusive que não vaza hash nem dado de terceiros).
3. **Personalização:** migração, validação, edição em Meu perfil, avatar em todos os lugares, pré-seleção de horários e a regra de visibilidade nas recomendações, nas conexões e no perfil de outra pessoa, com testes e referências visuais.

Ordem sugerida: 1, depois 2, depois 3. A 2 e a 3 não dependem uma da outra.

## 10. Testes que o desenho exige
- Confirmação com e-mail errado, vazio, com maiúsculas e com espaços.
- Conta marcada: sessão antiga cai; só as rotas permitidas respondem; as outras dão `403 CONTA_EM_EXCLUSAO`; o login com senha errada continua dando a resposta genérica.
- Cancelar dentro do prazo devolve conexões e mensagens.
- Varredura: conta com 29 dias fica, com 30 sai; duas execuções simultâneas não apagam duas vezes (trava).
- Denúncia arquivada sem nenhum campo que ligue à pessoa, e com texto filtrado.
- Exportação sem hash, sem dado de terceiros, com limite de requisições.
- Visibilidade: recomendações, `POST /matches` e `GET /employees/:id` nos casos de mesma unidade, outra unidade e já conectados; troca de unidade.
- Avatar fora da lista, pronomes longos ou sensíveis, horários fora do conjunto.

## 11. Pontos em aberto
1. **Denúncias feitas pela própria pessoa** são apagadas junto (suposição). Confirmar com o P.O.
2. **Quem acessa o arquivo de denúncias anônimas** e por quanto tempo ele é mantido. Hoje ninguém tem tela de moderação; o arquivo só guarda.
3. **Varredura na API hibernada:** aceitar "no mínimo 30 dias" ou exigir um agendador externo quando houver deploy.
4. **Retenção dos backups** do provedor do banco, a verificar na escolha entre Neon e Supabase.
5. **Quantidade e arte dos avatares:** 12 é proposta; a arte depende do UI/UX.
6. **Política de privacidade e termo de uso:** o texto da tela precisa de revisão de quem responde pela LGPD na empresa.
