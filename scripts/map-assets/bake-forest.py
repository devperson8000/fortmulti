"""Bake the five downloaded trees individually; weld facet duplicates for component assignment."""
import bpy,json,sys,math
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]
outfile=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else root/'forest-geometry.json'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'public/maps/ironwood/forest-source.glb'))
o=next(o for o in bpy.data.objects if o.type=='MESH');m=o.data;m.calc_loop_triangles();uv=m.uv_layers.active.data
im=Image.open(str(root/'public/maps/ironwood/Textures/colormap.png')).convert('RGB')
triangles=[];parent={}
def find(k):
 parent.setdefault(k,k)
 if parent[k]!=k:parent[k]=find(parent[k])
 return parent[k]
for t in m.loop_triangles:
 p=[o.matrix_world@m.vertices[v].co for v in t.vertices]
 if max(v.z for v in p)<=.051:continue
 u=uv[t.loops[0]].uv;col=im.getpixel((min(im.width-1,int(u.x*im.width)),min(im.height-1,int((1-u.y)*im.height))))
 keys=[tuple(round(v[i],5) for i in range(3)) for v in p]
 for k in keys:parent[find(k)]=find(keys[0])
 triangles.append((p,col,keys))
components={}
for triangle in triangles:components.setdefault(find(triangle[2][0]),[]).append(triangle)
# Determine each real trunk's center from the bottom skin vertices.
trunks=[]
for group in components.values():
 p=[v for t in group for v in t[0]]
 if min(v.z for v in p)<.12 and max(v.z for v in p)>.12 and sum(v.z for v in p)/len(p)<.25:
  bottom=[v for v in p if v.z<min(q.z for q in p)+.001]
  center=((min(v.x for v in bottom)+max(v.x for v in bottom))/2,-(min(v.y for v in bottom)+max(v.y for v in bottom))/2)
  trunks.append((*center,min(v.z for v in p)))
trunks=sorted(trunks)
if len(trunks)!=5:raise Exception('Expected five native trunks, got '+str(trunks))
out=[{'offset':list(center[:2]),'vertices':[]} for center in trunks]
for group in components.values():
 p=[v for t in group for v in t[0]];cx=(min(v.x for v in p)+max(v.x for v in p))/2;cz=-(min(v.y for v in p)+max(v.y for v in p))/2
 index=min(range(5),key=lambda k:math.hypot(cx-trunks[k][0],cz-trunks[k][1]));ox,oz,base=trunks[index]
 for p,col,_ in group:
  for v in p:out[index]['vertices'].extend([round(v.x-ox,5),round(v.z-base,5),round(-v.y-oz,5),*[round(c/255,4) for c in col]])
json.dump(out,open(outfile,'w'));print('Components',len(components),'trunks',trunks,'vertices',[len(t['vertices'])//6 for t in out])
