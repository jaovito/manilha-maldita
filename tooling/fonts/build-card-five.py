"""Derive the card-only five from Pixelify Sans Bold, preserving its metrics."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter

root = Path(__file__).resolve().parents[2]
fonts = root / 'apps/web/public/fonts'
font = instantiateVariableFont(TTFont(fonts / 'PixelifySans.ttf'), {'wght': 700})
name = font.getBestCmap()[ord('5')]
# Keep the original 603-unit advance, 127/137-unit strokes and stepped lower bowl.
# The flat cap and uninterrupted left stem distinguish five from the original S.
points = [(149,-11),(149,74),(61,74),(61,211),(188,211),(188,125),
          (414,125),(414,246),(61,246),(61,638),(542,638),(542,501),
          (188,501),(188,381),(453,381),(453,297),(542,297),(542,74),
          (453,74),(453,-11)]
pen = TTGlyphPen(None)
pen.moveTo(points[0])
for point in points[1:]:
    pen.lineTo(point)
pen.closePath()
font['glyf'][name] = pen.glyph()
options = Options()
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = Subsetter(options=options)
subsetter.populate(text='5')
subsetter.subset(font)
for record in font['name'].names:
    value = {1:'Manilha Card Numerals', 2:'Bold', 3:'ManilhaCardNumerals-Bold-1',
             4:'Manilha Card Numerals Bold', 6:'ManilhaCardNumerals-Bold',
             16:'Manilha Card Numerals', 17:'Bold'}.get(record.nameID)
    if value:
        record.string = value.encode(record.getEncoding())
font.save(fonts / 'ManilhaCardNumerals.ttf')
