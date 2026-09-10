"""Validate the shipped, self-contained Blender kit and per-module geometry ceilings."""
from pathlib import Path
import json, struct, hashlib
root=Path(__file__).resolve().parents[1]
data=(root/'public/models/harbor-kit.glb').read_bytes()
magic,version,length=struct.unpack_from('<III',data)
assert magic==0x46546c67 and version==2 and length==len(data)
size,kind=struct.unpack_from('<II',data,12)
assert kind==0x4e4f534a
gltf=json.loads(data[20:20+size])
assert all('uri' not in im for im in gltf['images'])
assert len(data)<4_000_000
nodes={n['name']:n for n in gltf['nodes'] if 'name' in n}
report=[]
for name,ceiling in [('PortContainer',6000),('PortWarehouse',13000),('PortCrane',4000),('PortFreighter',7500)]:
    node=nodes[name]
    assert 'translation' not in node and 'scale' not in node
    triangles=0
    for child in node['children']:
        mesh=gltf['meshes'][gltf['nodes'][child]['mesh']]
        triangles+=sum(gltf['accessors'][p['indices']]['count']//3 for p in mesh['primitives'])
    assert triangles<ceiling,(name,triangles)
    assert len(node['children'])<=5
    report.append({'module':name,'triangles':triangles,'ceiling':ceiling,'drawGroups':len(node['children'])})
result={'modules':report,'bytes':len(data),'embeddedImages':len(gltf['images']),'sha256':hashlib.sha256(data).hexdigest()}
(root/'artwork/harbor/glb-validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
