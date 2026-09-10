"""Original 2025 R-inspired game mesh. Run with Blender --background --python.
No third-party geometry, textures, or badges. Coordinates in helpers are game
metres: X lateral, Y up, Z forward; export restores that convention from Blender.
"""
import bpy, math, json, hashlib, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'public/models'
ART = ROOT/'artwork/vehicle'
OUT.mkdir(parents=True, exist_ok=True); ART.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def co(v): return Vector((v[0],-v[2],v[1]))
def material(name,c,metal=0,rough=.4,coat=0,emission=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1)
 p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
 p.inputs['Coat Weight'].default_value=coat; p.inputs['Coat Roughness'].default_value=.16
 if emission: p.inputs['Emission Color'].default_value=(*c,1); p.inputs['Emission Strength'].default_value=emission
 return m
paint=material('BodyPaint',(.48,.018,.034),.48,.26,1)
graphite=material('Graphite',(.038,.047,.063),.55,.27,.7)
trim=material('TexturedTrim',(.012,.016,.021),.07,.68)
rubber=material('TireRubber',(.019,.023,.027),0,.88)
alloy=material('MachinedAlloy',(.38,.42,.48),.94,.25)
wheel_finish=material('WheelFinish',(.38,.42,.48),.94,.25)
exhaust_finish=material('ExhaustFinish',(.28,.32,.38),.95,.24)
rotor=material('BrakeSteel',(.24,.27,.3),.93,.35)
leather=material('Upholstery',(.045,.055,.069),0,.82)
stitch=material('SeatAccent',(.5,.018,.025),0,.68)
lamp=material('FrontLamp',(.82,.93,1),.05,.16,0,3)
tail=material('TailLamp',(.8,.008,.015),.08,.2,0,2)
amber=material('MarkerLamp',(1,.32,.015),0,.2,0,.4)
screen=material('InstrumentDisplay',(.03,.27,.36),0,.29,0,.5)
# Smoked deflector like the production screen, not clear glass.
glass=material('Windscreen',(.08,.11,.14),0,.1,.6)
glass.diffuse_color=(.08,.11,.14,.45)
glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.45
glass.surface_render_method='DITHERED'
# Original subtle PBR microdetail. These are authored synthetic pores, not scans.
def microdetail(mat,name,seed,strength):
 rng=np.random.default_rng(seed);h=rng.random((128,128)).astype(np.float32)
 dx=(np.roll(h,1,1)-np.roll(h,-1,1))*.14;dy=(np.roll(h,1,0)-np.roll(h,-1,0))*.14
 rgba=np.ones((128,128,4),np.float32);rgba[:,:,0]=.5+dx;rgba[:,:,1]=.5+dy;rgba[:,:,2]=1
 image=bpy.data.images.new(name,width=128,height=128,alpha=True);image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(rgba.reshape(-1))
 image.filepath_raw=str(ART/(name+'.png'));image.file_format='PNG';image.save();image.pack()
 nodes=mat.node_tree.nodes; tex=nodes.new('ShaderNodeTexImage');tex.image=image
 normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=strength
 mat.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
microdetail(leather,'upholstery-micro-normal',43,.55)
microdetail(rubber,'rubber-micro-normal',71,.2)
microdetail(trim,'trim-micro-normal',93,.3)
def empty(name,parent=None,p=(0,0,0)):
 o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=co(p)
 if parent:o.parent=parent
 return o
body=empty('Body'); ride=empty('Rider',body)
def finish(o,name,mat,parent=body,smooth=False):
 o.name=name
 if mat:o.data.materials.append(mat)
 if parent:o.parent=parent
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=smooth
 return o
def mesh(name,verts,faces,mat,parent=body,thick=0,bevel=0,smooth=False):
 d=bpy.data.meshes.new(name); d.from_pydata([co(v) for v in verts],[],faces); d.update()
 o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); finish(o,name,mat,parent,smooth)
 bpy.context.view_layer.objects.active=o; o.select_set(True)
 if thick:
  m=o.modifiers.new('Moulded panel thickness','SOLIDIFY'); m.thickness=thick; m.offset=-1
  bpy.ops.object.modifier_apply(modifier=m.name)
 if bevel:
  m=o.modifiers.new('Manufactured edge radii','BEVEL'); m.width=bevel;m.segments=2
  bpy.ops.object.modifier_apply(modifier=m.name)
 if smooth:
  m=o.modifiers.new('Crease split','EDGE_SPLIT'); m.split_angle=math.radians(28); m.use_edge_sharp=True
  bpy.ops.object.modifier_apply(modifier=m.name)
 if bevel or thick:
  m=o.modifiers.new('Panel normals','WEIGHTED_NORMAL'); m.keep_sharp=True
  bpy.ops.object.modifier_apply(modifier=m.name)
 o.select_set(False); return o
