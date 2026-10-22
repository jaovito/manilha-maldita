# Menu layers — Manilha Maldita

Assets generated with integrated ImageGen from `../menu-reference-plate.png`, preserving the existing reference. Power illustrations also use the user-provided card reference. Transparent PNGs were separated through rectangular CoreGraphics (Swift) crops; `sips` reduced only final resolution while preserving alpha. Felt repeats on both axes; other elements retain individual aspect ratios/anchors. Previous originals were preserved.

- `felt.png`: repeating texture.
- `corner-{nw,ne,sw,se}.png`: four independent corners.
- `crest-{top,left,right,bottom}.png`: four crest segments.
- `candle.png`, `mate.png`, `coins.png`, `deck.png`: separate props.
- `seven-hearts.png`, `ace-spades.png`: decorative cards extracted from the reference and animated separately.
- `logo.png`: Manilha Maldita branding derived from the previous logo.
- `powers.png`: 2×2 illustration atlas ordered Espião, Segunda Chance, Impulso, Máscara. Text/costs remain HTML.

Audio: existing original Web Audio synthesis without new files or autoplay. Decorative cards animate only CSS transforms; reduced motion removes animations. Images receive no game data.

## Final prompts

### Decorative cards

Extract and reconstruct ONLY the two face-up playing cards in lower left of attached existing game background. Preserve exactly the warm parchment filigree, thick navy outlines, corner rank and suit, gold shadow details and chunky pixel art. Produce a transparent landscape atlas of TWO equal square cells. Left cell contains a single UPRIGHT straight-on 7 of HEARTS card; right cell contains single UPRIGHT straight-on ACE of SPADES. Each card portrait 2:3, centered with transparent margin. Remove rotation, overlaps and background; complete hidden portions. No new objects or text. Real alpha. These will be individually positioned and animated by the game.

### felt

Requested transparency: no.

Extract and reconstruct ONLY the emerald green felt texture from the empty center of this exact reference. Square seamless repeating tile, uniform lighting, same grain, pixel density, green color and material. No vignette, ornament, objects, logo or text. All edges seamlessly tile. Do not redesign the texture.

### corners

Requested transparency: yes.

Extract and reconstruct the FOUR diagonal wooden corner pieces from this exact reference as one production square 2x2 sprite atlas. Preserve the same warm chunky pixel art, plank geometry, orange highlights, burgundy shadows and angles. Each equal cell contains only one triangular wooden corner anchored to its matching corner: NW, NE, SW, SE in reading order. Remove all props/cards/coins/candle/gourd, UI, felt and ornaments, leaving real transparent alpha on the inner diagonal half of each cell. Separate cells with clear transparent gaps; no other objects. Keep this game's existing identity exactly.

### crest

Requested transparency: yes.

Extract ONLY the green embroidered central table symbol from this exact reference. Remove all other elements and felt; true transparent background. Reconstruct the interrupted hidden portions matching the existing pixels. Preserve precisely its octagonal outline, diamond spade side emblems, curled flourishes and top/bottom cross-like green motifs, same low contrast jade palette. A centered tall rectangular crest around an entirely empty transparent center, no words or logo. Leave margin and gaps at diagonal joins so four parts top/left/right/bottom can be cropped separately.

### logo

Requested transparency: yes.

Edit ONLY the game logo from this reference into an isolated transparent asset. Keep its crown, golden orange block pixel letters with thick navy outlines, red ribbon, four red/navy suits, gold flourishes, pixel density and craftsmanship. Replace top text TRUCO with exact "MANILHA", and ribbon text com PODERES with exact "MALDITA". No table, UI or other props. Compact centered wide logo, true alpha background.

### props

Requested transparency: yes.

Extract and reconstruct the original objects from this exact reference into a square 2x2 transparent sprite atlas, four equal cells, no overlap and generous transparent padding. Upper left: original lit candle and brass holder without wood base. Upper right: original mate gourd and metal straw, no cloth or wood. Lower left: original brass coins in small loose cluster. Lower right: original stacked navy-backed parchment cards. Preserve original pixel density, warm light, shapes, motifs, palette, thick outlines. Fully reconstruct cropped silhouettes. No background or text; real transparent alpha.

### powers

Requested transparency: no.

Use attached image 1 as the game's art identity reference and image 2 as the requested four power illustration reference. Create square 2x2 atlas of four square central illustrations without frames, words or numbers. Match the eye compass (upper left BLUE), gold card exchange arrows (upper right GREEN), winged brown boot with fire trails (lower left RED), ivory mask with colorful feathers (lower right PURPLE) in image 2, rendered with the pixel density, navy outlines and warm gold parchment craftsmanship of image 1. All centered, no borders, no UI, no text. Equal cells without gaps, dark jewel backgrounds.


### Animated flame

`MenuScenery` renders `candle.png` once without cropping. A local SVG filter gently displaces the upper flame; an intensity mask reduces the effect to zero above the wick. Wax/holder remain intact. The halo retains its subtle CSS cycle. There is no new image, GIF or JavaScript loop. Reduced motion disables the filter/animated halo. This replaces the two complementary crops that exposed a seam during motion.

## Borders restored from the previous reference

`border-nw.png`, `border-ne.png`, `border-sw.png` and `border-se.png` visually replace simple corners; `corner-*` files remain preserved. Generated with integrated ImageGen directly from the previous-layout screenshot attached by the user on 2026-10-18 (`codex-clipboard-9d9d874f-0533-4498-91eb-57411c932005.png`). Requested transparency: **yes**. The 1254×1254 atlas was separated into four 627×627 CoreGraphics crops preserving alpha. Wood/fabric form each corner; decks, coins, mate gourd, candle, cards, felt and crest remain independent layers. Existing logo preserved.

