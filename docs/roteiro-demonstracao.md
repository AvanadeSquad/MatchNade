# Roteiro de demonstração

Cartão E7-09. Roteiro de 8 minutos para mostrar o produto e o backend, com plano B para cada etapa. Os comandos são do PowerShell, a partir da raiz do repositório.

## Antes (15 minutos)

1. `npm ci` nas pastas `backend` e `frontend`; `backend/.env` copiado do `.env.example`.
2. Subir a API e o app (README, "Rodar localmente") e abrir `http://localhost:5173`. Use `localhost`, não `127.0.0.1`: a API só aceita essa origem.
3. Entrar uma vez como `ana.silva@exemplo.test` (senha de demonstração do README) para conferir que tudo carrega. Reiniciar a API volta ao estado inicial, porque o banco é em memória.
4. Para a etapa de volume, popular uma base à parte (terminal 3, na pasta `backend`):

```powershell
npm run popular -- --perfis 1000
```

Esse comando sobe um banco próprio e termina; a demonstração ao vivo continua no seed de 30 pessoas. O volume é mostrado pelo relatório (etapa 6).

5. Fechar notificações e abrir, em ordem: app, aba Network do navegador, terminal com fonte grande, GitHub (Actions).

## Roteiro

| Min | Etapa | O que fazer | O que dizer |
|---|---|---|---|
| 0:00 | 1. Login | Entrar como Ana | Conta com e-mail e senha criada no app; o login Microsoft depende do registro do aplicativo no Entra ID. |
| 1:00 | 2. Descoberta | Abrir `Descobrir`, mostrar as afinidades e o filtro de sinergia mínima (`40%+`, `60%+`) | O backend calcula a afinidade; o filtro atua nas 20 sugestões devolvidas. O percentual repondera os eixos pela preferência da pessoa (70% profissional e 30% pessoal por padrão) e é o mesmo na Descoberta e no perfil. |
| 2:00 | 3. Privacidade | Abrir o perfil de outra pessoa antes do match | Sem cargo antes do match; mensagens só depois do interesse mútuo. |
| 3:00 | 4. Conexão | Conectar com alguém, aceitar a Camila, abrir o chat com a Marina | Cota semanal de 1 a 5 solicitações; o par ativo é único por índice no banco, mesmo com cliques simultâneos. |
| 4:30 | 5. API | Na aba Network, clicar em "Conectar" e abrir `POST /matches` | Mesma regra de negócio vista pela API; `docs/api.md` e `openapi.json` descrevem o contrato. |
| 5:30 | 6. Volume | Mostrar o relatório gerado por `npm run metricas` (ver `docs/populacao-e-indicadores.md`) | Indicadores de 5.000 pessoas: pares sem interesse em comum, afinidade das sugestões, tempo das recomendações. |
| 6:30 | 7. IA | Cadastro com bio: revisão de tags e frase de abertura | A IA só sugere; a pessoa confirma. Cota esgotada cai na reserva e depois no caminho manual (`docs/ia-cota-e-reserva.md`). |
| 7:30 | 8. Qualidade | Aba Actions do GitHub | 8 verificações do CI e 2 do CodeQL a cada PR (10 checks no total). |

## Plano B

- **App fora do ar:** capturas em `vault/09-entregas/apresentacao/fonte/capturas` e `vault/09-entregas/relatorio-sp07-sp08-fonte/img`.
- **IA sem chave:** o app segue no caminho manual; mostre o log de teste em `npm test` no backend (`ia.test.js`) e `docs/ia-cota-e-reserva.md`.
- **Máquina lenta:** o relatório de indicadores já gerado (`npm run metricas -- --saida relatorio.md`) substitui a execução ao vivo.

## Perguntas que costumam vir

- **O percentual é o mesmo em todas as telas?** Sim: Descoberta, perfil, Matches e chat usam a mesma conta (`sinergiaExibida` e `sinergiaDaConexao`), com os eixos reponderados pela preferência da pessoa (70% profissional e 30% pessoal por padrão).
- **O que não foi feito?** Login Microsoft ativo (depende do tenant), deploy hospedado, teste com cota real de IA. Diga antes de perguntarem.