def panel(name,v,mat,thick=.012,bevel=.005):return mesh(name,v,[tuple(range(len(v)))],mat,thick=thick,bevel=bevel)
def box(name,p,size,mat,parent=body,bevel=.015):
 x,y,z=p; a,b,c=[v/2 for v in size]
 v=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 return mesh(name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,parent,bevel=bevel)
def tube(name,pts,r,mat,parent=body,sides=8):
 verts=[];faces=[]
 for i,p in enumerate(pts):
  tangent=Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(0,i-1)])
  tangent.normalize(); side=tangent.cross(Vector((0,1,0)))
  if side.length<.01:side=tangent.cross(Vector((1,0,0)))
  side.normalize();up=tangent.cross(side).normalized()
  for j in range(sides):verts.append(Vector(p)+r*(math.cos(j*math.tau/sides)*side+math.sin(j*math.tau/sides)*up))
 for i in range(len(pts)-1):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+j for j in range(sides))])
 return mesh(name,verts,faces,mat,parent,smooth=True)
def torus(name,p,major,minor,mat,parent=body,axis='x',segments=48,sides=8):
 verts=[];faces=[]
 for i in range(segments):
  a=i/segments*math.tau
  for j in range(sides):
   b=j/sides*math.tau;rr=major+minor*math.cos(b)
   v=(minor*math.sin(b),rr*math.cos(a),rr*math.sin(a)) if axis=='x' else (rr*math.cos(a),rr*math.sin(a),minor*math.sin(b))
   verts.append(tuple(p[k]+v[k] for k in range(3)))
 for i in range(segments):
  for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%segments)*sides+(j+1)%sides,((i+1)%segments)*sides+j))
 return mesh(name,verts,faces,mat,parent,smooth=True)
# Closed tub and rocker panels. The vehicle remains an open two-seat roadster.
box('Floor pan',(0,.215,-.01),(1.38,.16,2.34),trim)
box('Rear bulkhead',(0,.51,-.97),(1.37,.52,.18),trim)
box('Transmission tunnel',(0,.47,-.22),(.20,.36,1.43),graphite)
for s in [-1,1]:
 tube('Lower sill',[(s*.7,.22,-.99),(s*.8,.25,-.6),(s*.8,.29,.14),(s*.66,.35,.72)],.034,graphite)
 # Forged hoop shape: polygonal trapezoid, not round roll-cage tube.
 hoop=[(s*.17,.66,-.82),(s*.18,1.17,-.88),(s*.24,1.29,-.88),(s*.52,1.29,-.88),(s*.59,1.17,-.88),(s*.65,.66,-.82)]
 tube('Forged roll hoop',hoop,.033,graphite,sides=6)
 tube('Hoop inlay',[(s*.23,1.14,-.876),(s*.27,1.22,-.879),(s*.49,1.22,-.879),(s*.54,1.14,-.876)],.008,alloy,sides=6)
 # Continuous contoured buckets from the supplied side/front reference angles.
 # Shoulder wings taper into an integrated headrest instead of stacked boxes.
 x=s*.37
 box('Seat base',(x,.44,-.52),(.44,.10,.49),trim,bevel=.045)
 seat_rows=[(.51,.17,-.63),(.60,.20,-.67),(.76,.225,-.73),(.89,.225,-.77),(.97,.21,-.80),(1.04,.17,-.82),(1.12,.13,-.835),(1.16,.09,-.84)]
 sv=[];sf=[]
 for y,w,z in seat_rows:
  for j in range(9):
   u=j/8*2-1;sv.append((x+w*u,y,z+.062*abs(u)**2))
 for i in range(len(seat_rows)-1):
  for j in range(8):a=i*9+j;sf.append((a,a+1,a+10,a+9))
 mesh('Contoured bucket shell',sv,sf,trim,thick=.043,bevel=.012,smooth=True)
 iv=[];inf=[]
 for y,w,z in seat_rows:
  for j in range(7):
   u=j/6*2-1;iv.append((x+w*.76*u,y-.008,z+.012+.027*u*u))
 for i in range(len(seat_rows)-1):
  for j in range(6):a=i*7+j;inf.append((a,a+1,a+8,a+7))
 mesh('Sculpted back upholstery',iv,inf,leather,thick=.022,bevel=.007,smooth=True)
 cv=[];cf=[]
 for z,w,y in [(-.28,.16,.515),(-.34,.195,.527),(-.5,.177,.488),(-.66,.147,.497)]:
  for j in range(9):
   u=j/8*2-1;cv.append((x+w*u,y+.037*u*u,z))
 for i in range(3):
  for j in range(8):a=i*9+j;cf.append((a,a+1,a+10,a+9))
 mesh('Dished seat cushion',cv,cf,leather,thick=.043,bevel=.012,smooth=True)
 for sx in [-1,1]:
  tube('Seat contrast seam',[(x+sx*w*.81,y,z+.031) for y,w,z in seat_rows[:-1]],.0024,stitch,sides=5)
  tube('Raised hip bolster',[(x+sx*.177,.539,-.33),(x+sx*.183,.54,-.46),(x+sx*.167,.55,-.59),(x+sx*.153,.58,-.66)],.024,leather)
  box('Harness slot',(x+sx*.071,.925,-.754),(.073,.025,.012),trim,bevel=.011)
 for j in range(4):tube('Cushion stitching',[(x-.11,.504,-.45-j*.043),(x+.11,.504,-.45-j*.043)],.0015,graphite,sides=4)
 # Mirrors on clearly separate stalks.
 tube('Mirror arm',[(s*.64,.93,.16),(s*.80,1.06,.10)],.015,graphite)
 box('Mirror housing',(s*.81,1.07,.105),(.19,.074,.07),graphite,bevel=.026)
 box('Mirror glass',(s*.81,1.068,.064),(.15,.047,.008),alloy,bevel=.012)
