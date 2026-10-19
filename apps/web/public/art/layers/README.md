# Camadas do menu — Manilha Maldita

Assets gerados com ImageGen integrado a partir de `../menu-reference-plate.png`, mantendo a referência existente. Ilustrações dos poderes também usam a referência de cartas fornecida pelo usuário. Os PNGs com transparência foram separados com recortes retangulares via CoreGraphics (Swift); `sips` reduziu apenas a resolução final, preservando alpha. Feltro repete em ambos os eixos; elementos restantes mantêm proporção e âncoras próprias. Os originais anteriores foram preservados.

- `felt.png`: textura repetível.
- `corner-{nw,ne,sw,se}.png`: quatro cantos independentes.
- `crest-{top,left,right,bottom}.png`: quatro segmentos do símbolo.
- `candle.png`, `mate.png`, `coins.png`, `deck.png`: objetos separados.
- `seven-hearts.png`, `ace-spades.png`: cartas decorativas extraídas da referência, animadas separadamente.
- `logo.png`: marca Manilha Maldita, derivada da logo anterior.
- `powers.png`: atlas 2×2 de ilustrações, ordem Espião, Segunda Chance, Impulso, Máscara. Texto e custos continuam HTML.

Áudio: síntese Web Audio própria já existente, sem novos arquivos ou autoplay. Cartas decorativas animam apenas transformações CSS; movimento reduzido remove animações. Imagens não recebem dados de jogo.

## Prompts finais

### Cartas decorativas

Extract and reconstruct ONLY the two face-up playing cards in lower left of attached existing game background. Preserve exactly the warm parchment filigree, thick navy outlines, corner rank and suit, gold shadow details and chunky pixel art. Produce a transparent landscape atlas of TWO equal square cells. Left cell contains a single UPRIGHT straight-on 7 of HEARTS card; right cell contains single UPRIGHT straight-on ACE of SPADES. Each card portrait 2:3, centered with transparent margin. Remove rotation, overlaps and background; complete hidden portions. No new objects or text. Real alpha. These will be individually positioned and animated by the game.

### felt

Transparência solicitada: não.

Extract and reconstruct ONLY the emerald green felt texture from the empty center of this exact reference. Square seamless repeating tile, uniform lighting, same grain, pixel density, green color and material. No vignette, ornament, objects, logo or text. All edges seamlessly tile. Do not redesign the texture.

### corners

Transparência solicitada: sim.

Extract and reconstruct the FOUR diagonal wooden corner pieces from this exact reference as one production square 2x2 sprite atlas. Preserve the same warm chunky pixel art, plank geometry, orange highlights, burgundy shadows and angles. Each equal cell contains only one triangular wooden corner anchored to its matching corner: NW, NE, SW, SE in reading order. Remove all props/cards/coins/candle/gourd, UI, felt and ornaments, leaving real transparent alpha on the inner diagonal half of each cell. Separate cells with clear transparent gaps; no other objects. Keep this game's existing identity exactly.

### crest

Transparência solicitada: sim.

Extract ONLY the green embroidered central table symbol from this exact reference. Remove all other elements and felt; true transparent background. Reconstruct the interrupted hidden portions matching the existing pixels. Preserve precisely its octagonal outline, diamond spade side emblems, curled flourishes and top/bottom cross-like green motifs, same low contrast jade palette. A centered tall rectangular crest around an entirely empty transparent center, no words or logo. Leave margin and gaps at diagonal joins so four parts top/left/right/bottom can be cropped separately.

### logo

Transparência solicitada: sim.

Edit ONLY the game logo from this reference into an isolated transparent asset. Keep its crown, golden orange block pixel letters with thick navy outlines, red ribbon, four red/navy suits, gold flourishes, pixel density and craftsmanship. Replace top text TRUCO with exact "MANILHA", and ribbon text com PODERES with exact "MALDITA". No table, UI or other props. Compact centered wide logo, true alpha background.

### props

Transparência solicitada: sim.

