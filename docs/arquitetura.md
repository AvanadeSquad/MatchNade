# Arquitetura

## Visão geral

```
Navegador (React + Vite)
   |  HTTPS, JSON, JWT no cabeçalho Authorization
   v
API (Node.js + Express)
   |-- PostgreSQL (pg em produção, PGlite em desenvolvimento e testes)
   |-- Gemini (principal) e Groq (reserva), só para extrair tags e sugerir a abertura da conversa
   '-- Google Sign-In (valida o ID token do login)
```

Tudo roda em planos gratuitos. Não usa Docker.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Banco | PostgreSQL. Em desenvolvimento e testes, PGlite (PostgreSQL em processo, em memória ou em disco). | O mesmo SQL roda nos dois. Quem clona o projeto roda a API sem instalar banco nem criar conta. |
| Acesso a dados | SQL parametrizado direto com `pg`, sem ORM. | O modelo tem 8 tabelas e poucas consultas; menos camadas para manter. |
| Login | ID token do Google validado no servidor, depois JWT de 8 h. | O front não guarda segredo e a API decide quem entra pela lista de e-mails liberados. |
| Chat | Polling a cada 5 s, só com a aba visível. | Funciona na hospedagem gratuita; WebSocket exigiria outro tipo de serviço. |
| Afinidade | Jaccard ponderado pela raridade da tag (IDF), por eixo (profissional e pessoal), mais 0,05 para unidade diferente quando já há afinidade. | Matemática simples e explicável, sem IA. Evita recomendar a todos quem só tem tags populares. |
| IA | Provedor principal e reserva, timeout, nova tentativa, disjuntor, prazo total e validação da saída. | A IA nunca bloqueia o fluxo: se falhar, a pessoa escolhe as tags manualmente e o chat usa um texto padrão. |

## Regras de produto que a arquitetura garante

- **Sem hierarquia.** Cargo e senioridade não entram no cálculo, na descoberta, nas tags (a normalização recusa) nem no texto da IA (o texto gerado é rejeitado se citar cargo). O cargo só é devolvido nas conexões confirmadas e no perfil depois do match.
- **Sem dados sensíveis na saída da IA.** Segue os dados pessoais sensíveis da LGPD (Lei 13.709/2018, art. 5º, II). Tags devolvidas pela IA são descartadas, e um quebra-gelo é rejeitado, quando revelam:
  - opinião política ou filiação partidária;
  - convicção religiosa (religiões, crenças e quem as pratica);
  - condição ou tratamento de saúde, inclusive deficiência e saúde mental;
  - orientação sexual, vida sexual ou identidade de gênero;
  - origem racial ou étnica;
  - filiação a sindicato;
  - dado genético ou biométrico da pessoa.

  O filtro procura termos sobre a pessoa, não termos de setor ou de técnica: "Política de privacidade", "Políticas públicas", "Saúde digital", "Health tech", "Biometria" e "Eleições" como domínio de sistemas passam, assim como "Inclusão de PCD", "Cirurgia robótica", "Doenças tropicais" e "Raças de cães". Termos ambíguos ficam de fora para não barrar interesses legítimos; "Política", "Saúde", "Terapia" ou "Deficiência" sozinhas, por exemplo, passam. Hífen e barra contam como espaço ("Saúde-mental" é barrada). O filtro vale só para a IA: o que a pessoa digita na revisão de tags não é filtrado. A lista está em `backend/src/utils/tags.js` (`DADOS_SENSIVEIS`).
- **Consentimento mútuo.** Match só existe com interesse dos dois lados. Chat e quebra-gelo exigem conexão aceita e sem bloqueio, e quem não participa da conexão recebe 404.
- **Cota semanal.** De 1 a 5 solicitações por semana, de segunda a domingo. A checagem roda em transação com trava, então pedidos simultâneos não passam do limite.
- **Expiração.** Solicitações pendentes há mais de 14 dias expiram.
- **Privacidade.** A API guarda nome, e-mail corporativo, unidade, cidade, interesses, objetivos, bio e cargo (opcional). Cargo e bio só aparecem para outra pessoa depois do match. A pessoa pode pausar a exposição, bloquear, denunciar e excluir os dados (exclusão definitiva em cascata, incluindo os registros de IA).

## IA

A extração de tags envia a bio ao provedor entre as marcas `<bio>` e `</bio>`, tratadas como dado. O quebra-gelo envia só os nomes dos interesses das duas pessoas, nunca cargo, e é gerado uma vez e guardado na conexão.

Parâmetros padrão (variáveis de ambiente no `backend/.env.example`):

| Parâmetro | Valor |
|---|---|
| Timeout por chamada | 2,5 s |
| Nova tentativa | 1, após 0,5 s, em 429, erro 5xx ou timeout |
| Disjuntor | abre após 3 falhas em 60 s |
| Prazo total | 8 s (dá tempo de o provedor reserva responder) |
| Temperatura | 0,1 na extração e 0,4 no quebra-gelo |

O plano gratuito do Gemini pode usar o conteúdo enviado para melhorar produtos do Google. Confirme com a área de privacidade da empresa antes de usar bios reais, ou use um plano pago.

## Dados

Oito tabelas: `employee`, `interest_tag`, `employee_interest`, `connection_match`, `chat_message`, `employee_block`, `employee_report` e `ai_interaction_log`. O esquema está em `backend/src/db/schema.sql` e é aplicado na inicialização de forma idempotente. Há um índice único parcial que impede duas conexões ativas para o mesmo par de pessoas, em qualquer direção.

O `ai_interaction_log` registra tipo, versão do prompt, modelo, status e tempo; não guarda a bio.

## Testes

- `backend/test`: vitest e supertest sobre PGlite em memória. Cobrem afinidade, IA, autenticação, perfil, conexões, chat, bloqueio, cota, expiração e concorrência.
- `e2e`: Playwright em dois tamanhos de tela. Sobe a API e o frontend sozinho e cobre cadastro, match mútuo entre duas pessoas com chat, bloqueio e privacidade.
