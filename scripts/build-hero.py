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
glass=material('Windscreen',(.19,.29,.34),0,.12,.5)
glass.diffuse_color=(.19,.29,.34,.27)
glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.27
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
 panel('Rocker outer',[(s*.68,.2,-1.02),(s*.81,.27,-.65),(s*.81,.37,.25),(s*.65,.51,.79),(s*.58,.29,.85)],paint,.025,.018)
 tube('Lower sill',[(s*.7,.22,-.99),(s*.8,.25,-.6),(s*.8,.29,.14),(s*.66,.35,.72)],.034,graphite)
 panel('Upper sideblade',[(s*.69,.77,-.92),(s*.79,.5,-.72),(s*.79,.41,.05),(s*.69,.54,.55),(s*.70,.43,-.12)],paint,.017,.01)
 panel('Seat rear fairing',[(s*.09,.56,-1.12),(s*.18,.83,-.98),(s*.59,.91,-.94),(s*.71,.69,-1.08),(s*.61,.38,-1.2)],paint,.022,.014)
 tube('Rear blade light',[(s*.08,.57,-1.154),(s*.35,.58,-1.203),(s*.61,.7,-1.134)],.017,tail)
 # Forged hoop shape: polygonal trapezoid, not round roll-cage tube.
 hoop=[(s*.17,.66,-.82),(s*.18,1.17,-.88),(s*.24,1.29,-.88),(s*.52,1.29,-.88),(s*.59,1.17,-.88),(s*.65,.66,-.82)]
 tube('Forged roll hoop',hoop,.033,graphite,sides=6)
 tube('Hoop inlay',[(s*.23,1.14,-.876),(s*.27,1.22,-.879),(s*.49,1.22,-.879),(s*.54,1.14,-.876)],.008,alloy,sides=6)
 # Seat shells with curved bolsters, red stitch seam and inset upholstery.
 x=s*.37
 box('Seat base',(x,.44,-.52),(.44,.12,.51),trim,bevel=.055)
 box('Seat cushion',(x,.511,-.52),(.32,.07,.37),leather,bevel=.04)
 back=box('Seat shell',(x,.78,-.754),(.44,.53,.16),trim,bevel=.055)
 # Parent-space geometry: do not rotate the seat around the tub origin.
 box('Seat back inset',(x,.8,-.65),(.30,.38,.08),leather,bevel=.03)
 box('Head restraint',(x,1.035,-.72),(.25,.19,.115),leather,bevel=.035)
 for sx in [-1,1]:
  tube('Seat bolster',[(x+sx*.18,.51,-.39),(x+sx*.19,.58,-.6),(x+sx*.17,.91,-.68)],.041,leather)
  tube('Seat contrast seam',[(x+sx*.14,.53,-.38),(x+sx*.15,.57,-.59),(x+sx*.14,.91,-.628)],.004,stitch,sides=5)
 for j in range(5):tube('Cushion stitching',[(x-.13,.551,-.39-j*.055),(x+.13,.551,-.39-j*.055)],.002,graphite,sides=4)
 # Mirrors on clearly separate stalks.
 tube('Mirror arm',[(s*.61,.72,.17),(s*.76,.89,.1)],.015,graphite)
 box('Mirror housing',(s*.77,.902,.105),(.19,.074,.07),graphite,bevel=.026)
 box('Mirror glass',(s*.77,.9,.064),(.15,.047,.008),alloy,bevel=.012)
# Formed dashboard, touchscreen, pedals and two gauges.
box('Dashboard',(0,.69,.052),(1.25,.24,.22),trim,bevel=.06)
box('Screen housing',(0,.74,-.083),(.23,.18,.034),graphite,bevel=.014)
box('Screen display',(0,.747,-.103),(.189,.126,.004),screen,bevel=.004)
for x in [-.075,0,.075]:box('Console button',(x,.616,-.115),(.031,.021,.015),alloy,bevel=.004)
for x in [.28,.46]:
 torus('Gauge bezel',(x,.769,-.076),.07,.008,alloy,axis='z',segments=32)
 box('Gauge face',(x,.77,-.073),(.124,.124,.015),trim,bevel=.05)
 needle=empty('SpeedNeedle' if x==.28 else 'RpmNeedle',body,(x,.769,-.089))
 tube('Gauge needle',[(0,0,0),(-.027,.034,0)],.003,tail,needle)
for x in [.31,.43]:box('Pedal',(x,.28,.21),(.055,.09,.033),alloy,bevel=.005)
steer=empty('Steering',body,(.37,.739,-.207))
torus('Steering rim',(0,0,0),.135,.014,leather,steer,axis='z',segments=48)
for angle in [0,2.2,4.08]:tube('Steering spoke',[(0,0,0),(.115*math.sin(angle),.115*math.cos(angle),0)],.014,graphite,steer)
box('Steering hub',(0,0,.0),(.085,.076,.034),graphite,steer,bevel=.025)
tube('Gear stick',[(.07,.56,-.39),(.07,.64,-.43)],.012,alloy)
box('Gear knob',(.07,.657,-.431),(.045,.038,.05),leather,bevel=.018)
# Swept wind deflector, low enough to retain the characteristic open silhouette.
wv=[];wf=[]
for i in range(25):
 x=(i/24-.5)*1.23;z=.19-.1*(x/.615)**2;y=.73
 wv.extend([(x,y,z),(x,y+.2+.025*math.cos(x*4),z-.058)])
 if i<24:wf.append((2*i,2*i+2,2*i+3,2*i+1))