Extract and reconstruct the original objects from this exact reference into a square 2x2 transparent sprite atlas, four equal cells, no overlap and generous transparent padding. Upper left: original lit candle and brass holder without wood base. Upper right: original mate gourd and metal straw, no cloth or wood. Lower left: original brass coins in small loose cluster. Lower right: original stacked navy-backed parchment cards. Preserve original pixel density, warm light, shapes, motifs, palette, thick outlines. Fully reconstruct cropped silhouettes. No background or text; real transparent alpha.

### powers

Transparência solicitada: não.

Use attached image 1 as the game's art identity reference and image 2 as the requested four power illustration reference. Create square 2x2 atlas of four square central illustrations without frames, words or numbers. Match the eye compass (upper left BLUE), gold card exchange arrows (upper right GREEN), winged brown boot with fire trails (lower left RED), ivory mask with colorful feathers (lower right PURPLE) in image 2, rendered with the pixel density, navy outlines and warm gold parchment craftsmanship of image 1. All centered, no borders, no UI, no text. Equal cells without gaps, dark jewel backgrounds.


### Chama animada

`MenuScenery` renderiza `candle.png` uma única vez, sem recortes. Um filtro SVG local aplica deslocamento suave à parte superior da chama; uma máscara de intensidade reduz o efeito a zero acima do pavio. A cera e o suporte permanecem intactos. O halo mantém seu ciclo discreto em CSS. Não há nova imagem, GIF ou loop JavaScript. Movimento reduzido desativa o filtro e o halo animado. Essa implementação substitui os dois recortes complementares, que revelavam uma emenda durante o movimento.

## Bordas restauradas a partir da referência anterior

`border-nw.png`, `border-ne.png`, `border-sw.png` e `border-se.png` substituem visualmente os cantos simples; os arquivos `corner-*` continuam preservados. Gerados pelo ImageGen integrado usando diretamente a captura do layout anterior anexada pelo usuário em 18/10/2026 (`codex-clipboard-9d9d874f-0533-4498-91eb-57411c932005.png`). Transparência solicitada: **sim**. Atlas de 1254×1254 separado em quatro recortes de 627×627 via CoreGraphics, preservando alpha. Madeira e tecido compõem cada canto; baralhos, moedas, cuia, vela, cartas, feltro e símbolo continuam camadas independentes. Logo existente preservada.

Prompt final:

> Asset type: production pixel art game environment sprite atlas. Use the attached OLD MENU as exact style and geometry reference. Extract/reconstruct ONLY the rich wooden diagonal border pieces and red patterned cloth from the four corners. Output square 2x2 equal cell atlas, NW NE SW SE in reading order. Each cell: rich broad diagonal planks anchored at the matching outer corner, triangular silhouette with jagged staggered plank ends pointing inward, warm burnt orange beveled highlights, black/navy outlines, intricate wood grain and scratches, dark burgundy shadows. NW broad diagonal tavern wood and small wooden ledge for candle at left; NE diagonal wood partly draped with original red-and-black woven cloth; SW broad worn diagonal wooden planks; SE diagonal wooden planks and red patterned cloth on right. These are NOT thin L-shaped picture frames: substantial irregular diagonals as in reference. Preserve the dense tactile pixel art craftsmanship and original palette. Remove green felt completely: inner empty portion of each cell must have true transparent alpha, also transparent gaps between separate cells. NO cards, coins, candle, cup, logo, interface, words or symbols; props will be separate movable layers. Each piece fills outer edges of its cell and occupies approximately half the cell diagonally. No checkerboard painted into pixels.

Correção de movimento: a imagem agora é renderizada dentro de SVG com viewBox 477×512 e filtro em coordenadas da arte, evitando ambiguidades de tamanho ao aplicar filtros SVG a uma imagem HTML. A máscara é construída com primitivas SVG nativas, sem feImage externo. O ciclo de 1,6 s desloca a ponta e recompõe o restante a partir da fonte original; não há recorte rígido entre partes móveis. Teste de navegador compara pixels de dois quadros com o halo pausado.

