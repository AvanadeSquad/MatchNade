# Como contribuir

## Fluxo

1. Crie uma branch a partir de `develop`: `feature/<assunto>` ou `fix/<assunto>`.
2. Faça mudanças pequenas e focadas. Rode os testes da parte que mexeu (veja o `README.md`).
3. Abra um pull request para `develop`. A `main` só recebe o que já foi validado.

## PRs empilhados

Os PRs 3 a 7 apontam para `develop`. Os PRs a partir do 8 apontam para a branch de um deles (ou de outro PR filho), não para `develop`, para que o diff de cada um mostre só a própria mudança:

| Base | PRs que apontam para ela |
|---|---|
| `develop` | 3, 4, 5, 6, 7 e 24 |
| `feature/backend-api` (PR 4) | 8, 10, 11, 13, 17, 19, 22, 23 e 28 |
| `feature/frontend-app` (PR 5) | 14, 16, 20 e 29 |
| `feature/e2e-playwright` (PR 3) | 12 e 18 |
| `feature/documentacao` (PR 6) | 30 e o desta seção |
| `feature/ci-e-publicacao` (PR 7) | 9, 15 e 21 |
| `feature/regressao-visual` (PR 18) | 25 |
| `feature/observabilidade` (PR 22) | 26 |
| `feature/cabecalhos-seguranca` (PR 16) | 27 |

Ordem de mesclagem:

1. Os PRs base, nesta ordem: 4, 5, 3, 6 e 7. O PR 24 (fim de linha) pode entrar a qualquer momento; quanto antes, menos problema no Windows.
2. Depois de mesclar um PR base, reaponte os PRs filhos dele para `develop` (no PR, "Edit" ao lado do título) e mescle-os na ordem dos números. O PR 21 (lint no CI) só depois dos PRs 19 e 20, que criam os scripts que ele roda.
3. Um PR que aponta para outro PR filho (25, 26 e 27) entra depois do PR da sua base, do mesmo jeito.

Não apague a branch de um PR base antes de mesclar ou reapontar todos os PRs que apontam para ela. Sem a branch base, esses PRs ficam sem destino.

Conflitos esperados ao mesclar os filhos, porque várias branches acrescentam coisas no mesmo lugar:

- `package.json`: mantenha os scripts e dependências dos dois lados.
- `package-lock.json`: aceite qualquer um dos lados e rode `npm install` na pasta para regenerar o arquivo. Depois, `npm ci` e os testes.
- `README.md` do backend e do frontend: mantenha as duas seções.

## Fim de linha

O `.gitattributes` da raiz força LF em código, JSON, YAML, SQL, CSS, HTML e Markdown, e marca imagens e PDFs como binários. Sem isso, o `core.autocrlf` do Windows converte os arquivos para CRLF e o `npm run format:check` falha em todos eles. Quem já tinha clonado no Windows antes desse arquivo precisa refazer o checkout para os arquivos voltarem a LF. Depois de puxar, com a árvore de trabalho limpa (faça commit ou `git stash` antes, porque o segundo comando descarta mudanças locais):

```powershell
git rm -r --cached -q .
git reset --hard
```

Só `git add --renormalize .` não basta: ele corrige o que está versionado, que já é LF, e não reescreve os arquivos da pasta. Clonar de novo também resolve.

## Commits

Mensagens em português, no imperativo, com um prefixo: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. A primeira linha resume o que muda; o corpo, se houver, explica o motivo.

## Código

- Comentário explica o código: o que ele faz e por quê. Não registre contexto de gestão do projeto, histórico de decisões nem estado de andamento ("provisório", "a fazer").
- Textos de interface e de documentação em português do Brasil, sem travessão. Ícones são SVG, não emoji.
- Dados de teste, exemplos e seeds são sempre fictícios.
- Regras de negócio ficam no backend e são cobertas por teste de API; o teste de ponta a ponta confere os fluxos principais.
- Cargo e senioridade não entram em filtro, pontuação, cartão da descoberta nem texto de IA.

## Antes de abrir o PR

```powershell
cd backend; npm test
cd ..\frontend; npm run build
cd ..\e2e; npm test
```
