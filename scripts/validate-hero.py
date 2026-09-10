"""Validate the shipped GLB contract, transforms, materials and mesh budget."""
from pathlib import Path
import hashlib, json, struct

root = Path(__file__).resolve().parents[1]
report=[]
expected=[[-.8775,.333,1.197],[.8775,.333,1.197],[0,.354,-1.47]]
for tier,budget in [('hero',72000),('lod',32000)]:
    path=root/f'public/models/slingshot-r-{tier}.glb'
    data=path.read_bytes()
    magic,version,length=struct.unpack_from('<III',data)
    assert magic==0x46546c67 and version==2 and length==len(data)
    size,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a
    gltf=json.loads(data[20:20+size])
    nodes={n['name']:n for n in gltf['nodes'] if 'name' in n}
    for name in ['Body','Rider','Steering','SpeedNeedle','RpmNeedle','Exhaust',*[f'{prefix}_{i}' for prefix in ['Pivot','Wheel'] for i in range(3)]]:
        assert name in nodes,name
    for i,position in enumerate(expected):
        assert all(abs(a-b)<1e-6 for a,b in zip(nodes[f'Pivot_{i}']['translation'],position))
        assert all(abs(x)<1e-6 for x in nodes[f'Wheel_{i}'].get('translation',[0,0,0]))
        assert nodes[f'Wheel_{i}'].get('rotation',[0,0,0,1])==[0,0,0,1]
    materials={m['name'] for m in gltf['materials']}
    for name in ['BodyPaint','WheelFinish','ExhaustFinish','FrontLamp','TailLamp','Upholstery','Windscreen']:
        assert name in materials,name
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
    assert triangles<budget,(tier,triangles,budget)
    assert len(gltf['meshes'])<=70
    links=[n for n in gltf['nodes'] if 'suspensionAnchor' in n.get('extras',{})]
    assert len(links)==11
    assert [sum(n['extras']['wheelIndex']==i for n in links) for i in range(3)]==[5,5,1]
    assert all(n['extras']['restLength']>0 for n in links)
    assert all('uri' not in image for image in gltf['images'])
    report.append({'tier':tier,'nodes':len(gltf['nodes']),'embeddedImages':len(gltf['images']),'validHeaderLength':True,'animationContract':True,'wheelTransforms':True,'customizationMaterials':True,'triangles':triangles,'meshes':len(gltf['meshes']),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
assert report[1]['triangles']<report[0]['triangles']*.55
(root/'artwork/vehicle/glb-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
