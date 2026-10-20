# ADR 010 — Camadas explícitas de Clean Architecture no backend

- Estado: aceita; migração autorizada pelo proprietário.
- Data: 2026-10-20.
- Complementa: [ADR 001](001-bun-modular-architecture.md) e [ADR 006](006-room-authority-and-reconnection.md).

## Contexto

O motor de regras já era puro, mas a implementação do servidor concentrava armazenamento, execução de comandos, presença, publicação e timers em `RoomService`. O tipo da sala incluía conexões e fila; handlers HTTP/WS ficavam no bootstrap; sessões misturavam armazenamento e operações. A estrutura dificultava reconhecer a arquitetura aprovada e testar suas fronteiras.

## Decisão

Manter um monólito modular com Clean Architecture, organizado por funcionalidade. Ports e adapters expressam as fronteiras externas; não constituem uma arquitetura alternativa nem exigem um container de DI.

As responsabilidades são:

- `domain`: entidades, configurações e políticas sem protocolo de rede, runtime ou I/O. O domínio de cartas, mãos, vazas e partidas permanece em `packages/game-core`, representado por tipos e funções puras.
- `application/use-cases`: operações da aplicação, separadas por intenção. Coordenação compartilhada fica em `application/services`; contratos de entrada/saída em `application/ports`; dados de entrada e projeção em `application/dto`.
- `adapters/inbound`: validação/tradução das entradas e integração com HTTP/WS.
- `adapters/outbound`: implementações concretas de armazenamento em memória, credenciais, relógio, entropia, agendamento e envio por socket.
- `composition.ts` e `bootstrap`: montagem explícita; entradas públicas `index.ts` exportam os contratos e fábricas do módulo.

`rooms` mantém a autoridade de lobby e partida. `sessions` implementa identidade de convidado, emissão, consulta e alteração de apelido. `transport` contém os adaptadores HTTP/WS e proteções de rede. `matches` fornece políticas de relógio de decisão; não é um segundo escritor da partida.

O estado de domínio da sala é separado do envelope operacional que contém conexões, cache de respostas, fila, cancelamento de timers e sequência de snapshots. Os ports de repositório são específicos do consumidor. Não há repositórios genéricos nem modelos ORM sem persistência correspondente.

Dentro de `application`, organize primeiro por responsabilidade (`use-cases`, `services`, `ports`, `dto`, `state`) e depois por funcionalidade. Coordenação compartilhada de lobby, partida, bot e despacho fica sob `services`; projeções e erros de saída ficam em `dto/mappers`. Presença e preparação de entropia são comportamento de serviços, não estado. O reset de mão de desenvolvimento é uma operação em `use-cases/solo`. Não crie uma pasta genérica de auxiliares nem duplique as pastas de funcionalidades na raiz da aplicação.

### Consistência e limites dos repositórios

O repositório de salas armazena a autoridade viva em memória. Ele devolve a mesma instância operacional para preservar a fila por sala; não devolve cópias independentes de agregados. Portanto, não é substituível por um repository SQL de `load/save` sem rever a consistência e a recuperação. Esta migração não introduz persistência durável.

Todos os escritores, incluindo timers e bot, continuam passando pela fila da sala. A extração de casos de uso não cria locks, filas ou transações independentes. Identidade da conexão, cache de idempotência, revisão, contexto de decisão e identidade do callback preservam a ordem de validação existente.

Os DTOs internos pertencem à aplicação. O protocolo público permanece em `game-protocol`; schemas e serialização ficam nas bordas. Projeções continuam sendo construídas por allowlist e por destinatário. Compatibilidade estrutural de tipos não autoriza enviar estado privado.

### Verificação

O verificador de arquitetura bloqueia imports externos indevidos em domínio/aplicação, incluindo protocolo na aplicação, e chamadas diretas comuns de runtime nesses arquivos. O grafo local do servidor verifica ciclos e dependências indiretas de camadas internas para adaptadores/bootstrap, inclusive por reexports.

Essas verificações são complementadas por testes dos casos de uso e ports falsos, testes do motor e integração HTTP/WS real. A análise estática não prova todas as propriedades semânticas nem substitui testes de concorrência e privacidade. Não foram reduzidas as exigências de cobertura.

## Consequências

Casos de uso e adaptadores passam a ter caminhos reconhecíveis; regras e coordenação podem ser exercitadas sem servidor HTTP. A separação adiciona contratos específicos, mas preserva composição manual e funções quando classes não agregam comportamento.

Não há mudança de stack, regras, formato de mensagens, autenticação, persistência ou infraestrutura. Reiniciar o processo ainda perde salas e sessões. Deploy e push não fazem parte desta decisão.

## Referências

- [Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html): direção das dependências e separação entre regras, casos de uso e adaptadores.
- [Hexagonal Architecture — Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture): isolamento da aplicação por ports e adapters.
