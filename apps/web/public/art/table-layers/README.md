# Mesa da partida em camadas

Assets gerados pela ferramenta ImageGen integrada, usando **`../tabletop.png`** como referência direta. O original permanece preservado. Não contêm dados ou textos de partida.

| Arquivo | Uso |
|---|---|
| `wood.png` | Piso de madeira escura repetido a 512 px, sem esticar com o viewport |
| `rail.png` | Moldura octogonal de madeira, filetes de ouro e oito ferragens; centro/exterior transparentes |
| `ornament.png` | Arabesco com naipe de paus, repetido/espelhado nas laterais e girado no topo/rodapé |
| `cloth.png` | Tecido verde/navy com brocado dourado e franjas, ancorado individualmente nos quatro cantos |

`../layers/felt.png` fornece o feltro repetível a 320 px. Vela, moedas, chimarrão e dois montes de cartas reutilizam os sprites transparentes de `../layers/`, cada um com posição/proporção própria. A vela usa `shared/ScenicCandle`, compartilhado com o menu, sem cortar o sprite e com deslocamento restrito à ponta da chama. Movimento reduzido desliga filtro e halo animado.

## Composição

`Table/Scenery` não recebe estado da partida. Toda a árvore é `aria-hidden`, sem controles e com `pointer-events: none`. A ordem é piso → feltro recortado → tecidos/objetos dos cantos → moldura → arabescos. A moldura usa `border-image` em nove partes (cortes 350/400/400/400 no original 1536×1024); o miolo não é pintado. Cantos preservam detalhe e somente os trechos retos se alongam. Variáveis CSS controlam a largura dos cantos e dos objetos por viewport. Não substituir por `background-size: 100% 100%` de uma cena inteira.

## Prompts utilizados

### Moldura (`rail.png`, edição com alpha)

> Edit target: supplied tabletop.png original game background. Extract and faithfully reconstruct ONLY the heavy octagonal wooden table frame, with its rich carved warm brown wood grain, dark navy exterior beveled thickness, narrow multiple gold inner rails, and eight ornate gold diamond brass corner fittings EXACTLY in original pixel-art style. Remove ALL green felt, gold felt drawings, floor, candle, coins, cloth, cards and other objects. BOTH center and exterior must be genuinely transparent. Frame alone fully visible centered with about 10 pixel transparent outer margin. Landscape 1536x1024 canvas, same octagonal proportions as original: straight top and bottom horizontal rails, straight left and right vertical rails, substantial 45degree diagonals joining them. Top rail begins at x~350 ends1180; left rail x~70 y~290to650; bottom rail y~940. Preserve dense illustrated highlights, corners, patina and detail; not simplified vector, no text. This is a production nine-slice game UI frame, large transparent central opening. Do not draw any felt or gold filigree inside opening.

### Arabesco (`ornament.png`, geração com alpha)

> Reference supplied original tavern game tabletop. Generate ONE isolated ornate gold embroidered vertical felt ornament sprite, strictly faithful to the LEFT SIDE inner felt gold ornament in reference: a warm antique gold club suit in the middle, tiny diamond and plus accents, long symmetrical curling filigree flourishes extending above and below with small leaf forms and fine broken pixel-gold stitching. Tall narrow vertical composition, about 1:4 ratio, generous transparent margin, truly transparent background throughout holes and outside. Only the delicate flat GOLD PIXEL embroidery, no green felt, no wood, no frame, no shading backdrop, no lettering. Preserve elaborate hand-crafted 16-bit pixel clusters and warm muted gold shades. It will be mirrored on the right side and rotated across top/bottom of a modular green table. Detail must be at least as rich as original, not a minimalist logo.

### Piso (`wood.png`, geração opaca)

> Reference image for style: existing Manilha Maldita tabletop. Generate one SEAMLESS TILEABLE square texture of dark aged tavern WOODEN PLANKS matching the wooden floor visible outside this table. Top-down flat orthographic view. Horizontal staggered planks, richly illustrated 16-bit pixel art with clearly visible square pixel clusters, deep umber browns and nearly black navy seams, subtle warm orange worn edges and little knots. Dense detailed wood grain as original, very dark low contrast so UI remains focal. Texture only edge to edge, evenly lit and repeats seamlessly on both axes. NO table, green felt, golden borders, cards, candle, props, cloth, text, vignette, perspective or cast shadows. 1024 square.

### Tecido (`cloth.png`, geração com alpha)

> Reference: supplied Manilha Maldita pixel-art table background. Create ONE independent decorative cloth corner sprite matching the elaborately patterned dark navy/emerald and muted gold brocade cloth seen at upper left and lower left of reference. Top down, roughly triangular draped textile occupying the top-left corner of a square canvas, irregular diagonal fringed edge running from top-right towards bottom-left, empty transparent bottom-right. Dense woven gold card-suit arabesque motifs, emerald and near-black navy fabric folds, golden tassels along diagonal lower edge, crisp rich 16-bit pixel art. Real alpha transparent outside cloth. NO wood, furniture, cards, candle, coins, lettering, backdrop or other objects. Complete cloth patch with folds and ornamental trim, not minimalist. It will be independently anchored behind the game's candle/cards at viewport corners.