# Formed dashboard, touchscreen, pedals and two gauges.
dv=[];df=[]
for j in range(13):
 u=j/12*2-1
 dv.extend([(u*.62,.955-.06*u*u,.14),(u*.62,.93-.05*u*u,-.02),(u*.62,.83-.04*u*u,-.08),(u*.62,.72,.0),(u*.62,.72,.16)])
 if j<12:
  for k in range(4):a=j*5+k;df.append((a,a+1,a+6,a+5))
  df.append((j*5+4,j*5,j*5+5,j*5+9))
mesh('Dashboard cowl',dv,df,trim,thick=.015,bevel=.006,smooth=True)
box('Gauge binnacle hood',(.37,.975,-.04),(.30,.03,.16),trim,bevel=.012)
box('Screen housing',(0,.89,-.083),(.23,.18,.034),graphite,bevel=.014)
box('Screen display',(0,.897,-.103),(.189,.126,.004),screen,bevel=.004)
for x in [-.075,0,.075]:box('Console button',(x,.766,-.115),(.031,.021,.015),alloy,bevel=.004)
for x in [.28,.46]:
 torus('Gauge bezel',(x,.919,-.076),.07,.008,alloy,axis='z',segments=32)
 box('Gauge face',(x,.92,-.073),(.124,.124,.015),trim,bevel=.05)
 needle=empty('SpeedNeedle' if x==.28 else 'RpmNeedle',body,(x,.919,-.089))
 tube('Gauge needle',[(0,0,0),(-.027,.034,0)],.003,tail,needle)
for x in [.31,.43]:box('Pedal',(x,.28,.21),(.055,.09,.033),alloy,bevel=.005)
steer=empty('Steering',body,(.37,.86,-.207))
torus('Steering rim',(0,0,0),.135,.014,leather,steer,axis='z',segments=48)
for angle in [0,2.2,4.08]:tube('Steering spoke',[(0,0,0),(.115*math.sin(angle),.115*math.cos(angle),0)],.014,graphite,steer)
box('Steering hub',(0,0,.0),(.085,.076,.034),graphite,steer,bevel=.025)
tube('Gear stick',[(.07,.56,-.39),(.07,.64,-.43)],.012,alloy)
box('Gear knob',(.07,.657,-.431),(.045,.038,.05),leather,bevel=.018)
# Swept wind deflector, low enough to retain the characteristic open silhouette.
wv=[];wf=[]
for i in range(25):
 x=(i/24-.5)*1.25;z=.10-.1*(x/.625)**2;y=.95
 wv.extend([(x,y,z),(x,y+.27+.025*math.cos(x*4),z-.08)])
 if i<24:wf.append((2*i,2*i+2,2*i+3,2*i+1))
