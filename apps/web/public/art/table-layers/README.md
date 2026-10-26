# Layered match table

Assets generated with integrated ImageGen using **`../tabletop.png`** as direct reference. The original remains preserved. They contain no match data or text.

| File | Usage |
|---|---|
| `wood.png` | Dark wooden floor repeating at 512 px without stretching to the viewport |
| `rail.png` | Octagonal wooden frame, gold trim and eight fittings; transparent center/exterior |
| `ornament.png` | Club-suit ornament, repeated/mirrored on the sides and rotated at top/bottom |
| `cloth.png` | Green/navy cloth with gold brocade/fringe, independently anchored at all four corners |

`../layers/felt.png` supplies repeating felt at 320 px. Candle, coins, mate gourd and two decks reuse transparent `../layers/` sprites, each with its own position/aspect ratio. The candle uses `shared/ScenicCandle`, shared with the menu, without cropping the sprite and with displacement restricted to the flame tip. Reduced motion disables the filter/animated halo.

## Composition

`Table/Scenery` receives no match state. Its entire tree is `aria-hidden`, without controls and with `pointer-events: none`. Order: floor → clipped felt → corner cloth/props → frame → ornaments. The frame uses nine-slice `border-image` (350/400/400/400 cuts in the 1536×1024 original); the center is not painted. Corners preserve detail and only straight segments stretch. CSS variables control corner/prop width per viewport. Do not replace this with `background-size: 100% 100%` applied to a complete scene.

## Production prompts

### Frame (`rail.png`, alpha edit)

> Edit target: supplied tabletop.png original game background. Extract and faithfully reconstruct ONLY the heavy octagonal wooden table frame, with its rich carved warm brown wood grain, dark navy exterior beveled thickness, narrow multiple gold inner rails, and eight ornate gold diamond brass corner fittings EXACTLY in original pixel-art style. Remove ALL green felt, gold felt drawings, floor, candle, coins, cloth, cards and other objects. BOTH center and exterior must be genuinely transparent. Frame alone fully visible centered with about 10 pixel transparent outer margin. Landscape 1536x1024 canvas, same octagonal proportions as original: straight top and bottom horizontal rails, straight left and right vertical rails, substantial 45degree diagonals joining them. Top rail begins at x~350 ends1180; left rail x~70 y~290to650; bottom rail y~940. Preserve dense illustrated highlights, corners, patina and detail; not simplified vector, no text. This is a production nine-slice game UI frame, large transparent central opening. Do not draw any felt or gold filigree inside opening.

### Ornament (`ornament.png`, alpha generation)

> Reference supplied original tavern game tabletop. Generate ONE isolated ornate gold embroidered vertical felt ornament sprite, strictly faithful to the LEFT SIDE inner felt gold ornament in reference: a warm antique gold club suit in the middle, tiny diamond and plus accents, long symmetrical curling filigree flourishes extending above and below with small leaf forms and fine broken pixel-gold stitching. Tall narrow vertical composition, about 1:4 ratio, generous transparent margin, truly transparent background throughout holes and outside. Only the delicate flat GOLD PIXEL embroidery, no green felt, no wood, no frame, no shading backdrop, no lettering. Preserve elaborate hand-crafted 16-bit pixel clusters and warm muted gold shades. It will be mirrored on the right side and rotated across top/bottom of a modular green table. Detail must be at least as rich as original, not a minimalist logo.

### Floor (`wood.png`, opaque generation)

> Reference image for style: existing Manilha Maldita tabletop. Generate one SEAMLESS TILEABLE square texture of dark aged tavern WOODEN PLANKS matching the wooden floor visible outside this table. Top-down flat orthographic view. Horizontal staggered planks, richly illustrated 16-bit pixel art with clearly visible square pixel clusters, deep umber browns and nearly black navy seams, subtle warm orange worn edges and little knots. Dense detailed wood grain as original, very dark low contrast so UI remains focal. Texture only edge to edge, evenly lit and repeats seamlessly on both axes. NO table, green felt, golden borders, cards, candle, props, cloth, text, vignette, perspective or cast shadows. 1024 square.

### Cloth (`cloth.png`, alpha generation)

> Reference: supplied Manilha Maldita pixel-art table background. Create ONE independent decorative cloth corner sprite matching the elaborately patterned dark navy/emerald and muted gold brocade cloth seen at upper left and lower left of reference. Top down, roughly triangular draped textile occupying the top-left corner of a square canvas, irregular diagonal fringed edge running from top-right towards bottom-left, empty transparent bottom-right. Dense woven gold card-suit arabesque motifs, emerald and near-black navy fabric folds, golden tassels along diagonal lower edge, crisp rich 16-bit pixel art. Real alpha transparent outside cloth. NO wood, furniture, cards, candle, coins, lettering, backdrop or other objects. Complete cloth patch with folds and ornamental trim, not minimalist. It will be independently anchored behind the game's candle/cards at viewport corners.
