"""Original, deterministic Miami surface/decal kit; no remote assets or API calls.

The normal and roughness maps share an authored micro-height field. They are
synthetic PBR approximations, not scanned material or manufacturer artwork.
"""
from pathlib import Path
import hashlib, json, math, random
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'textures' / 'miami'
OUT.mkdir(parents=True, exist_ok=True)
N = 512
seed = random.Random(20260909)
records = []

def save(im, name, purpose):
    path = OUT / name
    im.save(path, 'WEBP', quality=92, method=6)
    records.append({'id': 'miami-' + path.stem, 'path': 'textures/miami/' + name,
                    'classification': 'original-procedural', 'source': 'scripts/generate-miami-assets.py',
                    'license': 'Original project asset; available to the project owner for game redistribution.',
                    'purpose': purpose, 'dimensions': list(im.size), 'bytes': path.stat().st_size,
                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

for family in ['limewash', 'pavers', 'terrazzo']:
    heights, colors, rough = [], [], []
    for y in range(N):
        for x in range(N):
            n = seed.random()
            broad = math.sin(x * math.tau / N * 3) * math.cos(y * math.tau / N * 4)
            if family == 'limewash':
                h = .5 + .035 * broad + (n - .5) * .09
                tone = 239 + (n - .5) * 8 + broad * 3
                rgb = (tone, tone - 4, tone - 10)
                r = 220 + n * 12
            elif family == 'pavers':
                # Staggered 0.5 x 0.25 m joints; four metre tile in game.
                seam = (x + (32 if (y // 32) % 2 else 0)) % 64 < 2 or y % 32 < 2
                h = .35 if seam else .5 + (n - .5) * .03
                tone = (153 if seam else 207) + (n - .5) * 9
                rgb = (tone, tone - 3, tone - 9)
                r = 233 if seam else 197 + n * 13
            else:
                chip = n < .09
                h = .5 + (n - .5) * .008
                tone = 138 if chip else 225 + (n - .5) * 12
                rgb = (tone - 8, tone, tone - 1)
                r = 175 + n * 17
            heights.append(h)
            colors.append(tuple(int(max(0, min(255, c))) for c in rgb))
            rough.append(int(r))
    normal = []
    for y in range(N):
        for x in range(N):
            nx = (heights[y*N+(x-1)%N] - heights[y*N+(x+1)%N]) * 1.4
            ny = (heights[((y-1)%N)*N+x] - heights[((y+1)%N)*N+x]) * 1.4
            length = math.sqrt(nx*nx + ny*ny + 1)
            normal.append((int(127.5+127.5*nx/length), int(127.5+127.5*ny/length), int(127.5+127.5/length)))
    im = Image.new('RGB', (N,N)); im.putdata(colors)
    save(im, family+'-color.webp', family+' neutral albedo; no perspective, cast shadows or reflections')
    im = Image.new('RGB', (N,N)); im.putdata(normal)
    save(im, family+'-normal.webp', 'Tangent-space normal from authored '+family+' micro-height field')
    im = Image.new('L', (N,N)); im.putdata(rough)
    save(im, family+'-roughness.webp', 'Authored '+family+' roughness, independent of color luminance')

# Six original fictional businesses / wayfinding panels in a shared atlas.
names = [('PALOMA', 'HOTEL & TERRACE', '#ede2cc', '#193d41'),
         ('BLUE HOUR', 'COFFEE / ALL DAY', '#173e49', '#f4e8cb'),
         ('BISCAYNE', 'MARINA / PIER 03', '#153746', '#efe8d5'),
         ('CORAL CLUB', 'SWIM / SUN / STAY', '#ddc0b3', '#4d3b3a'),
         ('BAYLINE', 'RESIDENCES', '#e4e6e3', '#23454b'),
         ('CIRCUIT CLOSED', 'RACE CONTROL / AUTHORIZED ACCESS', '#20242a', '#f7f5ec'),
         ('WATERFRONT', 'PROMENADE / MARINA', '#23616a', '#f4e8cb'),
         ('PALM MARKET', 'PROVISIONS & FLOWERS', '#e5d9bd', '#273e30')]
atlas = Image.new('RGB', (2048,1024)); draw = ImageDraw.Draw(atlas)
font_dir=Path('C:/Windows/Fonts')
font=ImageFont.truetype(str(font_dir/'bahnschrift.ttf'), 67)
small=ImageFont.truetype(str(font_dir/'bahnschrift.ttf'), 22)
for i,(name,sub,bg,fg) in enumerate(names):
    x=(i%2)*1024; y=(i//2)*256
    draw.rectangle((x,y,x+1023,y+255), fill=bg)
    draw.rectangle((x+20,y+20,x+1003,y+235), outline=fg, width=2)
    draw.text((x+512,y+103),name,font=font,anchor='mm',fill=fg)
    draw.line((x+390,y+155,x+634,y+155), fill=fg,width=2)
    draw.text((x+512,y+194),sub,font=small,anchor='mm',fill=fg)
save(atlas,'storefront-atlas.webp','Eight original fictional storefront and circuit wayfinding decals; not actual business branding')
# Eight painted room-depth variations for distant facade windows. These are
# intentionally illustrated interiors, not PBR surface scans or true parallax.
rooms=Image.new('RGB',(512,384))
for i in range(8):
    room=Image.new('RGB',(128,192),'#16232b'); d=ImageDraw.Draw(room)
    warm=i%3!=0
    for y in range(14,176):
        shade=1-abs(y-98)/210
        base=(122,103,78) if warm else (48,67,77)
        d.line((8,y,120,y),fill=tuple(int(c*shade) for c in base))
    d.polygon([(8,14),(120,14),(102,35),(26,35)],fill='#303536')
    d.polygon([(8,176),(120,176),(101,146),(26,146)],fill='#393b3a')
    d.polygon([(8,14),(26,35),(26,146),(8,176)],fill='#454744')
    d.polygon([(120,14),(102,35),(102,146),(120,176)],fill='#55534b')
    # Curtain folds, recessed jambs, a restrained framed picture and furniture.
    for x in range(12,33,4):
        d.rectangle((x,19,x+2,165),fill=('#8b8270' if warm else '#465a62'))
    for x in range(99,117,4):
        d.rectangle((x,19,x+2,165),fill=('#70695f' if warm else '#374a56'))
    if i%2:
        for y in range(24,94,7):d.line((30,y,98,y),fill='#817a69',width=2)
    else:
        d.rectangle((47,57,78,94),fill='#373c3c',outline='#aa9779',width=2)
        d.rectangle((51,61,74,90),fill=('#687269' if warm else '#45616b'))
    d.rounded_rectangle((36,127,92,150),radius=4,fill='#303838')
    d.rectangle((40,121,86,137),fill='#48504a')
    d.line((88,111,88,145),fill='#272d30',width=3)
    d.polygon([(79,103),(94,103),(99,117),(74,117)],fill=('#e7c88e' if warm else '#657c86'))
    d.rectangle((4,8,124,183),outline='#16252c',width=5)
    d.line((8,15,118,15),fill='#7b9096',width=2)
    rooms.paste(room,((i%4)*128,(i//4)*192))
save(rooms,'window-interiors.webp','Eight original illustrated room-depth tiles with curtains, furniture and lamp details; approximate distant interiors')
(ROOT/'MIAMI-ASSET-MANIFEST.json').write_text(json.dumps({'generator':'scripts/generate-miami-assets.py','seed':20260909,
    'generated':'2026-09-09','commercialClaims':'Original fictional architecture and signs; not an exact Miami street recreation.',
    'assets':records},indent=2)+'\n', encoding='utf-8')
print(json.dumps({'assets':len(records),'bytes':sum(r['bytes'] for r in records),'output':str(OUT)}))
