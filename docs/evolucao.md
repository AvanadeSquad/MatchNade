# O que ainda pode evoluir

Lista de pontos conhecidos, por área. Não é uma promessa de escopo: serve para priorizar o que vem depois do que já funciona.

## Validação em ambiente real

- **Login com Google.** Os testes usam um verificador simulado. Validar com um ID de cliente real e uma conta liberada.
- **PostgreSQL.** Os testes rodam em PGlite. Validar o esquema, as consultas e as travas de pedidos simultâneos no Neon.
- **IA.** Os testes usam respostas simuladas de Gemini e Groq. Medir precisão e cobertura da extração de tags com bios fictícias e ajustar prompts, modelo e limites.
- **Publicação.** Conferir `render.yaml`, o workflow de CI e os passos de `deploy.md` num deploy completo.

## Produto

- **Descoberta:** busca por nome ou unidade, filtros, preferências de alcance e paginação. Hoje as pessoas ignoradas ficam só no navegador; guardar no servidor evita que reapareçam em outro aparelho.
- **Chat:** indicador de mensagens não lidas, avisos fora do app (e-mail ou Teams) e troca do polling por envio em tempo real se a hospedagem permitir.
- **Perfil:** foto, edição da bio com nova análise e histórico de conexões.
- **Moderação:** tela para quem administra tratar denúncias e gerenciar a lista de e-mails liberados. Hoje as denúncias só ficam gravadas.

## Qualidade e segurança

- **Acessibilidade:** auditoria com leitor de tela, testes automáticos de contraste e foco, e modo escuro.
- **Segurança:** política de conteúdo (CSP), avaliação de guardar o token em cookie `httpOnly` no lugar do `localStorage`, auditoria periódica de dependências e política de retenção do registro de IA.
- **Privacidade:** confirmar a base legal e o uso de dados pelo plano gratuito do provedor de IA antes de enviar bios reais.
- **Testes:** testes de componente no frontend, o fluxo de revisão de tags com a IA respondendo e um teste de carga simples na API.
- **Código:** padronizar formatação e análise estática, e adotar migrações versionadas no banco no lugar do esquema idempotente.
- **Operação:** logs estruturados, métricas e alertas, e um `/health` que confira o banco.

## Design

- Validar com quem desenhou as telas as adaptações para desktop e os ajustes de contraste (veja `docs/design/README.md`).
- Desenhar os estados que não existem no Figma: vazio, erro e carregando, bloquear e denunciar.