mesh('Windscreen',wv,wf,glass,thick=.003,smooth=True)
# --- Front clip: lofted centre hood/nose and two fender pods, proportioned from the owner's
# reference angles (hood rising to a ~0.95 m cowl, fender pods ~0.89 m, long low nose). ---
def loft(name,sections,mat,thick=.02,bevel=.005,mirror=True):
 n=len(sections[0]);verts=[p for sec in sections for p in sec];faces=[]
 for i in range(len(sections)-1):
  for j in range(n-1):a=i*n+j;faces.append((a,a+1,a+n+1,a+n))
 mesh(name,verts,faces,mat,thick=thick,bevel=bevel,smooth=True)
 if mirror:mesh(name,[(-x,y,z) for x,y,z in verts],[tuple(reversed(f)) for f in faces],mat,thick=thick,bevel=bevel,smooth=True)
HOOD=[(1.95,.62,.36),(1.86,.66,.42),(1.70,.71,.48),(1.50,.76,.53),(1.30,.80,.56),(1.10,.835,.585),(.85,.875,.60),(.60,.91,.62),(.35,.935,.63),(.10,.955,.64),(-.02,.96,.645)]
def hood_station(z):
 for (z1,y1,w1),(z0,y0,w0) in zip(HOOD,HOOD[1:]):
  if z0<=z<=z1:
   t=(z1-z)/(z1-z0);return y1+(y0-y1)*t,w1+(w0-w1)*t
 return (HOOD[0][1],HOOD[0][2]) if z>HOOD[0][0] else (HOOD[-1][1],HOOD[-1][2])
def hood_top(z,u):
 y,_=hood_station(z)
 return y+.05*(1-abs(u))-.045*max(0,abs(u)-.62)/.38+.012*max(0,1-abs(abs(u)-.62)/.08)
hood_sections=[]
for z,y,w in HOOD:
 hood_sections.append([(w*u,hood_top(z,u),z) for u in [0,.1,.2,.3,.4,.5,.62,.72,.82,.91,1.0]]+[(w+.02,hood_top(z,1)-.035,z),(w+.03,hood_top(z,1)-.07,z)])
loft('Hood',hood_sections,paint,thick=.022,bevel=.006)
POD=[(1.90,[(.64,.60),(.80,.60),(.90,.55),(.93,.44),(.90,.33),(.86,.27)]),
 (1.80,[(.66,.68),(.84,.68),(.96,.61),(.99,.50),(.97,.35),(.90,.26)]),
 (1.62,[(.68,.78),(.88,.78),(.985,.70),(1.00,.56),(.995,.49),(.98,.44)]),
 (1.40,[(.70,.84),(.89,.84),(.995,.75),(1.00,.60),(.995,.56),(.985,.54)]),
 (1.20,[(.71,.86),(.89,.86),(.995,.77),(1.00,.62),(.995,.58),(.985,.56)]),
 (1.00,[(.72,.85),(.89,.85),(.995,.76),(1.00,.61),(.995,.57),(.985,.55)]),
 (.82,[(.73,.83),(.88,.82),(.98,.73),(.985,.59),(.965,.53),(.95,.49)]),
 (.66,[(.74,.80),(.83,.79),(.91,.71),(.90,.62),(.87,.56),(.83,.51)]),
 (.56,[(.69,.79),(.72,.78),(.76,.73),(.75,.68),(.74,.62),(.71,.57)])]
def pod_section(z,pts):
 w=hood_station(z)[1];return [(w+.03,hood_top(z,1)-.07,z),(w+.05,hood_top(z,1)-.03,z)]+[(x,y,z) for x,y in pts]
