# Table interface — tavern

Original decorative pieces generated with integrated `image_gen` on 2026-10-19 from the user-approved 2v2 mockup. No embedded text or values: HTML retains language, accessibility and authoritative state.

- `crest.png`: blue crest with fabric wings and gold metal.
- `crest-enemy.png`: burgundy variant preserving gold metal.
- `ribbon.png`: burgundy ribbon with folded ends and gold embroidery.
- `ribbon-green.png`: green variant preserving gold embroidery.
- `parchment.png`: empty parchment, rolled edges and wooden support.
- `wood.png`: empty wooden plate with beveled corners and gold trim.

Production prompts: isolated 2D pixel-art interface pieces, front-facing, transparent background, no numbers, letters or symbols in the central area. Blue crest with empty center/lateral wings; burgundy ribbon with 70% empty center, folded ends and embroidery only at the ends; vertical parchment with 80% clear center for text; horizontal walnut plate with 80% empty dark center. Variants change only blue to burgundy and burgundy to green, preserving gold/silhouette. Reference: approved mockup `exec-ccf3c69a-a948-4243-a0b3-302c135cfb15.png`.

Usage: `Table/Theme` composes materials through CSS backgrounds/decorative layers without intercepting clicks. Standard cards, backs, power atlas and their aspect ratios were unchanged. The backend does not depend on these files.

Parchment uses its original 614×768 aspect ratio with uniform scaling and `image-rendering: pixelated`. Frame size follows the viewport rather than text volume; only the internal list scrolls. Do not scale axes independently or use border-image to stretch this piece.

Distribution: alpha PNGs resized to at most 768 px (crests/parchment) or 1024 px (ribbons/wood), approximately 2 MB total.
