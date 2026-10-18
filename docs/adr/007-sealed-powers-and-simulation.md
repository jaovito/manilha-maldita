# ADR 007 — Poderes selados e simulação do M3

Status: implementado. Data: 18/10/2026.

## Decisão

Poderes são um submódulo puro do core. `PowerSetup` recebe amostras inteiras limitadas do adaptador confiável: sorteio, permutação por equipe e índice de Espião têm amostras separadas. O servidor usa seu gerador criptográfico uniforme existente. O índice privado do Espião é amostrado no início da mão e aplicado somente depois das trocas; como as mãos finais têm três cartas, continua uniforme e não depende da chegada de comandos. O monte já embaralhado fornece as substituições sem reposição. Nenhum comando de jogador solicita entropia adicional.

Na preparação, `PREPARE` sela um compromisso válido ou passe. A revisão avança, mas a aplicação aceita os demais compromissos pela mesma partida/decisão e assento ainda pendente, sem exigir a revisão anterior. O deadline e o ID não são reiniciados por compromisso. As projeções mostram somente pronto, com energia e uso ainda intactos. Ao fechar o lote, o core remove as cartas escolhidas, repõe a partir do iniciador, resolve Espião e confirma gastos/usos de uma só vez. Timeout sela passe somente dos pendentes. Desconexões de quem já respondeu não pausam a preparação.

`PLAY_CARD` carrega Impulso/Máscara junto à carta. A validação antecede remoção e gasto. Impulso muda a comparação, preservando identidade e classe comum; Máscara recebe representação sem carta até uma vaza completa. Históricos resolvidos revelam Máscara, enquanto corrida/término sem resolução mantém seu valor oculto. O resultado privado do Espião é uma observação da mão final na preparação, não um identificador reutilizado para rastrear a carta.

Após a mudança de visibilidade solicitada pelo proprietário, o snapshot inclui uma allowlist de energia, pronto, uso e ativações públicas. A atribuição do poder é privada ao dono; outros assentos, inclusive o parceiro, recebem `power: null` até uma ativação pública aceita na mão. Fim da mão/partida e reconexão não revelam poderes nunca usados; somente o destinatário recebe seu resultado de Espião. Compromissos, amostras, descartes e monte nunca entram no protocolo. Snapshots completos mantêm as ativações antes da representação das jogadas, sem depender de animação ou ACK do navegador.

`game-sim` executa o mesmo core e entrega somente `PlayerView` às três políticas. Embaralhamento, sorteio e decisões têm fontes independentes e reproduzíveis; cada mão usa um fluxo de distribuição próprio para manter comparações pareadas apesar de trajetórias divergentes. Cada cenário roda com/sem poderes e troca assentos/equipes. Os resultados agregam incerteza por par e distinguem atribuições de usos seletivos. Isso não é um bot de produção nem prova de equilíbrio.

## Compatibilidade e limites

A API interna do core sem `PowerSetup` continua disponível para regressões de regras-base e o braço de controle das simulações. Não constitui uma modalidade de produto: todas as salas do servidor iniciam com poderes nos dois presets. Uma partida habilitada exige novo setup em cada mão comum; mãos especiais não solicitam sorteio nem regeneram energia.

A configuração casual acrescenta preparação de 1–120 segundos, com default de 15; competitivo normaliza para 10. O campo ausente em uma entrada antiga recebe o default no schema. A UI oferece os valores de playtest 10/15/30 segundos. Não foi alterado custo, teto, catálogo ou regra de jogo.

Estado, compromissos e trilha privada continuam apenas em memória, sob a mesma fila por sala. Reinício não é recuperável e não registra derrota. Não há persistência, deploy ou analytics externo neste marco. Os dados sintéticos de simulação não contêm sessões de jogadores; seeds reais do servidor não são exportadas nem reutilizadas.
