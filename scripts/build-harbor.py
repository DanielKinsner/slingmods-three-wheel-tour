"""Original port modules, authored/exported in background Blender. Game metres, Y up, +Z forward."""
import bpy, math, json, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/models';ART=ROOT/'artwork/harbor'
ART.mkdir(parents=True,exist_ok=True);OUT.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def co(p):return Vector((p[0],-p[2],p[1]))
def mat(name,c,metal=0,rough=.65,glow=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1);p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if glow:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=glow
 return m
steel=mat('Port_Steel',(.12,.20,.23),.5,.54);dark=mat('Port_Rubber',(.018,.028,.036),0,.85)
ivory=mat('Port_Concrete',(.46,.50,.48),0,.92);red=mat('Port_Red',(.48,.06,.065),.3,.62)
yellow=mat('Port_Safety',(.78,.48,.09),.35,.55);glass=mat('Port_Glass',(.075,.19,.23),.55,.22)
cargo=mat('Port_Container',(.78,.8,.78),.35,.64)
lamp=mat('Port_Lamp',(.95,.79,.48),0,.36,2)
# A shared packed image supplies restrained paint abrasion; no photo or external source.
rng=np.random.default_rng(910);n=512;yy,xx=np.mgrid[:n,:n]
noise=rng.random((n,n))*.09 + .86 + .025*np.sin(xx*.046)*np.sin(yy*.07)
rgb=np.stack([noise,noise,noise,np.ones_like(noise)],axis=-1).astype(np.float32)
for _ in range(70):
 x,y=rng.integers(0,n,2);width=int(rng.integers(1,4));height=int(rng.integers(6,80));rgb[y:min(y+height,n),x:x+width,:3]*=rng.uniform(.65,.87)
im=bpy.data.images.new('Original port paint wear',width=n,height=n,alpha=True);im.pixels.foreach_set(rgb.reshape(-1));im.filepath_raw=str(ART/'port-wear.png');im.file_format='PNG';im.save();im.pack()
for m in [steel,ivory,red,yellow,cargo]:
 # Bake the paint tint into the original image for portable glTF materials.
 nodes=m.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage')
 m.node_tree.links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
 tinted=bpy.data.images.new(m.name+'_paint',width=n,height=n,alpha=True);a=rgb.copy();a[:,:,:3]*=np.array(m.diffuse_color[:3]);tinted.pixels.foreach_set(a.reshape(-1));tinted.filepath_raw=str(ART/(m.name+'.png'));tinted.file_format='PNG';tinted.save();tinted.pack();tex.image=tinted

def group(name):
 g=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(g);return g
modules=[]
def mesh(name,verts,faces,m,g,bevel=0,smooth=False):
 data=bpy.data.meshes.new(name);data.from_pydata([co(v) for v in verts],[],faces);data.materials.append(m);data.update()
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=g
 for p in data.polygons:p.use_smooth=smooth
 if bevel:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  b=o.modifiers.new('Manufactured edge radius','BEVEL');b.width=bevel;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
  w=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');w.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=w.name);o.select_set(False)
 return o

def box(name,p,size,m,g,bevel=.02):
 x,y,z=p;a,b,c=[v/2 for v in size];v=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 return mesh(name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],m,g,bevel)
def rod(name,a,b,r,m,g,sides=8):
 a,b=Vector(a),Vector(b);d=(b-a).normalized();u=d.cross(Vector((0,1,0)))
 if u.length<.001:u=d.cross(Vector((1,0,0)))
 u.normalize();v=d.cross(u);verts=[]
 for p in [a,b]:
  for j in range(sides):verts.append(p+r*(u*math.cos(j/sides*math.tau)+v*math.sin(j/sides*math.tau)))
 faces=[(j,(j+1)%sides,(j+1)%sides+sides,j+sides) for j in range(sides)]+[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]
 return mesh(name,verts,faces,m,g,smooth=True)
def module(name):
 g=group(name);modules.append(g);return g
