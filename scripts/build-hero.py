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
# A glTF-extra contract keeps authored links attached to the simulated wheel centers.
def suspension_link(name,anchor,end,wheel_index,offset,radius=.017,spring=False):
 length=(Vector(end)-Vector(anchor)).length
 g=empty(name,body,anchor)
 g.rotation_mode='QUATERNION';g.rotation_quaternion=Vector((0,0,1)).rotation_difference(co(Vector(end)-Vector(anchor)).normalized())
 g['wheelIndex']=wheel_index;g['suspensionAnchor']=list(anchor);g['wheelOffset']=list(offset);g['restLength']=length
 tube('Damper shaft' if spring else 'Wishbone link',[(0,0,0),(0,length,0)],radius,alloy if spring else graphite,g,sides=8)
 if spring:
  tube('Damper body',[(0,length*.08,0),(0,length*.55,0)],.028,graphite,g,sides=10)
  turns=7;points=[(.037*math.cos(i/56*math.tau*turns),length*(.10+.68*i/56),.037*math.sin(i/56*math.tau*turns)) for i in range(57)]
  tube('Working coil',points,.0065,stitch if wheel_index<2 else graphite,g,sides=6)
 return g

def annulus(name,xx,inner,outer,depth,mat,parent,segments=48):
 verts=[];faces=[]
 for x in [xx-depth/2,xx+depth/2]:
  for radius in [inner,outer]:
   for j in range(segments):a=j/segments*math.tau;verts.append((x,radius*math.cos(a),radius*math.sin(a)))
 for j in range(segments):
  k=(j+1)%segments
  faces.extend([(j,k,segments+k,segments+j),(2*segments+j,3*segments+j,3*segments+k,2*segments+k),
   (j,2*segments+j,2*segments+k,k),(segments+j,segments+k,3*segments+k,3*segments+j)])
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
 # Forged hoop shape: polygonal trapezoid, not round roll-cage tube.
 hoop=[(s*.17,.66,-.82),(s*.18,1.17,-.88),(s*.24,1.29,-.88),(s*.52,1.29,-.88),(s*.59,1.17,-.88),(s*.65,.66,-.82)]
 tube('Forged roll hoop',hoop,.033,graphite,sides=6)
 tube('Hoop inlay',[(s*.23,1.14,-.876),(s*.27,1.22,-.879),(s*.49,1.22,-.879),(s*.54,1.14,-.876)],.008,alloy,sides=6)
 # Continuous contoured buckets from the supplied side/front reference angles.
 # Shoulder wings taper into an integrated headrest instead of stacked boxes.
 x=s*.37
 box('Seat base',(x,.44,-.52),(.44,.10,.49),trim,bevel=.045)
 seat_rows=[(.51,.16,-.63),(.60,.185,-.67),(.76,.205,-.73),(.89,.205,-.77),(.95,.151,-.80),(1.065,.119,-.83),(1.105,.083,-.837)]
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
rows=[(-.005,.73,.60),(.18,.77,.64),(.32,.79,.66),(.50,.79,.67),(.67,.77,.66),(.84,.73,.66),(1.0,.68,.66),(1.16,.63,.63),(1.3,.59,.59),(1.44,.545,.54),(1.56,.50,.48),(1.68,.471,.44),(1.78,.445,.40)]
def hood_height(z,y,u):
 # Distinct central shoulder and two recessed longitudinal channels. Keep the
 # existing outer boundaries so the opaque wing/nose returns still seal.
 nose_blend=max(0,min(1,(z-1.3)/.48));nose_blend=nose_blend*nose_blend*(3-2*nose_blend)
 crown=(.058+.05*nose_blend)*(1-u*u)
 channel=.031*math.exp(-((abs(u)-.63)/.14)**2)*math.sin(min(1,max(0,z/1.78))*math.pi)
 ridge=.014*math.exp(-((abs(u)-.36)/.12)**2)*math.sin(min(1,max(0,z/1.78))*math.pi)
 return y+crown-channel+ridge
