"""Rebuild Elume Shop's vector mark and Android launchers (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / 'android/app/src/main/res'
VIOLET = '#7137C6'
INK = '#3D1858'
CREAM = '#FFF9F1'
CORAL = '#F58573'
# One geometry shared by SVG, Android VectorDrawable and raster launchers.
STROKES = [
    (VIOLET, [('M', 45, 49), ('L', 31, 63),
                 ('C', 26, 68, 26, 75, 31, 80), ('C', 36, 85, 43, 85, 48, 80),
                 ('L', 62, 66), ('C', 67, 61, 67, 54, 62, 49),
                 ('C', 57, 44, 50, 44, 45, 49)]),
    (CORAL, [('M', 60, 28), ('L', 46, 42),
              ('C', 41, 47, 41, 54, 46, 59), ('C', 51, 64, 58, 64, 63, 59),
              ('L', 77, 45), ('C', 82, 40, 82, 33, 77, 28),
              ('C', 72, 23, 65, 23, 60, 28)]),
    # Restore the white crossing on top so the rings visibly weave together.
    (VIOLET, [('M', 62, 49), ('C', 65, 52, 66, 56, 65, 60)]),
]
# Keep the entire mark inside Android's circular adaptive-icon safe zone.
STROKES = [(color, [(c[0], *(round(54+(n-54)*0.84, 3) for n in c[1:])) for c in commands]) for color, commands in STROKES]

def path(commands):
    return ' '.join(c[0] + ' '.join(str(n) for n in c[1:]) for c in commands)

paths = ''.join(f'<path d="{path(c)}" stroke="{color}"/>' for color, c in STROKES)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">'
       f'<rect width="108" height="108" rx="25" fill="{CREAM}"/>'
       f'<g fill="none" stroke-width="7.56" stroke-linecap="round" stroke-linejoin="round">{paths}</g></svg>')
(ROOT / 'elume-icon.svg').write_text(svg + '\n', encoding='utf-8')
vector = ('<vector xmlns:android="http://schemas.android.com/apk/res/android" '
          'android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">'
          + ''.join(f'<path android:fillColor="@android:color/transparent" android:strokeColor="{color}" '
                    f'android:strokeWidth="7.56" android:strokeLineCap="round" android:strokeLineJoin="round" '
                    f'android:pathData="{path(c)}"/>' for color, c in STROKES) + '</vector>\n')
(RES / 'drawable/elume_mark.xml').write_text(vector, encoding='utf-8')
(RES / 'values/ic_launcher_background.xml').write_text(
    f'<resources><color name="ic_launcher_background">{CREAM}</color></resources>\n', encoding='utf-8')
for name in ['ic_launcher', 'ic_launcher_round']:
    (RES / f'mipmap-anydpi-v26/{name}.xml').write_text(
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">'
        '<background android:drawable="@color/ic_launcher_background"/>'
        '<foreground android:drawable="@drawable/elume_mark"/>'
        '<monochrome android:drawable="@drawable/elume_mark"/></adaptive-icon>\n', encoding='utf-8')

def render(size, background=True, rounded=False):
    scale = size * 4 / 108
    im = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    if background:
        draw.rounded_rectangle((0, 0, size*4-1, size*4-1), radius=size*(0.92 if rounded else 0), fill=CREAM)
    for color, commands in STROKES:
        points = []
        for c in commands:
            if c[0] in ['M', 'L']:
                current = (c[1], c[2])
                points.append(current)
            else:
                x, y = current
                for i in range(1, 81):
                    t = i/80
                    u = 1-t
                    points.append((u**3*x+3*u*u*t*c[1]+3*u*t*t*c[3]+t**3*c[5],
                                   u**3*y+3*u*u*t*c[2]+3*u*t*t*c[4]+t**3*c[6]))
                current = (c[5], c[6])
        pixels = [(round(x*scale), round(y*scale)) for x, y in points]
        width = round(7.56*scale)
        draw.line(pixels, fill=color, width=width, joint='curve')
        for x, y in [pixels[0], pixels[-1]]:
            r = width/2
            draw.ellipse((x-r, y-r, x+r, y+r), fill=color)
    return im.resize((size, size), Image.Resampling.LANCZOS)

for density, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder = RES / f'mipmap-{density}'
    render(size, rounded=True).save(folder / 'ic_launcher.png')
    # A full square is masked by round launchers; explicit circle for older Android.
    circle = render(size)
    mask = Image.new('L', (size*4, size*4), 0)
    ImageDraw.Draw(mask).ellipse((0,0,size*4-1,size*4-1), fill=255)
    circle.putalpha(mask.resize((size,size), Image.Resampling.LANCZOS))
    circle.save(folder / 'ic_launcher_round.png')
    render(round(size*108/48), background=False).save(folder / 'ic_launcher_foreground.png')
render(512, rounded=True).save(ROOT / 'elume-icon.png')
print('Elume Shop: SVG, PNG 512, adaptive/themed and legacy Android icons generated.')

# Original rounded wordmark drawn as paths, without system fonts or downloads.
WORD = [
    [('M',43,54),('C',34,70,5,69,5,43),('C',5,17,43,16,43,41),('L',6,41)],
    [('M',65,5),('L',65,65)],
    [('M',88,24),('L',88,47),('C',88,73,124,73,124,47),('L',124,24)],
    [('M',148,65),('L',148,24)],
    [('M',148,38),('C',148,17,178,17,178,38),('L',178,65)],
    [('M',178,38),('C',178,17,208,17,208,38),('L',208,65)],
    [('M',272,54),('C',263,70,234,69,234,43),('C',234,17,272,16,272,41),('L',235,41)],
]
SHOP = [
    [('M',18,3),('C',9,-1,1,1,1,8),('C',1,16,19,12,19,21),('C',19,29,8,30,1,25)],
    [('M',33,1),('L',33,28)], [('M',52,1),('L',52,28)], [('M',33,14),('L',52,14)],
    [('M',77,1),('C',62,1,62,28,77,28),('C',92,28,92,1,77,1)],
    [('M',103,28),('L',103,1),('L',113,1),('C',128,1,128,16,113,16),('L',103,16)],
]

def moved(commands, x=0, y=0, scale=1):
    return [(c[0], *(round(n*scale+(x if i%2==0 else y),3) for i,n in enumerate(c[1:]))) for c in commands]

def logo_layers(vertical=False):
    # (color, width, commands); shapes are also exported to native Android.
    mx,my,ms = (79,-12,162/108) if vertical else (-20,0,180/108)
    tx,ty,ts = (23,120,1) if vertical else (135,22,1.25)
    sx,sy,ss = (110,220,.83) if vertical else (385,122,.86)
    return ([(c,7.56*ms,moved(p,mx,my,ms)) for c,p in STROKES]
            + [(INK,9.5*ts,moved(p,tx,ty,ts)) for p in WORD]
            + [(INK if vertical else CORAL,3.4*ss,moved(p,sx,sy,ss)) for p in SHOP])

def logo_svg(layers, w, h):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'
            + ''.join(f'<path d="{path(p)}" fill="none" stroke="{c}" stroke-width="{width}" '
                      'stroke-linecap="round" stroke-linejoin="round"/>' for c,width,p in layers)+'</svg>\n')

def logo_png(layers,w,h):
    im=Image.new('RGBA',(w*3,h*3),(0,0,0,0)); d=ImageDraw.Draw(im)
    for color,width,commands in layers:
        points=[]
        for c in commands:
            if c[0] in ['M','L']:
                current=c[1:]; points.append(current)
            else:
                x,y=current
                for i in range(1,81):
                    t=i/80;u=1-t
                    points.append((u**3*x+3*u*u*t*c[1]+3*u*t*t*c[3]+t**3*c[5],
                                   u**3*y+3*u*u*t*c[2]+3*u*t*t*c[4]+t**3*c[6]))
                current=c[5:]
        pts=[(round(x*3),round(y*3)) for x,y in points]; sw=round(width*3)
        d.line(pts,fill=color,width=sw,joint='curve')
        for x,y in [pts[0],pts[-1]]:
            rr=sw/2;d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=color)
    return im.resize((w,h),Image.Resampling.LANCZOS)

for name,vertical,w,h in [('horizontal',False,520,160),('vertical',True,320,300)]:
    layers=logo_layers(vertical)
    (ROOT/f'elume-logo-{name}.svg').write_text(logo_svg(layers,w,h),encoding='utf-8')
    logo_png(layers,w,h).save(ROOT/f'elume-logo-{name}.png')
layers=logo_layers(True)
(RES/'drawable/elume_wordmark.xml').write_text(
    '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="320dp" '
    'android:height="300dp" android:viewportWidth="320" android:viewportHeight="300">'
    + ''.join(f'<path android:fillColor="@android:color/transparent" android:strokeColor="{c}" '
              f'android:strokeWidth="{w}" android:strokeLineCap="round" android:strokeLineJoin="round" '
              f'android:pathData="{path(p)}"/>' for c,w,p in layers)+'</vector>\n',encoding='utf-8')
# Review sheet is an artifact, not an application screen capture.
sheet=Image.new('RGB',(900,580),CREAM)
sheet.paste(logo_png(logo_layers(),520,160),(55,65),logo_png(logo_layers(),520,160))
vertical=logo_png(logo_layers(True),320,300);sheet.paste(vertical,(535,245),vertical)
small=render(192,rounded=True);sheet.paste(small,(110,295),small)
sheet.save(ROOT/'elume-identidade.png')
print('Horizontal/vertical vector wordmarks, native splash wordmark and identity preview generated.')
