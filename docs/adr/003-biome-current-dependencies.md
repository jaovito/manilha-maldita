# ADR 003 — Biome e dependências estáveis atuais

- Estado: aceita conforme solicitação do proprietário.
- Data: 2026-10-17.
- Atualiza as escolhas de ferramentas e versões da [ADR 002](002-bun-test-bootstrap.md).

## Decisão

Substituir ESLint, seus plugins e Prettier por Biome 2.5.15. Remover configurações e dependências anteriores, sem manter dois linters/formatadores. As restrições específicas de arquitetura passam para `tooling/architecture`, com parser Oxc 0.154.0, chamado por `bun run lint`. Manter regressões das fronteiras e acrescentar testes da configuração real de Biome.

Usar versões estáveis atuais das dependências diretas e fixá-las exatamente, com um único lockfile. Atualizar Bun para 1.4.3, TypeScript para 7.0.2, Vite para 8.3.4, plugin React para 6.1.2 e tipos Bun para 1.4.3. As demais dependências diretas já correspondiam às versões estáveis mais recentes publicadas no npm e foram conferidas novamente.

A API de compilador JavaScript das versões anteriores de TypeScript não está disponível no pacote 7.0.2 usado. O analisador de arquitetura usa a AST de Oxc para preservar verificação sintática sem prender o typecheck a TypeScript antigo. Oxc é usado somente como parser, não como segundo linter ou formatter.

## Consequências e validação

Lint, formatação, typecheck, testes e build continuam separados e executáveis. A apresentação da raiz fica fora da formatação; formatos não suportados pelo Biome, como Markdown/YAML nesta configuração, não recebem formatação automática.

A instalação completa dos browsers Playwright em cache vazio foi validada sob Bun 1.4.3, com TLS validado. Remover a antiga exceção de Node do instalador e do CI. O runtime Bun instalado localmente também foi atualizado pela ferramenta oficial de upgrade. CI continua configurado, sem execução remota confirmada.
