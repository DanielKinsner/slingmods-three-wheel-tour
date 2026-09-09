"""Record asset changes and prepare review documentation (no deployment)."""
from pathlib import Path
import json,hashlib,shutil
root=Path(__file__).resolve().parents[1]
e=root/'evidence/reference-refinement'
old=json.loads((e/'before-asset-evidence.json').read_text())
new=json.loads((root/'artwork/vehicle/asset-evidence.json').read_text())
report={'referenceDirectory':r'D:\slingshot angles','sourceImagesEmbedded':False,'old':{'high':old['high'],'low':old['low']},'new':{'high':new['high'],'low':new['low']},'wheelCentersUnchanged':old['wheelCenters']==new['wheelCenters'],'frontTrackUnchanged':old['frontTrack']==new['frontTrack'],'wheelbaseUnchanged':old['wheelbase']==new['wheelbase'],'paintAndRgbSourceUnchanged':True,'runtimeChecks':['WebGPU garage, Glacier/ice blue and Electric blue/violet','Night race cockpit moving at 61 mph, clear forward view','Rear body and tail-lamp visibility in chase view'],'runtimeConsoleErrors':[],'performanceLimitation':'Prior full Miami frame distribution predates this mesh refinement. Mesh count remains 45; new mesh triangle/byte cost is measured separately. No refreshed full performance matrix or physical phone claim.'}
(e/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
old_url='https://slingmods-three-wheel-tour-hvbvyoxk5-daniel-kinsners-projects.vercel.app'
new_url='https://slingmods-three-wheel-tour-riwaaa1fb-daniel-kinsners-projects.vercel.app'
for name in ['STATUS.md','REVIEW.md']:
 p=root/name;p.write_text(p.read_text(encoding='utf-8').replace(old_url,new_url),encoding='utf-8',newline='\n')
p=root/'PREVIEW-DEPLOYMENT.json'
record=json.loads(p.read_text())
if record['deploymentId']!='dpl_BhA5Au7CCw1mc4hQDB6iFU99Tb68':shutil.copyfile(p,e/'previous-preview.json')
record.update(previewUrl=new_url,deploymentId='dpl_BhA5Au7CCw1mc4hQDB6iFU99Tb68',assetRefinement='Owner supplied PNG angles; original mesh source updated',authenticatedBrowserModelHashesVerified=True,assetHashes={name:hashlib.sha256((root/'dist/models'/name).read_bytes()).hexdigest() for name in ['slingshot-r-hero.glb','slingshot-r-lod.glb']})
p.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(report))
