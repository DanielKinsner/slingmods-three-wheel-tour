"""Render the actual saved vehicle master, without modifying or re-exporting game assets."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artwork/vehicle'
bpy.ops.wm.open_mainfile(filepath=str(ART/'slingshot-r-inspired.blend'))
def co(p):return Vector((p[0],-p[2],p[1]))
for o in bpy.data.objects['Rider'].children_recursive:o.hide_render=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.world.color=(.25,.25,.25)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
floor=bpy.context.object;m=bpy.data.materials.new('Neutral review floor');m.diffuse_color=(.16,.18,.2,1);floor.data.materials.append(m)
for name,p,power,size in [('Key',(-3,5,4),800,5),('Fill',(4,3,1),650,4),('Rim',(0,4,-4),950,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=co(p);o.rotation_euler=(co((0,.4,0))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Detail camera');cam=bpy.data.objects.new('Detail camera',d);scene.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO'
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
for name,p,target,scale in [('wheel-detail',(2.3,.68,2.4),(.8775,.36,1.197),1.15),('rear-suspension-detail',(1.3,.8,-2.7),(0,.48,-1.4),1.3)]:
 d.ortho_scale=scale;cam.location=co(p);cam.rotation_euler=(co(target)-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