loft('Fender pod',[pod_section(z,pts) for z,pts in POD],paint,thick=.02,bevel=.006)
for s in [-1,1]:
 cap=[(s*x,y,z) for x,y,z in pod_section(1.90,POD[0][1])]+[(s*.55,.30,1.90)]
 mesh('Pod front cap',cap,[tuple(range(len(cap))) if s>0 else tuple(reversed(range(len(cap))))],paint,thick=.02,bevel=.006)
 panel('Fascia wedge',[(s*.36,.62,1.88),(s*.64,.60,1.90),(s*.86,.27,1.90),(s*.40,.20,1.86)],paint,.028,.008)
 # Angular headlamp slash across each pod front, amber marker at the outer corner.
 brow=[(s*.58,.47,1.905),(s*.74,.52,1.905),(s*.89,.575,1.885)]
 tube('Headlight socket',brow,.042,trim,sides=8)
 tube('Headlight reflector',[(x,y+.003,z+.013) for x,y,z in brow],.019,alloy,sides=8)
 tube('Front accent optic',[(x,y+.003,z+.026) for x,y,z in brow],.010,lamp,sides=8)
 tube('Headlight upper eyelid',[(x,y+.045,z+.026) for x,y,z in brow],.013,paint,sides=6)
 for a,b in zip(brow[:-1],brow[1:]):
  for j in range(1,4):
   t=j/4;p=Vector(a).lerp(Vector(b),t)
   tube('Optical lens divider',[(p.x,p.y-.009,p.z+.028),(p.x,p.y+.015,p.z+.028)],.0026,alloy,sides=4)
 box('Amber marker',(s*.92,.52,1.87),(.022,.061,.018),amber,bevel=.007)
 panel('Corner intake',[(s*.70,.46,1.925),(s*.90,.44,1.90),(s*.88,.27,1.905),(s*.66,.27,1.935)],trim,.02,.006)
 for j in range(4):tube('Intake slat',[(s*(.72+j*.05),.29,1.94-j*.006),(s*(.73+j*.05),.44,1.935-j*.006)],.008,graphite,sides=5)
 tube('Lower accent optic',[(s*.905,.30,1.87),(s*.92,.44,1.86)],.009,lamp)
 panel('Chin splitter',[(s*.02,.165,1.95),(s*.60,.165,1.92),(s*.94,.19,1.82),(s*.94,.19,1.60),(s*.70,.17,1.64),(s*.02,.165,1.68)],trim,.035,.01)
 # Suspension remains exposed in the open gap behind the fender.
 for y in [.23,.39]:
  for z in [.7,1.42]:tube('Front wishbone',[(s*.44,y,z),(s*.858,.32,1.197)],.019,graphite)
 tube('Damper shaft',[(s*.52,.63,.96),(s*.832,.25,1.19)],.018,alloy)
 a=Vector((s*.54,.6,.97));b=Vector((s*.81,.28,1.18));axis=(b-a).normalized();v=axis.cross(Vector((0,0,1))).normalized();u=axis.cross(v)
 coil=[a+(b-a)*i/64+.033*(math.cos(i/64*math.tau*7)*v+math.sin(i/64*math.tau*7)*u) for i in range(65)]
 tube('Coil spring',coil,.007,stitch,sides=6)
# Nose face with a wide dark grille mouth, centre light bar and painted eyebrow.
panel('Nose upper face',[(-.36,.62,1.88),(0,.62,1.98),(.36,.62,1.88),(.42,.52,1.87),(0,.52,1.97),(-.42,.52,1.87)],paint,.03,.01)
panel('Nose lower lip',[(-.34,.245,1.85),(0,.245,1.93),(.34,.245,1.85),(.40,.20,1.86),(0,.20,1.93),(-.40,.20,1.86)],paint,.03,.01)
for s in [-1,1]:panel('Nose cheek',[(s*.42,.52,1.87),(s*.40,.20,1.86),(s*.34,.245,1.85),(s*.39,.52,1.86)],paint,.03,.008)
panel('Grille mouth',[(-.39,.52,1.86),(0,.52,1.935),(.39,.52,1.86),(.34,.245,1.85),(0,.245,1.895),(-.34,.245,1.85)],trim,.02,.006)
box('Radiator backing',(0,.38,1.83),(.56,.20,.02),trim,bevel=.01)
for j in range(7):
 for i in range(23):
  x=(i-11)*.03+(j%2)*.015;y=.275+j*.033
  if abs(x)>.30+j*.012:continue
  zz=1.9-abs(x)*.2
  pts=[(x+.016*math.cos(k/6*math.tau),y+.011*math.sin(k/6*math.tau),zz) for k in range(7)]
  tube('Honeycomb grille',pts,.0028,graphite,sides=3)
box('Projector recess',(0,.565,1.935),(.40,.06,.04),trim,bevel=.01)
for x in [-.14,-.07,0,.07,.14]:
 box('Projector reflector',(x,.565,1.95-abs(x)*.2),(.06,.04,.009),alloy,bevel=.009)
 box('Projector lens',(x,.565,1.957-abs(x)*.2),(.048,.024,.01),lamp,bevel=.006)