vs=[];fs=[];n=28
for z,y,w in rows:
 for j in range(n+1):u=j/n*2-1;vs.append((w*u,hood_height(z,y,u),z))
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
 tube('Headlight reflector',[(x,y+.003,z+.013) for x,y,z in brow],.019,alloy,sides=8)
 tube('Front accent optic',[(x,y+.003,z+.026) for x,y,z in brow],.010,lamp,sides=8)
 # Painted eyebrow surrounds the recessed lens, with an opaque black optical bed.
 tube('Headlight upper eyelid',[(x,y+.039,z+.026) for x,y,z in brow],.013,paint,sides=6)
 for a,b in zip(brow[:-1],brow[1:]):
  for j in range(1,4):
   t=j/4;p=Vector(a).lerp(Vector(b),t)
   tube('Optical lens divider',[(p.x,p.y-.009,p.z+.028),(p.x,p.y+.015,p.z+.028)],.0026,alloy,sides=4)
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
 # Four separate control arms and a coilover deform with the actual wheel contact.
 wi=0 if s<0 else 1
 for y in [.23,.39]:
  for z in [.7,1.42]:
   offset=(-s*.035,y-.333,0)
   suspension_link('Suspension_%d_arm_%s_%s'%(wi,y,z),(s*.44,y,z),(s*.8425,y,1.197),wi,offset)
 suspension_link('Suspension_%d_coil'%wi,(s*.52,.63,.96),(s*.832,.25,1.19),wi,(-s*.0455,-.083,-.007),spring=True)
# Center opening is backed, framed and optically detailed; no glowing empty shell.
panel('Nose bridge',[(-.4,.445,1.78),(.4,.445,1.78),(.4,.399,1.836),(-.4,.399,1.836)],paint,.028,.01)
nv=[];nf=[]
for j in range(13):
 u=j/12*2-1;nv.extend([(.4*u,hood_height(1.78,.445,u),1.78),(.4*u,.414,1.831)])
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
box('Projector recess',(0,.480,1.805),(.40,.102,.060),trim,bevel=.017)
pv=[];pf=[]
for j in range(13):
 u=j/12*2-1;pv.extend([(.23*u,hood_height(1.78,.445,.23*u/.4)+.003,1.785),(.19*u,.523,1.847)])
 if j<12:pf.append((2*j,2*j+1,2*j+3,2*j+2))
mesh('Integrated projector eyebrow',pv,pf,paint,thick=.012,bevel=.004,smooth=True)
for s in [-1,1]:
 panel('Projector cheek',[(s*.23,.52,1.785),(s*.19,.523,1.847),(s*.19,.428,1.847),(s*.26,.427,1.82)],paint,.014,.006)
for x in [-.112,-.056,0,.056,.112]:
 box('Projector reflector',(x,.480,1.832),(.049,.057,.009),alloy,bevel=.009)
 box('Projector lens',(x,.480,1.839),(.036,.034,.01),lamp,bevel=.008)
box('Scoop inlet',(0,.853,.40),(.185,.040,.06),trim,bevel=.009)
panel('Scoop top',[(-.105,.843,.21),(-.105,.888,.37),(.105,.888,.37),(.105,.843,.21)],paint,.014,.005)
for s in [-1,1]:
 for j in range(4):
  z=.37+j*.072;y=.79 if z<=.5 else .79-(z-.5)*.12
  box('Hood vent',(s*.40,hood_height(z,y,.4/.66)+.003,z),(.105,.006,.023),trim,bevel=.004)
# Single rear contact, drive housing, belt cover, rear wheel cap and low exhaust.
tube('Rear swingarm',[(.21,.37,-.7),(.23,.333,-1.47)],.065,graphite)
box('Belt cover',(-.15,.44,-1.23),(.08,.13,.65),trim,bevel=.04)
# Rear shoulder deck, center spine and scalloped closeout visible from chase view.
for s in [-1,1]:
 panel('Rear shoulder deck',[(s*.095,.86,-.86),(s*.23,1.005,-.93),(s*.54,.987,-.93),(s*.70,.78,-1.18),(s*.57,.705,-1.37),(s*.16,.705,-1.37)],paint,.024,.017)
 panel('Rear quarter return',[(s*.70,.78,-1.18),(s*.57,.705,-1.37),(s*.58,.425,-1.24),(s*.69,.42,-.97)],paint,.022,.012)
 panel('Rear valance',[(s*.18,.69,-1.325),(s*.56,.69,-1.325),(s*.64,.44,-1.235),(s*.35,.31,-1.10),(s*.18,.39,-1.08)],trim,.027,.013)
 tube('Tail optical housing',[(s*.12,.731,-1.388),(s*.38,.741,-1.391),(s*.575,.788,-1.298),(s*.632,.705,-1.262)],.031,trim,sides=8)
 tube('Tail angular lens',[(s*.12,.735,-1.418),(s*.38,.746,-1.421),(s*.575,.793,-1.329),(s*.632,.71,-1.292)],.012,tail,sides=8)
 tube('Rear reflector trim',[(s*.19,.772,-1.39),(s*.36,.781,-1.389),(s*.47,.804,-1.343)],.008,alloy,sides=6)
