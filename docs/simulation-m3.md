# Simulação inicial do M3

Execução local: `bun run simulate 30`. Versão das regras: `m3-v1`. Amostras e políticas são sintéticas, sem dados de jogadores. Cada linha contém 30 cenários independentes, dois arranjos de assentos/equipes e braços com/sem poderes: 120 partidas por linha, 1.440 partidas no total.

Embaralhamento e poderes usam fluxos independentes por mão; decisões usam outro fluxo. A comparação mantém a distribuição do mesmo número de mão entre braços. Duração é contada em decisões, não minutos. As políticas recebem somente sua projeção e podem reagir a trocas, cartas públicas e informação do Espião.

| Formato | Preset | Política | Mãos médias | Decisões médias | Vitória do iniciador | Diferença pareada com poderes (IC 95% aprox.) |
|---|---|---|---:|---:|---:|---|
| 1v1 | casual | conservative | 20.3 | 163.3 | 53.3% | +16.7 pp [-2.3; +35.7] |
| 1v1 | casual | aggressive | 1.3 | 14.1 | 40.0% | +0.0 pp [-9.4; +9.4] |
| 1v1 | casual | probabilistic | 3.0 | 29.8 | 53.3% | +20.0 pp [+2.7; +37.3] |
| 1v1 | competitive | conservative | 20.0 | 159.3 | 40.0% | +3.3 pp [-8.1; +14.8] |
| 1v1 | competitive | aggressive | 1.4 | 14.7 | 40.0% | +0.0 pp [+0.0; +0.0] |
| 1v1 | competitive | probabilistic | 3.1 | 30.0 | 56.7% | +23.3 pp [+5.3; +41.4] |
| 2v2 | casual | conservative | 19.9 | 290.0 | 40.0% | -8.3 pp [-26.0; +9.3] |
| 2v2 | casual | aggressive | 1.2 | 20.0 | 53.3% | +0.0 pp [+0.0; +0.0] |
| 2v2 | casual | probabilistic | 1.9 | 30.5 | 38.3% | -3.3 pp [-21.5; +14.8] |
| 2v2 | competitive | conservative | 20.1 | 290.4 | 46.7% | -1.7 pp [-18.3; +14.9] |
| 2v2 | competitive | aggressive | 1.1 | 19.1 | 50.0% | -3.3 pp [-12.7; +6.0] |
| 2v2 | competitive | probabilistic | 2.0 | 31.4 | 43.3% | +1.7 pp [-14.9; +18.3] |

O intervalo normal aproximado usa o cenário pareado como unidade, sem tratar as duas permutações como amostras independentes. É uma verificação exploratória pequena: intervalos amplos ou degenerados não demonstram ausência de efeito. A taxa de 50% não comprova simetria posicional nem equilíbrio individual dos poderes.

O JSON da ferramenta inclui contagens separadas de poderes atribuídos e usados por estrato. Uso é seleção da política; não é estimativa causal do poder individual. A diferença pareada estima o efeito do conjunto habilitado sobre a vitória do iniciador sob essas políticas. Não foi estimado efeito marginal individual de cada poder. Não houve alteração automática de custos, sorteios ou regras com base nos resultados.

Playtests com pessoas, blefe, cooperação, clareza, frustração, duração em minutos e intenção de revanche permanecem no M4. As seeds sintéticas são entradas locais de reprodução; o relatório público não contém estado privado ou seeds de partidas reais.