tube('Projector eyebrow',[(-.22,.61,1.91),(0,.625,1.965),(.22,.61,1.91)],.012,paint,sides=6)
box('Scoop inlet',(0,hood_top(.46,0)+.014,.46),(.26,.034,.05),trim,bevel=.008)
panel('Scoop top',[(-.10,hood_top(.16,0)+.002,.16),(-.145,hood_top(.44,0)+.036,.44),(.145,hood_top(.44,0)+.036,.44),(.10,hood_top(.16,0)+.002,.16)],paint,.014,.005)
for s in [-1,1]:
 for j in range(4):
  z=.37+j*.072
  box('Hood vent',(s*.36,hood_top(z,.36/hood_station(z)[1])+.004,z),(.105,.006,.023),trim,bevel=.004)
# Painted cockpit flanks: (z, shoulder x, shoulder y). Open black tub below the hip line.
FLANK=[(.05,.66,.95),(-.15,.74,.90),(-.35,.80,.85),(-.55,.84,.82),(-.75,.85,.81),(-.92,.83,.81)]
loft('Cockpit flank',[[(x-.06,y+.002,z),(x,y,z),(x+.03,y-.10,z),(x+.03,y-.24,z),(x-.06,y-.40,z)] for z,x,y in FLANK],paint,thick=.02,bevel=.004)
# Single rear contact, drive housing, belt cover, rear wheel cap and low exhaust.
loft('Rear swingarm',[[(.17,.30,-.70),(.17,.46,-.70),(.31,.46,-.70),(.31,.30,-.70),(.17,.30,-.70)],[(.19,.31,-1.10),(.19,.42,-1.10),(.30,.42,-1.10),(.30,.31,-1.10),(.19,.31,-1.10)],[(.20,.32,-1.47),(.20,.38,-1.47),(.28,.38,-1.47),(.28,.32,-1.47),(.20,.32,-1.47)]],alloy,thick=0,bevel=.01,mirror=False)
box('Belt cover',(-.15,.44,-1.23),(.08,.13,.65),trim,bevel=.04)
tube('Rear damper',[(.1,.67,-.96),(.11,.34,-1.44)],.024,alloy)
# Rear deck: centre spine over a wide shoulder deck that cantilevers past the narrow lower body.
DECK=[(-.86,1.0,.92,1.0),(-1.05,.93,.885,1.0),(-1.25,.83,.81,.98),(-1.42,.75,.735,.92),(-1.55,.69,.68,.78)]
deck_sections=[]
for z,spine,deck,k in DECK:
 deck_sections.append([(0,spine,z),(.05,deck+.03,z),(.20*k,deck,z),(.55*k,deck-.005,z),(.80*k,deck-.02,z),(.87*k,deck-.16,z),(.80*k,deck-.30,z),(.62*k,deck-.38,z)])
loft('Rear deck',deck_sections,paint,thick=.022,bevel=.007)
for s in [-1,1]:
 panel('Tail lamp housing',[(s*.10,.72,-1.555),(s*.42,.735,-1.55),(s*.66,.70,-1.45),(s*.64,.61,-1.44),(s*.44,.66,-1.545),(s*.10,.655,-1.555)],trim,.025,.008)
 panel('Tail lamp lens',[(s*.12,.71,-1.575),(s*.41,.724,-1.57),(s*.63,.69,-1.475),(s*.62,.63,-1.465),(s*.43,.672,-1.565),(s*.12,.665,-1.575)],tail,.008,.004)
 tube('Tail LED bar',[(s*.14,.70,-1.585),(s*.40,.712,-1.58),(s*.61,.68,-1.49)],.007,lamp,sides=5)
 box('Rear reflector',(s*.30,.655,-1.578),(.14,.018,.01),amber,bevel=.004)
 panel('Rear valance',[(s*.18,.62,-1.49),(s*.56,.62,-1.49),(s*.64,.44,-1.40),(s*.35,.31,-1.20),(s*.18,.39,-1.18)],trim,.027,.013)
a=Vector((.22,.68,-1.14));b=Vector((.22,.36,-1.49));axis=(b-a).normalized();v=axis.cross(Vector((1,0,0))).normalized();u=axis.cross(v)
tube('Rear coilover shaft',[a,b],.017,alloy)
tube('Rear spring',[a+(b-a)*i/72+.045*(math.cos(i/72*math.tau*8)*v+math.sin(i/72*math.tau*8)*u) for i in range(73)],.008,graphite,sides=6)
rv=[];rf=[]
for i in range(29):
 a=.35+i/28*2.3
 for x in [-.168,.168]:rv.append((x,.354+math.sin(a)*.385,-1.47+math.cos(a)*.385))
 if i<28:rf.append((2*i,2*i+1,2*i+3,2*i+2))
