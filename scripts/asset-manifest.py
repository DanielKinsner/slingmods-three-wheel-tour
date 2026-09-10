"""Build a hash inventory, preserving the evidence boundary for legacy rights."""
from pathlib import Path
import json,hashlib,re
ROOT=Path(__file__).resolve().parents[1]
products=json.loads((ROOT/'PRODUCT-SOURCES.json').read_text())
sources={Path(p['image']).name:p for p in products}
assets=[]
for f in sorted((ROOT/'public').rglob('*')):
 if not f.is_file() or f.suffix=='.js':continue
 rel=f.relative_to(ROOT).as_posix();n=f.name
 origin='Original project-authored asset';usage='Project artwork; source retained in this delivery'
 if '/products/' in rel:
  origin=sources[n]['imageSource'];usage='Existing company-catalog image; owner authorized company use. Supplier/image redistribution entitlement not independently verified.'
 elif '/audio/' in rel:
  if f.suffix=='.wav':origin='Original deterministic DSP synthesis; scripts/build-surface-audio.py';usage='Original generated audio; not a field recording'
  else:origin='Existing ElevenLabs generation; AUDIO-PROVENANCE.json';usage='Preserved existing asset; commercial subscription entitlement at generation not independently reverified'
 elif n.endswith('.hdr'):origin='https://polyhaven.com/a/kloppenheim_06_puresky';usage='CC0; https://polyhaven.com/license'
 elif n=='harbor-kit.glb':origin='Original Blender source artwork/harbor/harbor-kit.blend';usage='Original port modules and procedural wear maps; no external models or photographs'
 elif '/models/' in rel:origin='Original Blender source artwork/vehicle/slingshot-r-inspired.blend';usage='Original R-inspired approximation; reference photographs not embedded; not manufacturer CAD'
 elif '/miami/' in rel:origin='Original deterministic texture authoring; scripts/generate-miami-assets.py';usage='Original artwork; normal maps are art approximations, not scanned PBR'
 elif n in ['asphalt.webp','coastal-stucco.webp','deco-facade.webp']:origin='Existing OpenAI-generated artwork; GENERATED-ASSETS.md and artwork/textures';usage='Original generated texture; not a scan'
 elif 'slingmods' in n:origin='https://www.slingmods.com/image/catalog/slingmods-logo-main.png';usage='Company mark used under explicit owner authorization'
 assets.append(dict(file=rel,bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),origin=origin,usage=usage))
for package in ['barlow','barlow-condensed']:
 folder=ROOT/'node_modules/@fontsource'/package
 license_file=next(iter(folder.glob('*LICENSE*')),None)
 if license_file:
  target=ROOT/'docs/licenses'/f'{package}-LICENSE';target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(license_file.read_bytes())
 assets.append(dict(package='@fontsource/'+package,origin='https://fontsource.org/fonts/'+package,usage='SIL Open Font License 1.1; see docs/licenses',files='Bundled Latin weights from package-lock.json'))
(ROOT/'ASSET_MANIFEST.json').write_text(json.dumps({'version':json.loads((ROOT/'package.json').read_text())['version'],'assets':assets},indent=2)+'\n',encoding='utf-8',newline='\n')
matches=[]
for base in [ROOT/'src',ROOT/'public',ROOT/'dist',ROOT/'scripts']:
 for f in base.rglob('*'):
  if f.is_file() and f.suffix.lower() in ['.ts','.js','.json','.html','.py','.css']:
   if re.search(rb'(?<![A-Za-z0-9])sk[_-][A-Za-z0-9]{32,}',f.read_bytes()):matches.append(str(f.relative_to(ROOT)))
(ROOT/'evidence/secret-scan.json').write_text(json.dumps({'scan':'Credential-pattern scan of source, public assets, dist and generation scripts','matchingFiles':matches,'secretValuesPrinted':False},indent=2))
if matches:raise SystemExit('Credential-shaped material detected; see filenames only in scan report')
print(f'Inventoried {len(assets)} assets/packages; no credential-shaped values found.')
