"""Package measured review evidence without changing source media levels."""
from pathlib import Path
import json, shutil, subprocess, hashlib, urllib.request, re

root = Path(__file__).resolve().parents[1]
e = root / 'evidence'
for label in ['baseline-daytona', 'owner-garage']:
    p = e / f'{label}-profile.json'
    data = json.loads(p.read_text())
    data['sampledCpuFrameMs'] = None
    data['captureLimitation'] = 'Early mutable CPU and nested telemetry snapshots are invalid; excluded. Actual media and primitive time/frame values remain valid.'
    p.write_text(json.dumps(data, indent=2) + '\n')
for source, target in [('frame-1788989322333.png', 'baseline-garage.png'), ('frame-1788988729270.png', 'upgraded-garage.png')]:
    shutil.copyfile(e / 'captures' / source, e / target)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', '4', '-t', '8', '-i', str(e/'baseline-daytona.mp4'),
    '-ss', '4', '-t', '8', '-i', str(e/'miami-night.mp4'),
    '-filter_complex', '[0:a]aresample=48000[a];anullsrc=r=48000:cl=stereo,atrim=duration=1[s];[1:a]aresample=48000[b];[a][s][b]concat=n=3:v=0:a=1[out]',
    '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', str(e/'gameplay-mix-ab.mp3')], check=True)
measurement = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(e/'miami-night.mp4'), '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, check=True)
(e/'miami-mix-loudness.txt').write_text(measurement.stderr[measurement.stderr.rfind('Summary:'):])
preview = 'https://slingmods-three-wheel-tour-hvbvyoxk5-daniel-kinsners-projects.vercel.app'
with urllib.request.urlopen(preview) as response:
    html = response.read().decode()
    status = response.status
    authentication_required = 'vercel.com' in response.url
paths = re.findall(r'(?:src|href)="([^\"]+\.(?:js|css))"', html)
matches=[]
for path in paths:
    if 'assets/' not in path: continue
    with urllib.request.urlopen(preview+'/'+path.lstrip('./')) as response: body=response.read()
    local=(root/'dist'/path.lstrip('./')).read_bytes()
    matches.append({'path':path, 'bytes':len(body), 'sha256':hashlib.sha256(body).hexdigest(), 'matchesLocalBuild':body==local})
# Hashes measured through the authorized Chrome session using fetch + WebCrypto.
browser_hashes = {'assets/index-DgaaEf3p.js':'474ee641e684ce909aa9a89c2f4862e510ff6d510ff8dcda39b0502dad347bd9', 'assets/index-8L4ugj--.css':'872db00a529c18fa2bb0135f9925161a5c1548ff725181616a83e47141926c45'}
browser_matches = [{'path':p,'sha256':h,'matchesLocalBuild':hashlib.sha256((root/'dist'/p).read_bytes()).hexdigest()==h} for p,h in browser_hashes.items()]
(root/'PREVIEW-DEPLOYMENT.json').write_text(json.dumps({'previewUrl':preview, 'deploymentId':'dpl_83evGAWaFSycg9nRH2cVNA5zWjHn', 'target':'preview', 'status':'Ready', 'anonymousRequestRedirectsToVercelLogin':authentication_required, 'verifiedDate':'2026-09-09', 'authenticatedBrowserAssets':browser_matches, 'unchangedProductionUrl':'https://slingmods-three-wheel-tour.vercel.app/', 'unchangedProductionDeploymentId':'dpl_kgBwd3XtaFjDF6sNR5egHrdnX31o'},indent=2)+'\n')
print(json.dumps({'authenticationRequired':authentication_required,'allBrowserBuildAssetsMatch':bool(browser_matches) and all(x['matchesLocalBuild'] for x in browser_matches)}))