mesh('Rear wheel mudguard',rv,rf,trim,thick=.011,smooth=True)
exhaust=empty('Exhaust',body)
tube('Exhaust pipe',[(.42,.27,.17),(.56,.26,-.49),(.51,.26,-1.05)],.028,rotor,exhaust)
tube('Exhaust canister',[(.51,.26,-.58),(.51,.26,-1.10)],.07,graphite,exhaust,sides=16)
tube('Exhaust tip',[(.51,.26,-1.08),(.51,.26,-1.18)],.052,exhaust_finish,exhaust,sides=24)
tube('Exhaust bore',[(.51,.26,-1.184),(.51,.26,-1.193)],.041,trim,exhaust,sides=20)
rim_nodes=[]
for index,(x,z,r,width) in enumerate([(-.8775,1.197,.333,.225),(.8775,1.197,.333,.225),(0,-1.47,.354,.305)]):
 pivot=empty('Pivot_'+str(index),None,(x,r,z));wheel=empty('Wheel_'+str(index),pivot)
 # Flattened toroidal tire profile, accurate contact radius and section width.
 v=[];f=[];profile=[(-width*.50,r*.74),(-width*.50,r*.88),(-width*.44,r*.97),(-width*.30,r),(width*.30,r),(width*.44,r*.97),(width*.50,r*.88),(width*.50,r*.74)]
 for a in range(64):
  t=a/64*math.tau
  for xx,rr in profile:v.append((xx,math.cos(t)*rr,math.sin(t)*rr))
 for a in range(64):
  for j in range(len(profile)-1):f.append((a*8+j,((a+1)%64)*8+j,((a+1)%64)*8+j+1,a*8+j+1))
 mesh('Tire_'+str(index),v,f,rubber,wheel,smooth=True)
 for sx in [-1,1]:
  # Fine shoulder grooves are geometry only at hero LOD.
  for a in range(40):
   t=a/40*math.tau
   tube('Tread detail',[(sx*width*.35,math.cos(t)*r*1.001,math.sin(t)*r*1.001),(sx*width*.445,math.cos(t+.03)*r*.973,math.sin(t+.03)*r*.973)],.0017,trim,wheel,sides=4)
  xx=sx*width*.49;rim=empty('Rim_'+str(index)+'_'+str(sx),wheel);rim_nodes.append(rim)
  torus('Machined rim lip',(xx,0,0),r*.722,.011,wheel_finish,rim,segments=48)
  torus('Rim inner edge',(xx-sx*.006,0,0),r*.645,.006,graphite,rim,segments=40)
  for i in range(5):
   a=i/5*math.tau
   for sweep in [-1,1]:
    tube('Split spoke',[(xx,.045*math.cos(a),.045*math.sin(a)),(xx,.145*math.cos(a+sweep*.07),.145*math.sin(a+sweep*.07)),(xx,r*.70*math.cos(a+sweep*.16),r*.70*math.sin(a+sweep*.16))],.013,wheel_finish,rim,sides=6)
   torus('Lug',(xx+sx*.011,.043*math.cos(a),.043*math.sin(a)),.005,.002,wheel_finish,rim,segments=8,sides=4)
  tube('Center hub',[(xx-sx*.01,0,0),(xx+sx*.016,0,0)],.031,graphite,rim,sides=20)
  torus('Brake rotor',(sx*width*.20,0,0),r*.52,.018,rotor,wheel,segments=48)
 box('Brake caliper',(width*.27,.09,-.115),(.047,.125,.062),stitch,pivot,bevel=.012)
# Driver is a deliberately separate stylized articulated accessory, removable in showroom.
box('Driver torso',(.37,.77,-.49),(.28,.34,.17),graphite,ride,bevel=.075)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.12,location=co((.37,1.04,-.54)))
finish(bpy.context.object,'Helmet',alloy,ride,True)
box('Helmet visor',(.37,1.046,-.434),(.19,.073,.026),graphite,ride,bevel=.024)
for s in [-1,1]:
 tube('Driver arm',[(.37+s*.125,.87,-.49),(.37+s*.16,.72,-.35),(.37+s*.11,.75,-.2)],.031,graphite,ride)
 tube('Driver leg',[(.37+s*.09,.51,-.49),(.37+s*.11,.4,-.13),(.37+s*.1,.27,.17)],.044,graphite,ride)
# Merge by parent/material to retain animation but avoid hundreds of draw calls.
def merge_materials():
 buckets={}
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH':buckets.setdefault((o.parent.name if o.parent else '',o.data.materials[0].name if o.data.materials else ''),[]).append(o)
 for (parent,mat),objs in buckets.items():
  if len(objs)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=(parent or 'Root')+'_'+mat
