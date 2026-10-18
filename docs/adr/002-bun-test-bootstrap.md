# ADR 002 — Bun Test e bootstrap sem gameplay

- Estado: aceita conforme solicitação do proprietário.
- Data: 2026-10-17.

> Registro histórico do bootstrap. As versões e a exceção de tooling abaixo foram atualizadas pela [ADR 003](003-biome-current-dependencies.md).

## Decisão

Usar Bun Workspaces sem Turborepo e Bun Test para unitários/integração, substituindo o default anterior de Vitest. Manter fast-check para propriedades e Playwright para navegador. O ambiente React usa Happy DOM e Testing Library num processo separado dos testes sem DOM.

Fixar Bun em 1.3.5, versão disponível e validada no bootstrap, e versões diretas das dependências no único `bun.lock`. TypeScript e ESLint usam versões compatíveis com seus peers; o bootstrap não exige instalar as versões mais recentes de cada ferramenta.

Criar configurações, pastas e testes do ambiente sem implementar regras, contratos de jogo, UI React ou servidor de produto. O build web contém somente o HTML de montagem; fixtures em testes não são endpoints do produto. Não criar comandos vazios nem aceitar ausência de testes como sucesso. Adicionar exports e entrypoints dos pacotes quando a implementação existir.

## Exceção de tooling

O instalador de browsers Playwright sob Bun 1.3.5 falhou com `ERR_TLS_CERT_ALTNAME_INVALID` num redirecionamento do CDN. A instalação com Node 24 funcionou mantendo TLS validado. O script de instalação usa Node explicitamente; desenvolvimento, lint, tipos, build e runners usam Bun. Reavaliar a exceção ao atualizar Bun, sem fallback oculto ou desativação de certificados.

## Consequências

O setup tem verificações executáveis desde o início, com ambientes separados de produção e testes. Cobertura de ambiente não comprova gameplay nem multiplayer. CI está configurado, mas não foi executado remotamente. Compatibilidade de Safari/iOS permanece para validação futura.