# 40-foot paired shipping containers with profiled walls and working-looking lock bars.
g=module('PortContainer')
for cx in [-1.25,1.25]:
 box('Container shell',(cx,1.3,0),(2.44,2.59,12.19),cargo,g,.04)
 for sx in [-1,1]:
  # Repeated ribs use sharp folded edges; silhouette parts retain bevels.
  for k in range(43):box('Corrugation',(cx+sx*1.229,1.3,-5.84+k*.278),(.09,2.33,.105),cargo,g,0)
 for y in [.075,2.53]:box('Rail',(cx,y,0),(2.50,.14,12.24),cargo,g,.025)
 for x in [-1.15,1.15]:
  for z in [-6.04,6.04]:box('Corner casting',(cx+x,1.3,z),(.18,2.62,.18),ivory,g,.025)
 for dx in [-.59,.59]:
  box('Recessed door',(cx+dx,1.30,6.11),(1.11,2.33,.035),dark,g,.018)
  box('Door panel',(cx+dx,1.30,6.14),(1.07,2.29,.04),cargo,g,.018)
  for dd in [-.25,.25]:
   rod('Lock bar',(cx+dx+dd,.2,6.22),(cx+dx+dd,2.4,6.22),.027,ivory,g)
   box('Door latch',(cx+dx+dd,.94,6.27),(.21,.055,.05),yellow,g,.01)
 box('Inspection plate',(cx+.5,1.95,6.205),(.30,.26,.012),ivory,g,.006)
# Warehouse: pitched roof, inset roller bays, loading bumpers, gutters, clerestory glass.
g=module('PortWarehouse')
box('Concrete plinth',(0,.6,0),(35,1.2,52),ivory,g,.08)
box('Wall shell',(0,4.5,0),(34.6,7.7,51.6),steel,g,.06)
verts=[(-18,8.3,-27),(0,11,-27),(18,8.3,-27),(-18,8.3,27),(0,11,27),(18,8.3,27)]
mesh('Pitched roof',verts,[(0,1,4,3),(1,2,5,4),(0,2,1),(3,4,5)],dark,g,.08)
for side in [-1,1]:
 for z in [-20,-7,7,20]:
  x=side*17.38
  box('Dock recess',(x,3.4,z),(.10,5.2,8.5),dark,g,.02)
  box('Roller door',(x+side*.08,3.5,z),(.1,4.6,7.4),ivory,g,.02)
  for y in np.arange(1.4,5.8,.32):box('Roller slat',(x+side*.15,float(y),z),(.05,.055,7.38),steel,g,0)
  for dz in [-4.04,4.04]:box('Door jamb',(x+side*.18,3.45,z+dz),(.3,5.4,.3),steel,g,.04)
  for dz in [-3.2,3.2]:box('Dock bumper',(x+side*.3,.85,z+dz),(.38,1.0,.28),dark,g,.04)
  box('Dock ledge',(x+side*.65,.46,z),(1.4,.9,8.7),ivory,g,.06)
  box('Bay light',(x+side*.2,6.25,z),(.4,.13,5.8),lamp,g,.015)
  box('Clerestory',(x,7.25,z),(.06,1.0,9.0),glass,g,.02)
  for dz in [-3,0,3]:box('Window mullion',(x+side*.05,7.25,z+dz),(.12,1.04,.08),ivory,g,.01)
 for z in [-25,25]:rod('Rainwater downpipe',(side*17.8,.15,z),(side*17.8,8.25,z),.105,ivory,g)
 box('Gutter',(side*18,8.3,0),(.22,.25,54),steel,g,.03)
for z in [-18,0,18]:box('Roof vent',(0,10.6,z),(5,.8,4),steel,g,.05)
# Trussed gantry crane: tapered legs, service walkways, operator cab, cables and spreader.
g=module('PortCrane')
for x in [-10,10]:
 for z in [-9,9]:
  rod('Main leg',(x,0,z),(x*.7,35,z*.7),.72,yellow,g)
  rod('Leg brace',(x,4,z),(-x*.7,30,z*.7),.19,steel,g)
  box('Wheel truck',(x,.7,z),(3.5,1.4,4),steel,g,.12)
for x in [-16,30]:rod('Boom chord',(x,35,-2),(x,39,-2),.2,steel,g)
for y in [35,39]:
 for z in [-2,2]:rod('Boom chord',(-20,y,z),(36,y,z),.26,yellow,g)
for x in range(-20,36,4):
 for z in [-2,2]:rod('Boom lattice',(x,35,z),(x+4,39,z),.12,steel,g);rod('Boom lattice',(x,39,z),(x+4,35,z),.12,steel,g)
