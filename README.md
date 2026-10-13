# MatchNade · Avanade Global Connect

Front-end em **React.js**, desenvolvido a partir das oito telas de referência. Layout responsivo para celular, tablet e desktop, com a identidade visual em laranja, branco e lilás.

## Executar

Requer Node.js 22.12 ou mais recente.

```bash
npm install
npm run dev
```

Abra **http://127.0.0.1:5173**. No PowerShell com execução de scripts bloqueada, use `npm.cmd install` e `npm.cmd run dev`.

Para entrar na demonstração, use um e-mail válido e qualquer senha, ou clique no botão Microsoft 365. Nenhuma senha é enviada ou armazenada.

## Telas e funcionalidades

| Rota | Tela |
| --- | --- |
| `/entrar` | Login, exibição da senha e opções de acesso demonstrativo |
| `/cadastro` | Dados profissionais, unidade e aceite dos termos |
| `/interesses` | Objetivos, interesses e upload com validação de PDF/DOCX até 10 MB |
| `/preferencias` | Equilíbrio profissional/pessoal, alcance e polos |
| `/descobrir` | Colegas, busca, filtros, paginação, conexões e agendamento |
| `/matches` | Matches, busca, detalhes do perfil, café e acesso ao chat |
| `/mensagens` | Conversas, envio, filtros, emojis e convites de café |
| `/perfil` | Edição de dados, interesses, preferências e privacidade |

As alterações de perfil, conexões, horários e mensagens persistem no `localStorage`, na chave `matchnade.demo.v1`. Para restaurar os dados iniciais, remova essa chave nas ferramentas do navegador.

## Limites do front-end

O projeto usa pessoas e conversas fictícias. Login/SSO, análise com IA, upload, Teams, notificações e calendário são demonstrações locais. Arquivos selecionados não são enviados; a análise adiciona interesses de exemplo. Conectar um colega simula o match, sem aceite de uma pessoa real. Anexos do chat registram apenas o nome do arquivo.

Integrações reais exigem backend, autorização corporativa, Microsoft Entra ID, Microsoft Graph e um serviço de análise de currículos. As ações estão centralizadas no contexto para permitir a futura integração.

## Build e verificação

```bash
npm run build
npm run preview
npm test
npm run test:e2e
```

O build estático é gerado em `dist/`. Os testes de navegador usam Google Chrome instalado e iniciam/reutilizam o servidor local. Verificam o fluxo de cadastro, filtros, cafés, mensagens, persistência e as oito telas em 375, 768 e 1440 pixels.

Para hospedar, configure fallback de todas as rotas para `index.html`.

## Estrutura

```text
src/
  App.jsx               Rotas das oito telas
  components/           Cabeçalho, rodapé e elementos compartilhados
  context/              Estado e ações de demonstração
  pages/                Login, onboarding e páginas da plataforma
  styles/               Estilos globais e responsivos
  utils/demoStorage.js  Persistência e recuperação de dados
  data.js               Perfil e colegas fictícios
public/
  fonts/                Plus Jakarta Sans e licença OFL
  images/               Retratos ilustrativos locais
test/                   Testes de dados, fluxos e layouts
```

As pastas iniciais de backend e `compose.yaml` foram preservados; o front-end não depende do PostgreSQL.

Construído com [React](https://react.dev/learn/build-a-react-app-from-scratch), [Vite](https://vite.dev/guide/), React Router e Lucide. Retratos ilustrativos do Unsplash; não representam colaboradores reais da Avanade.