mesh('Windscreen',wv,wf,glass,thick=.003,smooth=True)
# Main hood loft: central muscular crown, a crisp valley inside each front brow.
rows=[(-.005,.73,.60),(.32,.79,.66),(.67,.77,.66),(1.0,.68,.66),(1.3,.59,.59),(1.56,.50,.48),(1.78,.445,.40)]
vs=[];fs=[];n=12
for z,y,w in rows:
 for j in range(n+1):u=j/n*2-1;vs.append((w*u,y+.055*(1-u*u),z))
for i in range(len(rows)-1):
 for j in range(n):a=i*(n+1)+j;fs.append((a,a+1,a+n+2,a+n+1))
mesh('Hood crown',vs,fs,paint,thick=.022,bevel=.005,smooth=True)
for s in [-1,1]:
 # Continuous opaque return under the crown; no accidental view through the nose.
 v=[];f=[]
 for z,y,w in rows:v.extend([(s*w,y,z),(s*(w-.008),max(.31,y-.18),z)])
 for i in range(len(rows)-1):f.append((2*i,2*i+1,2*i+3,2*i+2))
 mesh('Hood inner return',v,f,graphite,thick=.012)
 # Swooping outer wing blends its elevated fender into the central V-shaped nose.
 grid=[[(.40,.445,1.78),(.58,.565,1.69),(.97,.744,1.55)],[(.48,.50,1.56),(.65,.655,1.38),(.98,.78,1.32)],[(.59,.59,1.3),(.67,.716,1.05),(.94,.774,1.04)],[(.66,.68,1.0),(.68,.726,.86),(.84,.705,.69)]]
 verts=[(s*x,y,z) for row in grid for x,y,z in row];faces=[]
 for i in range(3):
  for j in range(2):a=i*3+j;faces.append((a,a+1,a+4,a+3))
 mesh('Sculpted upper wing',verts,faces,paint,thick=.025,bevel=.007,smooth=True)
 # A separate dark blade makes the shape legible without flat black hood acreage.
 panel('Wing contrast blade',[(s*.57,.576,1.69),(s*.963,.751,1.55),(s*.966,.787,1.34),(s*.64,.665,1.43)],graphite,.009,.004)
 panel('Painted fascia upper',[(s*.41,.44,1.79),(s*.98,.72,1.59),(s*.984,.6,1.73),(s*.57,.365,1.87)],paint,.03,.008)
 panel('Fascia lower',[(s*.57,.365,1.87),(s*.984,.6,1.73),(s*.974,.22,1.8),(s*.43,.155,1.90)],paint,.027,.009)
 panel('Fascia inner closeout',[(s*.4,.44,1.79),(s*.57,.365,1.87),(s*.43,.155,1.90),(s*.48,.245,1.894),(s*.4,.40,1.836)],paint,.025,.005)
 panel('Fascia side closure',[(s*.98,.72,1.59),(s*.98,.54,1.29),(s*.984,.255,1.57),(s*.974,.22,1.8)],paint,.028,.009)
 panel('Intake shadow',[(s*.615,.286,1.878),(s*.92,.493,1.806),(s*.927,.249,1.84)],trim,.012,.006)
 for j in range(4):tube('Intake vertical louver',[(s*(.69+j*.054),.267,1.875-j*.01),(s*(.69+j*.054),.318+j*.038,1.866-j*.01)],.009,graphite)
 # Deep optical housings and layered lenses, matching the R-style upward signature.
 brow=[(s*.58,.539,1.77),(s*.707,.586,1.744),(s*.935,.695,1.681)]
 tube('Headlight socket',brow,.036,trim,sides=8)
 tube('Headlight reflector',[(x,y+.003,z+.023) for x,y,z in brow],.021,alloy,sides=8)
 tube('Front accent optic',[(x,y+.003,z+.036) for x,y,z in brow],.012,lamp,sides=8)
 tube('Lower accent socket',[(s*.917,.28,1.86),(s*.942,.479,1.821)],.025,trim)
 tube('Lower accent optic',[(s*.917,.28,1.887),(s*.942,.479,1.848)],.011,lamp)
 box('Amber marker',(s*.965,.63,1.744),(.022,.061,.018),amber,bevel=.007)
 tube('Splitter wing',[(s*.40,.145,1.895),(s*.83,.158,1.872),(s*.974,.184,1.785),(s*.974,.22,1.60)],.016,graphite)
 # Wheel arch is a formed cap with thickness; intentionally exposed behind it.
 av=[];af=[]
 for i in range(25):
  a=-.05+i/24*2.84
  for j in range(4):
   x=.76+j*.071;r=.384+.008*math.sin(j/3*math.pi)
   av.append((s*x,.333+math.sin(a)*r,1.197+math.cos(a)*r))
 for i in range(24):
  for j in range(3):a=i*4+j;af.append((a,a+1,a+5,a+4))
 mesh('Formed fender',av,af,paint,thick=.018,bevel=.005,smooth=True)
 # Suspension remains exposed in the open gap behind the fender.
 for y in [.23,.39]:
  for z in [.7,1.42]:tube('Front wishbone',[(s*.44,y,z),(s*.858,.32,1.197)],.019,graphite)
 tube('Damper shaft',[(s*.52,.63,.96),(s*.832,.25,1.19)],.018,alloy)
 a=Vector((s*.54,.6,.97));b=Vector((s*.81,.28,1.18));axis=(b-a).normalized();v=axis.cross(Vector((0,0,1))).normalized();u=axis.cross(v)
 coil=[a+(b-a)*i/64+.033*(math.cos(i/64*math.tau*7)*v+math.sin(i/64*math.tau*7)*u) for i in range(65)]
 tube('Coil spring',coil,.007,stitch,sides=6)