panel('Center tail spine left',[(-.045,.79,-.70),(0,1.04,-.76),(0,.72,-1.44),(-.08,.705,-1.35)],paint,.018,.01)
panel('Center tail spine right',[(.045,.79,-.70),(0,1.04,-.76),(0,.72,-1.44),(.08,.705,-1.35)],paint,.018,.01)
suspension_link('Suspension_2_coil',(.22,.68,-1.14),(.22,.36,-1.49),2,(.22,.006,-.02),spring=True)
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
 # Continuous molded tread: real recessed circumferential channels and swept sipes.
 profile=[(-.5,.74),(-.5,.88),(-.46,.965),(-.36,.995),(-.27,1),(-.245,1),(-.23,.981),(-.195,.981),(-.18,1),(-.06,1),(-.042,.981),(-.01,.981),(.005,1),(.15,1),(.166,.981),(.198,.981),(.215,1),(.31,1),(.39,.992),(.46,.965),(.5,.88),(.5,.74)]
 v=[];f=[];segments=96;count=len(profile)
 for ai in range(segments):
  angle=ai/segments*math.tau
  for fx,fr in profile:
   sipe=.004 if abs(fx)<.41 and ((ai+int(abs(fx)*15))%8==0) else 0
   rr=r*fr-sipe;v.append((fx*width,math.cos(angle)*rr,math.sin(angle)*rr))
 for ai in range(segments):
  for j in range(count-1):f.append((ai*count+j,((ai+1)%segments)*count+j,((ai+1)%segments)*count+j+1,ai*count+j+1))
 mesh('Tire_'+str(index),v,f,rubber,wheel,smooth=True)
 for sx in [-1,1]:
  xx=sx*width*.49;rim=empty('Rim_'+str(index)+'_'+str(sx),wheel);rim_nodes.append(rim)
  torus('Machined rim lip',(xx,0,0),r*.722,.010,wheel_finish,rim,segments=48)
  torus('Rim inner edge',(xx-sx*.006,0,0),r*.645,.006,graphite,rim,segments=40)
  # Forged ribbon spokes have broad machined faces and genuine depth, not round rods.
  for i in range(5):
   angle=i/5*math.tau
   for sweep in [-1,1]:
    outline=[]
    for radius,offset in [(.045,-.11),(.13,sweep*.07-.065),(r*.70,sweep*.16-.045),(r*.70,sweep*.16+.045),(.13,sweep*.07+.065),(.045,.11)]:
     outline.append((xx,radius*math.cos(angle+offset),radius*math.sin(angle+offset)))
    mesh('Forged spoke',outline,[tuple(range(6))],wheel_finish,rim,thick=.015,bevel=.002)
   tube('Lug bolt',[(xx-sx*.005,.043*math.cos(angle),.043*math.sin(angle)),(xx+sx*.013,.043*math.cos(angle),.043*math.sin(angle))],.005,alloy,rim,sides=6)
  tube('Center hub',[(xx-sx*.01,0,0),(xx+sx*.016,0,0)],.031,graphite,rim,sides=20)
  annulus('Ventilated brake disc',sx*width*.20,.075,r*.55,.014,rotor,wheel)
  for j in range(18):
   a=j/18*math.tau
   for radius in [r*.40,r*.48]:
    tube('Disc drilled recess',[(sx*(width*.2+.008),radius*math.cos(a),radius*math.sin(a)),(sx*(width*.2+.0085),radius*math.cos(a),radius*math.sin(a))],.0036,trim,wheel,sides=6)
  torus('Molded sidewall bead',(sx*width*.502,0,0),r*.86,.0018,rubber,wheel,segments=48,sides=4)
 box('Brake caliper',(width*.27,.09,-.115),(.047,.125,.062),stitch,pivot,bevel=.012)
 # A recessed maker-neutral center cap preserves the wheel-finish customization.
 # No badges or manufacturer artwork are embedded.
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
bpy.ops.export_scene.gltf(filepath=str(OUT/'slingshot-r-lod.glb'),export_format='GLB',export_yup=True,export_apply=True,export_extras=True)
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
record={'id':'slingshot-r-inspired-2025','created':'2026-09-10','classification':'original Blender-authored approximation','reference':'2025 Polaris Slingshot R, ProStar generation','license':'Original project geometry; no manufacturer mesh, photo, logo or CAD included. References are not redistributed. No OEM endorsement or exact-fit claim.','units':'metres, Y up, +Z forward','wheelCenters':[[-.8775,.333,1.197],[.8775,.333,1.197],[0,.354,-1.47]],'frontTrack':1.755,'wheelbase':2.667,'measuredBounds':measured_bounds,'high':high,'low':low,'files':{}}
for p in [OUT/'slingshot-r-hero.glb',OUT/'slingshot-r-lod.glb',ART/'slingshot-r-inspired.blend',*ART.glob('*micro-normal.png')]:
 record['files'][str(p.relative_to(ROOT)).replace('\\','/')]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(ART/'asset-evidence.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print('HERO_ASSET_COMPLETE',json.dumps(record))