Final prompt:

> Asset type: production pixel art game environment sprite atlas. Use the attached OLD MENU as exact style and geometry reference. Extract/reconstruct ONLY the rich wooden diagonal border pieces and red patterned cloth from the four corners. Output square 2x2 equal cell atlas, NW NE SW SE in reading order. Each cell: rich broad diagonal planks anchored at the matching outer corner, triangular silhouette with jagged staggered plank ends pointing inward, warm burnt orange beveled highlights, black/navy outlines, intricate wood grain and scratches, dark burgundy shadows. NW broad diagonal tavern wood and small wooden ledge for candle at left; NE diagonal wood partly draped with original red-and-black woven cloth; SW broad worn diagonal wooden planks; SE diagonal wooden planks and red patterned cloth on right. These are NOT thin L-shaped picture frames: substantial irregular diagonals as in reference. Preserve the dense tactile pixel art craftsmanship and original palette. Remove green felt completely: inner empty portion of each cell must have true transparent alpha, also transparent gaps between separate cells. NO cards, coins, candle, cup, logo, interface, words or symbols; props will be separate movable layers. Each piece fills outer edges of its cell and occupies approximately half the cell diagonally. No checkerboard painted into pixels.

Motion correction: the image now renders inside SVG with a 477×512 viewBox and art-coordinate filter, avoiding sizing ambiguity from applying SVG filters to HTML images. Native SVG primitives build the mask without external feImage. The 1.6 s cycle displaces the tip and reconstructs the remainder from the original source; no rigid cut separates moving parts. A browser test compares pixels from two frames with the halo paused.

## Complete cards matching the reference (2026-10-18)

`power-card-spy.png`, `power-card-exchange.png`, `power-card-boost.png` and `power-card-mask.png`: artwork generated with **integrated ImageGen**, using `codex-clipboard-5ece2481-a2fe-4812-ace5-238a5659aa5c.png` as reference. Alpha requested. A 1024×1536 atlas was cropped through CoreGraphics into four 464×696 images at origins (32,40), (528,40), (32,752), (528,752). Empty ribbon, capsule and parchment receive HTML text; seals belong to the artwork. Previous atlas preserved.

Final prompt:

> Precisely reconstruct the FOUR POWER CARDS in the attached reference as production game assets. Preserve the actual reference layout and pixel art, not a redesign: thick intricate GOLD CORNER FILIGREE jewel frames; curved parchment scroll title ribbon near top with folded tails; dark gold-rimmed cost capsule upper left just below title; large illustrated center; parchment effect box filling bottom quarter; round gold-rimmed seal overlapping bottom center. Cards: BLUE eye in golden compass with blue starburst, GREEN two cards with circling gold arrows, RED winged brown boot with orange speed streaks, PURPLE ivory masquerade mask with purple/green/red feathers. Correct bottom seals respectively eye, circular arrows, upward arrow, masquerade mask. Important: remove ALL lettering and numbers. Title scrolls and bottom parchment effect panels are completely blank, cost capsules empty (no bolt or digit) for HTML overlay later. Keep artwork central subject clear of upper-left cost capsule. Deliver ONE 2x2 atlas, equal rectangular cells, reading order blue green red purple. Each card portrait exactly 2:3, aligned in matching cell with minimal transparent margin, same scale, all four full silhouettes including seal. Overall canvas portrait ratio2:3 with two columns and two rows. Real alpha outside cards, no background, no text, no diagram labels, no logo, no table. Match reference colors, frame decoration, parchment texture, chunky pixel craft and proportions faithfully. Art window approximately y18%-70%, title y5%-15%, cost x5%-33% y17%-30%, effect y73%-93%, seal y90%-100%.

## Hooded Espião

`power-card-spy-character.png`: generated with integrated ImageGen using attachment `codex-clipboard-b301b3db-141e-4059-91a4-4c274102a255.png` as primary reference and `power-card-spy.png` for identity. Requested transparency: yes. Previous art preserved. Title, effect and cost remain HTML, with specific positions for the central medallion/right capsule.

Exact prompt:

> Create a single complete production pixel art ESPIONAGE power card asset for Manilha Maldita, portrait aspect ratio 2:3, closely following reference image 1 (the cloaked spy card). Reference image 2 is the existing game's card template, for consistent outer dimensions and gold/navy palette only. Replace the giant eye illustration with the mysterious cartoon spy in reference 1: huge dark navy broad-brim hat with burgundy band and warm orange edge, face mostly concealed by navy cloak, one visible mischievous white eye, gloved hand holding three cream/red playing cards on lower right. Chunky clearly visible square pixels, bold dark outlines, simple retro 16-bit character, NOT realistic. Ornate gold/navy rectangular frame. Blank curved parchment title scroll at x10%-90%, y5%-15%. Spy illustration fills x8%-92%, y18%-64%. Gold eye medallion centered at x50%, y65%, overlapping illustration and parchment. Blank cream parchment description panel at x9%-91%, y71%-90%. Empty dark navy gold-edged energy capsule INSIDE right edge, x70%-96%, y57%-69%. NO TEXT, NO LETTERS, NO NUMBERS, NO lightning inside capsule: live HTML will supply title, description and energy. Keep all elements within image bounds. True transparent background outside card silhouette, no surrounding table or props. Beautiful warm gold highlights and navy blue interior with small gold stars. Match reference 1's layout and coarse pixel character closely.