merge_materials()
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 # Consistent local-metre box UVs: three repeats per metre, no directional light baked in.
 uv=o.data.uv_layers.new(name='MaterialUV')
 for p in o.data.polygons:
  axis=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3) if i!=axis]
  for li in p.loop_indices:
   v=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]*3,v[axes[1]]*3)
for o in bpy.context.scene.objects:o.select_set(True)
def stats():
 deps=bpy.context.evaluated_depsgraph_get();tri=0
 for o in bpy.context.scene.objects:
  if o.type=='MESH':m=o.evaluated_get(deps).to_mesh();m.calc_loop_triangles();tri+=len(m.loop_triangles)
 return {'triangles':tri,'meshes':sum(o.type=='MESH' for o in bpy.context.scene.objects)}
high=stats()
bounds=[[],[],[]]
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 for corner in o.bound_box:
  p=o.matrix_world@Vector(corner)
  for i,v in enumerate((p.x,p.z,-p.y)):bounds[i].append(v)
measured_bounds={'min':[min(v) for v in bounds],'max':[max(v) for v in bounds],'size':[max(v)-min(v) for v in bounds]}
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'slingshot-r-inspired.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'slingshot-r-hero.glb'),export_format='GLB',export_yup=True,export_apply=True,export_extras=True)
# Separate real reduced LOD file keeps network and vertex cost selectable.
for o in bpy.context.scene.objects:
 if o.type=='MESH' and len(o.data.polygons)>90:
  # Smooth lofted paint keeps more of its curvature on the reduced tier; trim/interior reduce harder.
  d=o.modifiers.new('Mobile simplification','DECIMATE');d.ratio=.8 if 'BodyPaint' in o.name else .38
low=stats()
bpy.ops.export_scene.gltf(filepath=str(OUT/'slingshot-r-lod.glb'),export_format='GLB',export_yup=True,export_apply=True)
for o in bpy.context.scene.objects:
 for m in list(o.modifiers):
  if m.type=='DECIMATE':o.modifiers.remove(m)
# Orthographic and turntable evidence: actual mesh, neutral studio, no compositing.
ride.hide_render=True
for o in ride.children_recursive:o.hide_render=True
box('Studio floor',(0,-.035,0),(200,.04,200),material('StudioFloor',(.17,.19,.22),0,.8),None,0)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.color=(.25,.25,.25)
def area(name,p,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=co(p);o.rotation_euler=(co((0,.4,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(-3,5,4),800,5);area('Fill',(4,3,1),650,4);area('Rim',(0,4,-4),950,3)
camdata=bpy.data.cameras.new('EvidenceCamera');cam=bpy.data.objects.new('EvidenceCamera',camdata);scene.collection.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.ortho_scale=4.75
scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
def render(name,p,target=(0,.59,0)):
 if '--asset-only' in sys.argv:return
 cam.location=co(p);cam.rotation_euler=(co(target)-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
for name,p in [('front',(0,.64,7)),('rear',(0,.64,-7)),('side',(7,.64,0)),('three-quarter',(4,2.3,5)),('cockpit',(2.3,2.2,-3.2))]:render(name,p)
scene.render.resolution_x=640;scene.render.resolution_y=400;scene.cycles.samples=12
for i in range(72):
 if '--stills-only' in sys.argv:break
 a=i/72*math.tau;render('turntable-%02d'%i,(5*math.sin(a),2.1,5*math.cos(a)))
record={'id':'slingshot-r-inspired-2025','created':'2026-09-09','classification':'original Blender-authored approximation','reference':'2025 Polaris Slingshot R, ProStar generation','license':'Original project geometry; no manufacturer mesh, photo, logo or CAD included. References are not redistributed. No OEM endorsement or exact-fit claim.','units':'metres, Y up, +Z forward','wheelCenters':[[-.8775,.333,1.197],[.8775,.333,1.197],[0,.354,-1.47]],'frontTrack':1.755,'wheelbase':2.667,'measuredBounds':measured_bounds,'high':high,'low':low,'files':{}}
for p in [OUT/'slingshot-r-hero.glb',OUT/'slingshot-r-lod.glb',ART/'slingshot-r-inspired.blend',*ART.glob('*micro-normal.png')]:
 record['files'][str(p.relative_to(ROOT)).replace('\\','/')]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(ART/'asset-evidence.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print('HERO_ASSET_COMPLETE',json.dumps(record))
