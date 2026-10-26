# Card numeral five

`build-card-five.py` generates `apps/web/public/fonts/ManilhaCardNumerals.ttf` from Pixelify Sans weight 700. The file contains only U+0035, preserving horizontal advance (603 units), height, baseline and stroke thickness from the original font. Only the five outline changes: flat top, continuous left stem and lower section matching other numerals' steps.

The derivative uses a different family name and preserves the source credits/SIL OFL 1.1 license. The complete license accompanies the font at `apps/web/public/fonts/OFL-PixelifySans.txt`. CSS applies the derivative only to rank 5 on card faces; all other characters retain the original font.

To regenerate in a Python environment with `fonttools==4.60.2`:

```sh
python3 tooling/fonts/build-card-five.py
```

Generation is an asset-authoring task; the browser does not depend on Python. After changing the outline, compare it beside 2, 4 and 6 on desktop/mobile.