# Center opening is backed, framed and optically detailed; no glowing empty shell.
panel('Nose bridge',[(-.4,.445,1.78),(.4,.445,1.78),(.4,.399,1.836),(-.4,.399,1.836)],paint,.028,.01)
nv=[];nf=[]
for j in range(13):
 u=j/12*2-1;nv.extend([(.4*u,.445+.055*(1-u*u),1.78),(.4*u,.414,1.831)])
 if j<12:nf.append((j*2,j*2+1,j*2+3,j*2+2))
mesh('Closed hood leading edge',nv,nf,paint,thick=.015,bevel=.004,smooth=True)
panel('Grille surround',[(-.4,.4,1.836),(.4,.4,1.836),(.48,.245,1.894),(.40,.16,1.908),(-.4,.16,1.908),(-.48,.245,1.894)],graphite,.025,.012)
box('Radiator backing',(0,.289,1.873),(.77,.22,.035),trim,bevel=.024)
for j in range(5):
 for i in range(17):
  x=(i-8)*.043+(j%2)*.021;y=.205+j*.038
  if abs(x)>.362:continue
  pts=[(x+.024*math.cos(k/6*math.tau),y+.016*math.sin(k/6*math.tau),1.903) for k in range(7)]
  tube('Honeycomb grille',pts,.0036,graphite,sides=4)
box('Projector recess',(0,.480,1.805),(.36,.079,.048),trim,bevel=.012)
for x in [-.112,-.056,0,.056,.112]:
 box('Projector reflector',(x,.480,1.832),(.049,.057,.009),alloy,bevel=.009)
 box('Projector lens',(x,.480,1.839),(.036,.034,.01),lamp,bevel=.008)
box('Scoop inlet',(0,.831,.34),(.20,.05,.13),trim,bevel=.012)
panel('Scoop top',[(-.12,.84,.17),(-.10,.889,.3),(.10,.889,.3),(.12,.84,.17)],paint,.017,.005)
for s in [-1,1]:
 for j in range(4):box('Hood vent',(s*.4,.78-j*.003,.36+j*.072),(.13,.011,.023),trim,bevel=.005)
# Single rear contact, drive housing, belt cover, rear wheel cap and low exhaust.
tube('Rear swingarm',[(.21,.37,-.7),(.23,.333,-1.47)],.065,graphite)
box('Belt cover',(-.15,.44,-1.23),(.08,.13,.65),trim,bevel=.04)
tube('Rear damper',[(.1,.67,-.96),(.11,.34,-1.44)],.024,alloy)
rv=[];rf=[]
for i in range(29):
 a=.03+i/28*2.88
 for x in [-.184,.184]:rv.append((x,.354+math.sin(a)*.405,-1.47+math.cos(a)*.405))
 if i<28:rf.append((2*i,2*i+1,2*i+3,2*i+2))
mesh('Rear wheel mudguard',rv,rf,graphite,thick=.013,smooth=True)
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
  d=o.modifiers.new('Mobile simplification','DECIMATE');d.ratio=.42
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
 a=i/72*math.tau;render('turntable-%02d'%i,(5*math.sin(a),2.1,5*math.cos(a)))
record={'id':'slingshot-r-inspired-2025','created':'2026-09-09','classification':'original Blender-authored approximation','reference':'2025 Polaris Slingshot R, ProStar generation','license':'Original project geometry; no manufacturer mesh, photo, logo or CAD included. References are not redistributed. No OEM endorsement or exact-fit claim.','units':'metres, Y up, +Z forward','wheelCenters':[[-.8775,.333,1.197],[.8775,.333,1.197],[0,.354,-1.47]],'frontTrack':1.755,'wheelbase':2.667,'measuredBounds':measured_bounds,'high':high,'low':low,'files':{}}
for p in [OUT/'slingshot-r-hero.glb',OUT/'slingshot-r-lod.glb',ART/'slingshot-r-inspired.blend',*ART.glob('*micro-normal.png')]:
 record['files'][str(p.relative_to(ROOT)).replace('\\','/')]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(ART/'asset-evidence.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print('HERO_ASSET_COMPLETE',json.dumps(record))
