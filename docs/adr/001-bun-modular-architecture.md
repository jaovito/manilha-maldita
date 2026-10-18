# ADR 001 — Bun e arquitetura modular

- Estado: aceita pelo proprietário.
- Data: 2026-10-17.
- Contrato vigente: [architecture.md](../architecture.md).

## Contexto

O projeto ainda está em pré-produção. O proprietário escolheu Bun para front/back e pediu Clean Architecture, DDD e SOLID onde forem úteis, com atenção a arquivos grandes e pastas difíceis de navegar.

## Decisão

Adotar Bun como gerenciador do monorepo, executor das ferramentas e runtime do backend. React/Vite entregam código para o navegador. Usar um `bun.lock` e fixar a versão de Bun no bootstrap.

Manter um monólito modular: funcionalidades agrupadas em módulos, aplicação e adaptadores separados, domínio de partida puro em `game-core` e contratos públicos em `game-protocol`. Montar dependências explicitamente e preservar uma autoridade por sala. Aplicar máquina de estados, ports e adapters, eventos e estratégias somente onde houver necessidade concreta.

Organizar o frontend por features, com estado do servidor separado de seleção e animação. Manter testes próximos do comportamento e verificar fronteiras de imports. Revisar arquivos acima de 300 linhas, extrair antes de ampliar perto de 450 e refatorar arquivos de 500 ou mais, salvo exceção justificada; reavaliar pastas com cerca de 15 arquivos.

## Consequências

O domínio pode ser testado e simulado sem Bun, HTTP ou navegador. Adaptadores concentram as integrações; a aplicação coordena efeitos e serialização. Evitar camadas vazias, interfaces sem consumidor e fragmentação mecânica exige revisão de coesão, além das métricas de tamanho.

O bootstrap deverá validar ferramentas sob Bun e implementar checks de fronteiras. Não há instalação, implementação ou testes de compatibilidade concluídos por esta decisão. O estado de partida em memória continua sem recuperação após queda do processo.
