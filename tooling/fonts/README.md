# Numeral cinco das cartas

`build-card-five.py` gera `apps/web/public/fonts/ManilhaCardNumerals.ttf` a partir de Pixelify Sans no peso 700. O arquivo contém somente U+0035, preservando avanço horizontal (603 unidades), altura, baseline e espessura dos traços da fonte original. Apenas o contorno do cinco muda: topo reto, haste esquerda contínua e parte inferior com os mesmos degraus dos outros números.

A derivação usa outro nome de família e preserva os créditos/licença SIL OFL 1.1 da origem. A licença completa acompanha a fonte em `apps/web/public/fonts/OFL-PixelifySans.txt`. O CSS aplica a derivação apenas ao valor 5 das faces das cartas; todos os outros caracteres continuam na fonte original.

Para regenerar, em um ambiente Python com `fonttools==4.60.2`:

```sh
python3 tooling/fonts/build-card-five.py
```

A geração é uma tarefa de autoria do asset; o navegador não depende de Python. Depois de modificar o contorno, conferir lado a lado com 2, 4 e 6 em desktop e celular.