box('Machinery housing',(-12,33.5,0),(9,6,7),steel,g,.15)
box('Operator cab',(12,33.4,-3),(3.6,3.7,3),yellow,g,.14)
box('Cab glazing',(12,34,-4.54),(3.15,2.1,.04),glass,g,.04)
box('Service walkway',(3,34.1,-3.8),(53,.2,1.4),ivory,g,.03)
for x in range(-22,29,3):rod('Guard rail',(x,34.2,-4.4),(x,35.4,-4.4),.035,steel,g,6)
rod('Handrail',(-22,35.4,-4.4),(29,35.4,-4.4),.04,steel,g,6)
for x in [8,20]:
 for z in [-1.5,1.5]:rod('Hoist cable',(x,35,z),(x,16,z),.045,dark,g,6)
box('Spreader',(14,15.8,0),(14,.75,4),yellow,g,.1)
for x in [8,20]:box('Spreader lock',(x,15.1,0),(.6,1,5),steel,g,.05)
# Coastal freighter: shaped bow, sheer/deck, bridge glazing, funnels, railings and davits.
g=module('PortFreighter');verts=[];faces=[]
sections=[(-54,8),(-46,12),(-20,12),(20,12),(40,9),(54,0.65)]
for z,w in sections:
 verts += [(-w*.78,-1,z),(w*.78,-1,z),(-w,5,z),(w,5,z)]
for i in range(len(sections)-1):
 a=i*4;b=a+4;faces += [(a,b,b+2,a+2),(a+1,a+3,b+3,b+1),(a+2,b+2,b+3,a+3),(a,a+1,b+1,b)]
faces += [(0,2,3,1),(20,21,23,22)];mesh('Shaped hull',verts,faces,steel,g,.15)
box('Aft superstructure',(0,11,-39),(18,12,17),ivory,g,.20)
box('Wheelhouse',(0,17.8,-38),(21,3.2,18),ivory,g,.18)
box('Bridge front glass',(0,18, -28.9),(19,1.8,.07),glass,g,.03)
for x in [-10.55,10.55]:box('Bridge side glass',(x,18,-38),(.07,1.8,16),glass,g,.03)
for x in range(-8,9,3):box('Bridge mullion',(x,18,-28.83),(.10,1.95,.14),steel,g,.01)
for x in [-4,4]:box('Funnel',(x,21,-43),(3,7,4),red,g,.13);box('Funnel cap',(x,24.5,-43),(3.1,.4,4.1),dark,g,.08)
for z in [-18,-4,10,24]:
 for x in [-7,0,7]:
  for h in [0,1]:
   m=steel if (int(z)+int(x)+h)%3 else red
   box('Deck freight',(x,6.7+h*3.2,z),(6.5,3,12),m,g,.05)
   for dz in range(-5,6,2):box('Freight ribs',(x-3.26,6.7+h*3.2,z+dz),(.06,2.7,.1),ivory,g,0)
for sx in [-1,1]:
 for z in range(-46,36,4):rod('Deck stanchion',(sx*11.7,5,z),(sx*11.7,6.25,z),.045,ivory,g,6)
 rod('Deck rail',(sx*11.7,6.25,-46),(sx*11.7,6.25,36),.045,ivory,g,6)
rod('Navigation mast',(0,19.5,-31),(0,31,-31),.15,steel,g)
rod('Radar crossarm',(-4,29,-31),(4,29,-31),.12,ivory,g)
# Merge per module/material; original editable scene remains composed of named module groups.
for g in modules:
 buckets={}
 for o in list(g.children):
  if o.type=='MESH':buckets.setdefault(o.data.materials[0].name,[]).append(o)
 for name,parts in buckets.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=parts[0];o.name=g.name+'_'+name
  uv=o.data.uv_layers.new(name='World scale paint')
  for face in o.data.polygons:
   axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=[i for i in range(3) if i!=axis]
   for li in face.loop_indices:
    v=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]*.2,v[axes[1]]*.2)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(ART/'harbor-kit.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'harbor-kit.glb'),export_format='GLB',export_yup=True,export_apply=True)
records=[]
for g in modules:
 tri=0
 for o in g.children:
  if o.type=='MESH':o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
 records.append({'name':g.name,'triangles':tri,'meshes':len(g.children)})
p=OUT/'harbor-kit.glb';record={'source':'scripts/build-harbor.py','original':True,'units':'metres, Y up','modules':records,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(ART/'asset-evidence.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8');print('HARBOR_KIT_COMPLETE',json.dumps(record))
