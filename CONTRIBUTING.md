# Como contribuir

## Fluxo

1. Crie uma branch a partir de `develop`: `feature/<assunto>` ou `fix/<assunto>`.
2. Faça mudanças pequenas e focadas. Rode os testes da parte que mexeu (veja o `README.md`).
3. Abra um pull request para `develop`. A `main` só recebe o que já foi validado.

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