## Cartas completas conforme referência (18/10/2026)

`power-card-spy.png`, `power-card-exchange.png`, `power-card-boost.png` e `power-card-mask.png`: arte gerada com **ImageGen integrado**, usando `codex-clipboard-5ece2481-a2fe-4812-ace5-238a5659aa5c.png` como referência. Alpha solicitado. Atlas 1024×1536 recortado com CoreGraphics em quatro imagens 464×696 nas origens (32,40), (528,40), (32,752), (528,752). Faixa, cápsula e pergaminho vazios recebem texto HTML; selos fazem parte da arte. Atlas anterior preservado.

Prompt final:

> Precisely reconstruct the FOUR POWER CARDS in the attached reference as production game assets. Preserve the actual reference layout and pixel art, not a redesign: thick intricate GOLD CORNER FILIGREE jewel frames; curved parchment scroll title ribbon near top with folded tails; dark gold-rimmed cost capsule upper left just below title; large illustrated center; parchment effect box filling bottom quarter; round gold-rimmed seal overlapping bottom center. Cards: BLUE eye in golden compass with blue starburst, GREEN two cards with circling gold arrows, RED winged brown boot with orange speed streaks, PURPLE ivory masquerade mask with purple/green/red feathers. Correct bottom seals respectively eye, circular arrows, upward arrow, masquerade mask. Important: remove ALL lettering and numbers. Title scrolls and bottom parchment effect panels are completely blank, cost capsules empty (no bolt or digit) for HTML overlay later. Keep artwork central subject clear of upper-left cost capsule. Deliver ONE 2x2 atlas, equal rectangular cells, reading order blue green red purple. Each card portrait exactly 2:3, aligned in matching cell with minimal transparent margin, same scale, all four full silhouettes including seal. Overall canvas portrait ratio2:3 with two columns and two rows. Real alpha outside cards, no background, no text, no diagram labels, no logo, no table. Match reference colors, frame decoration, parchment texture, chunky pixel craft and proportions faithfully. Art window approximately y18%-70%, title y5%-15%, cost x5%-33% y17%-30%, effect y73%-93%, seal y90%-100%.

## Espião encapuzado

`power-card-spy-character.png`: gerado com ImageGen integrado, usando o anexo `codex-clipboard-b301b3db-141e-4059-91a4-4c274102a255.png` como referência principal e `power-card-spy.png` como referência de identidade. Transparência solicitada: sim. Arte anterior preservada. Título, efeito e custo continuam em HTML, com posições específicas para o medalhão central e cápsula à direita.

Prompt exato:

> Create a single complete production pixel art ESPIONAGE power card asset for Manilha Maldita, portrait aspect ratio 2:3, closely following reference image 1 (the cloaked spy card). Reference image 2 is the existing game's card template, for consistent outer dimensions and gold/navy palette only. Replace the giant eye illustration with the mysterious cartoon spy in reference 1: huge dark navy broad-brim hat with burgundy band and warm orange edge, face mostly concealed by navy cloak, one visible mischievous white eye, gloved hand holding three cream/red playing cards on lower right. Chunky clearly visible square pixels, bold dark outlines, simple retro 16-bit character, NOT realistic. Ornate gold/navy rectangular frame. Blank curved parchment title scroll at x10%-90%, y5%-15%. Spy illustration fills x8%-92%, y18%-64%. Gold eye medallion centered at x50%, y65%, overlapping illustration and parchment. Blank cream parchment description panel at x9%-91%, y71%-90%. Empty dark navy gold-edged energy capsule INSIDE right edge, x70%-96%, y57%-69%. NO TEXT, NO LETTERS, NO NUMBERS, NO lightning inside capsule: live HTML will supply title, description and energy. Keep all elements within image bounds. True transparent background outside card silhouette, no surrounding table or props. Beautiful warm gold highlights and navy blue interior with small gold stars. Match reference 1's layout and coarse pixel character closely.
