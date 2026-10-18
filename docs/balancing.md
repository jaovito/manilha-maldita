# Balanceamento e simulação

Leia antes de criar simulações, interpretar métricas de equilíbrio ou propor ajustes. O contrato vigente está em [rules.md](rules.md); hipóteses não autorizam mudanças automáticas de produto.

## Balanceamento e simulação

Simule com o mesmo core e bots que enxergam apenas sua projeção. Use políticas conservadora, agressiva e probabilística, sem tratá-las como bots de produção.

Compare cenários pareados com distribuição inicial igual, fontes separadas de aleatoriedade e troca de assentos/equipes. Permita que a política reaja às novas observações; não force ações-base ilegais após um poder.

Registre versão, política, tamanho amostral, incerteza e seeds privadas. Diferencie efeito do poder sorteado de associação com uso seletivo. Vitória global de 50% em sorteio espelhado não prova equilíbrio.

Hipóteses: investigar viés de iniciador acima de 2 pontos percentuais ou efeito marginal acima de 5 em cenários comparáveis, sem ajuste automático. Separe 1v1/2v2, modalidade, posição e experiência.

Playtests humanos avaliam blefe, cooperação, clareza, frustração, poderes inutilizáveis e vontade de revanche. Simulação não valida diversão. Não adicione poderes extras para corrigir baixa utilização antes de medir.

## Ferramenta inicial do M3

Execute `bun run simulate <cenários-por-estrato> [seed-sintética]`. `game-sim` compara os dois formatos e presets sob políticas conservadora, agressiva e probabilística. Cada cenário tem braços com/sem poderes e permutação de assentos/equipes; streams independentes por mão preservam a mesma distribuição de cartas entre braços mesmo quando há mais decisões. A política pode reagir às trocas, jogadas públicas e informação do Espião pela sua projeção.

O JSON inclui versão, tamanho amostral, média de mãos/decisões, vitória do iniciador, diferença pareada e IC normal aproximado por cenário, além de contagens de poderes atribuídos e usados. A contagem de uso não identifica efeito causal individual. Não se estima duração em minutos, efeito marginal individual de cada poder ou diversão. Seeds sintéticas são parâmetros locais de reprodução, separados de seeds/entropia de partidas reais e omitidos dos relatórios agregados. Veja [a primeira execução](simulation-m3.md).
