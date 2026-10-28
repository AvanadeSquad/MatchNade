# Como contribuir

## Fluxo

A branch padrão é `develop`.

1. Crie uma branch a partir de `develop` atualizada: `feature/<assunto>` ou `fix/<assunto>`.
2. Faça mudanças pequenas e focadas. Rode os testes da parte que mexeu (veja "Antes de abrir o PR").
3. Abra um pull request para `develop`. A `main` só recebe o que já foi validado em `develop`.
4. Mescle com merge commit ("Create a merge commit"), não com squash nem rebase.

`develop` e `main` são protegidas: só recebem mudanças por pull request, com 1 aprovação e as conversas resolvidas. Não há push direto nem force push nessas branches. Na `develop`, o PR também precisa dos checks do CI verdes:

- workflow CI (`.github/workflows/ci.yml`): "Backend (testes)", "Backend (testes em PostgreSQL)", "Frontend (testes e build)", "Lint e formatação" (backend e frontend), "Ponta a ponta (Playwright)" e "Auditoria de dependências" (backend e frontend);
- workflow CodeQL (`.github/workflows/codeql.yml`): "Análise do JavaScript".

Se um check falhar, corrija na mesma branch e envie um novo commit.

## Histórico da integração inicial

A primeira versão do projeto entrou por PRs empilhados (os PRs 3 a 31, uns apontando para as branches dos outros), já mesclados em `develop`. Dessa fase continuam valendo o merge commit, o fim de linha em LF e a convenção de commits descritos neste arquivo.

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
cd backend; npm test; npm run lint; npm run format:check
cd ..\frontend; npm test; npm run lint; npm run format:check; npm run build
cd ..\e2e; npm test
```
