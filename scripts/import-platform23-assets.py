#!/usr/bin/env python3
"""Rebuild actual Platform 23 convex brushes/Bezier patches, textures and collision.
Usage: python scripts/import-platform23-assets.py [--texture-cache PATH] [--output PATH]
Requires Python 3, numpy, Pillow. Original map/shaders are retained in output/source.
Diffuse PNGs may be read from the research cache; otherwise pinned upstream sources
are downloaded with TLS verification. Collision is never reduced to brush AABBs.
"""
import argparse, collections, concurrent.futures, gzip, hashlib, itertools, json, re, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--texture-cache',type=Path,default=ROOT.parent/'fortmulti-artifacts/map-candidates');p.add_argument('--output',type=Path,default=ROOT/'public/maps/platform23');args=p.parse_args();out=args.output;source=out/'source';(out/'textures').mkdir(parents=True,exist_ok=True)
text=gzip.decompress((source/'plat23.map.gz').read_bytes()).decode();texture_meta=json.loads((source/'textures.json').read_text());shader_text='\n'.join(p.read_text() for p in sorted(source.glob('*.shader')))
SCALE=1/32;OFFSET=np.array([0.,0.,56.75]);CHUNK=8;SUBDIVISIONS=4

def cv(v):return np.asarray(v)[...,[0,2,1]]*np.array([SCALE,SCALE,-SCALE])+OFFSET
def normal_cv(v):return np.asarray(v)[...,[0,2,1]]*np.array([1,1,-1])
def rounded(v):return np.round(v,6).tolist()
def shader(name):
 marker='textures/'+name+'\n';return shader_text.split(marker,1)[1].split('\n}\n',1)[0] if marker in shader_text else ''
def nonsolid(name):return name=='common/trigger' or 'surfaceparm nonsolid' in shader(name)
def visible(name):return not name.startswith('common/') and '/sky' not in name
render=collections.defaultdict(list);brushes=[];patches=[];walkable=[];invalid=0;source_brushes=0;patch_count=0;recovered_ground_triangles=0

def triangle(mat,a,uv,n=None,collide=False):
 a=np.asarray(a);n=np.cross(a[1]-a[0],a[2]-a[0]) if n is None else np.asarray(n);length=np.linalg.norm(n)
 if length<1e-9:return
 n=n/length;world=cv(a);world_n=normal_cv(n)
 if collide and world_n[1]>.65:walkable.append(world.reshape(-1))
 if visible(mat):
  if 'terrain_' in mat:
   axes={'xy':[0,1],'xz':[0,2],'yz':[1,2]}[mat.rsplit('_',1)[1]];uv=a[:,axes]/256*np.array(texture_meta[mat]['size'])
  render[mat].append((world,np.asarray(uv),world_n))
facepat=re.compile(r'^\( ([-\d. ]+) \) \( ([-\d. ]+) \) \( ([-\d. ]+) \) (\S+) (.*)$',re.M)
for body in re.findall(r'\{([^{}]+)\}',text):
 faces=facepat.findall(body)
 if not faces:continue
 source_brushes+=1;pts=np.array([[[float(x) for x in v.split()] for v in f[:3]] for f in faces]);normals=np.cross(pts[:,2]-pts[:,0],pts[:,1]-pts[:,0]);lengths=np.linalg.norm(normals,axis=1)
 if np.any(lengths<1e-9):invalid+=1;continue
 normals/=lengths[:,None];dist=np.einsum('ij,ij->i',normals,pts[:,0]);vertices=[]
 for ids in itertools.combinations(range(len(faces)),3):
  m=normals[list(ids)]
  if abs(np.linalg.det(m))<1e-7:continue
  v=np.linalg.solve(m,dist[list(ids)])
  if np.all(normals@v<=dist+.03) and not any(np.linalg.norm(v-a)<.03 for a in vertices):vertices.append(v)
 if len(vertices)<4:invalid+=1;continue
 vertices=np.array(vertices);world=cv(vertices);flags=sorted({f[3] for f in faces});solid=not all(nonsolid(m) for m in flags)
 if solid:
  boundary=all(x=='common/caulk' or '/sky' in x for x in flags) and any('/sky' in x for x in flags)
  clip=any(x in ['common/playerclip','common/fullclip'] for x in flags) and all(x in ['common/playerclip','common/fullclip','common/slick'] for x in flags)
  wn=normal_cv(normals);wd=dist*SCALE+wn@OFFSET
  brushes.append({'source':source_brushes,'supportOnlyNative':True,'blocksShots':not(clip or boundary),'type':'boundary' if boundary else 'playerclip' if clip else 'solid','flags':flags,'min':rounded(world.min(0)),'max':rounded(world.max(0)),'planes':rounded(np.column_stack((wn,wd)))})
 for i,f in enumerate(faces):
  poly=vertices[np.abs(vertices@normals[i]-dist[i])<.05]
  if len(poly)<3:continue
  c=poly.mean(0);u=poly[0]-c;u/=np.linalg.norm(u);v=np.cross(normals[i],u);poly=poly[np.argsort(np.arctan2((poly-c)@v,(poly-c)@u))]
  axis=int(np.argmax(abs(normals[i])));ub=np.array([0,1,0]) if axis==0 else np.array([1,0,0]);vb=np.array([0,0,-1]) if axis!=2 else np.array([0,-1,0]);ox,oy,rot,sx,sy=[float(x) for x in f[4].split()[:5]];rad=np.deg2rad(rot);a=ub*np.cos(rad)-vb*np.sin(rad);b=ub*np.sin(rad)+vb*np.cos(rad);uv=np.column_stack((poly@a/(sx or 1)+ox,poly@b/(sy or 1)+oy))
  for k in range(1,len(poly)-1):
   ids=[0,k,k+1];triangle(f[3],poly[ids],uv[ids],normals[i],solid and not boundary and not clip and f[3] not in ['common/playerclip','common/fullclip','common/slick'])
   # Original invisible ground and roof support: retain each exact authored plane,
   # exposing its walkable top with original sand or metal textures. This repairs
   # invisible walkable terrain without introducing replacement geometry.
   if solid and not boundary and not clip and f[3]=='common/caulk' and -1.01<=world.max(0)[1]<=4.01 and normal_cv(normals[i])[1]>.99:
    ground_material='shared_pk02/floor09a' if world.max(0)[1]>2 else 'shared_pk02/sand01'
    ground_uv=poly[:,[0,1]]/256*np.array(texture_meta[ground_material]['size'])
    triangle(ground_material,poly[ids],ground_uv[ids],normals[i]);recovered_ground_triangles+=1
for body in re.findall(r'patchDef2\s*\{([^{}]+)\}',text):
 lines=body.strip().splitlines();mat=lines[0].strip();w,h=map(int,re.findall(r'\d+',lines[1])[:2]);vals=[list(map(float,v.split())) for v in re.findall(r'\(\s*([-\d.eE+]+\s+[-\d.eE+]+\s+[-\d.eE+]+\s+[-\d.eE+]+\s+[-\d.eE+]+)\s*\)', '\n'.join(lines[2:]))];assert len(vals)==w*h;cp=np.array(vals).reshape(w,h,5).transpose(1,0,2);patch_count+=1;patch_triangles=[]
 for y in range(0,h-2,2):
  for x in range(0,w-2,2):
   grid=[];controls=cp[y:y+3,x:x+3]
   for j in range(SUBDIVISIONS+1):
    t=j/SUBDIVISIONS;bv=np.array([(1-t)**2,2*t*(1-t),t*t]);row=[]
    for i in range(SUBDIVISIONS+1):
     t=i/SUBDIVISIONS;bu=np.array([(1-t)**2,2*t*(1-t),t*t]);row.append(np.einsum('i,j,ijc->c',bv,bu,controls))
    grid.append(row)
   g=np.array(grid)
   for j in range(SUBDIVISIONS):
    for i in range(SUBDIVISIONS):
     for ids in [[(j,i),(j+1,i),(j,i+1)],[(j,i+1),(j+1,i),(j+1,i+1)]]:
      ps=np.array([g[a,b] for a,b in reversed(ids)]);triangle(mat,ps[:,:3],ps[:,3:]*np.array(texture_meta.get(mat,{'size':[512,512]})['size']),collide=not nonsolid(mat))
      if not nonsolid(mat) and np.linalg.norm(np.cross(ps[1,:3]-ps[0,:3],ps[2,:3]-ps[0,:3]))>1e-9:patch_triangles.append(cv(ps[:,:3]).reshape(-1))
 if patch_triangles:
  a=np.array(patch_triangles);pts=a.reshape(-1,3);patches.append({'source':patch_count,'flags':[mat],'min':rounded(pts.min(0)),'max':rounded(pts.max(0)),'positions':rounded(a.reshape(-1))})
assert invalid==0, f'{invalid} invalid brushes'

# Continuous low-poly apron connects the authored disconnected courtyard islands.
# It stays just below native room floors, and slopes from the courtyards to the
# southern corridor. Render and authoritative support share these exact triangles.
foundation=[]
def apron_height(x,z):
 base=-.51
 weight=max(0,min(1,(46-abs(x))/3))
 blend=max(0,min(1,(z+6)/11.75)) if z<5.75 else 1 if z<=24 else max(0,min(1,(44-z)/20))
 if abs(x)<=14 and z<=5.75:return -.13 if -20<=z else base
 return base+1.99*weight*blend
xs=[-94,-46,-43,-16,-14,0,14,16,43,46,94]
zs=[-59,-24,-20,-6,5.75,8,24,26,40,44,57]
for x0,x1 in zip(xs,xs[1:]):
 for z0,z1 in zip(zs,zs[1:]):
  points=np.array([[x0,apron_height(x0,z0),z0],[x0,apron_height(x0,z1),z1],[x1,apron_height(x1,z1),z1],[x1,apron_height(x1,z0),z0]])
  for ids in [[0,1,2],[0,2,3]]:
   world=points[ids];normal=np.cross(world[1]-world[0],world[2]-world[0]);normal/=np.linalg.norm(normal)
   uv=world[:,[0,2]]/8*np.array(texture_meta['shared_pk02/sand01']['size'])
   render['shared_pk02/sand01'].append((world,uv,normal));foundation.append(world.reshape(-1))


# Visible perimeter panels bound the supported apron; no invisible sky/player clips.
foundation_rails=[]
for center,extent in [([-93.8,.99,-1],[.4,3,116]),([93.8,.99,-1],[.4,3,116]),([0,.99,-58.8],[188,3,.4]),([0,.99,56.8],[188,3,.4])]:
 center=np.array(center);extent=np.array(extent);lo=center-extent/2;hi=center+extent/2
 planes=[[1,0,0,hi[0]],[-1,0,0,-lo[0]],[0,1,0,hi[1]],[0,-1,0,-lo[1]],[0,0,1,hi[2]],[0,0,-1,-lo[2]]]
 foundation_rails.append({'type':'solid','supportOnlyNative':True,'blocksShots':True,'flags':['adapted/perimeter'],'min':rounded(lo),'max':rounded(hi),'planes':rounded(np.array(planes))})
 corners=np.array([[x,y,z]for x in[lo[0],hi[0]]for y in[lo[1],hi[1]]for z in[lo[2],hi[2]]])
 for axis in range(3):
  for sign,edge in [(-1,lo[axis]),(1,hi[axis])]:
   pts=corners[np.abs(corners[:,axis]-edge)<1e-8];normal=np.zeros(3);normal[axis]=sign;other=[k for k in range(3)if k!=axis];middle=pts.mean(0);angles=np.arctan2(pts[:,other[1]]-middle[other[1]],pts[:,other[0]]-middle[other[0]]);pts=pts[np.argsort(angles)]
   if np.dot(np.cross(pts[1]-pts[0],pts[2]-pts[0]),normal)<0:pts=pts[::-1]
   uv=pts[:,other]/8*np.array(texture_meta['shared_pk02/wall_big02b']['size'])
   for ids in [[0,1,2],[0,2,3]]:render['shared_pk02/wall_big02b'].append((pts[ids],uv[ids],normal))

# Pin sources once; record image hashes so future rebuilds reject changed inputs.
provenance_path=source/'image-provenance.json';provenance=json.loads(provenance_path.read_text()) if provenance_path.exists() else {}
base='https://raw.githubusercontent.com/UnvanquishedAssets/'
revisions={'map-plat23_src.dpkdir':'master','tex-pk02_src.dpkdir':'master'}
revision_path=source/'revisions.json'
if revision_path.exists():revisions=json.loads(revision_path.read_text())
else:
 for repo in revisions:
  import subprocess
  result=subprocess.check_output(['git','ls-remote','https://github.com/UnvanquishedAssets/'+repo+'.git','refs/heads/master'],text=True)
  revisions[repo]=result.split()[0]
 revision_path.write_text(json.dumps(revisions,indent=2)+'\n')
materials={};requests={}
for mat in sorted(render):
 tm=texture_meta[mat];name=tm['file'];path='textures/shared_pk02_src/'+name.removeprefix('plat23-') if 'custom/' not in mat else 'textures/plat23_custom_src/'+name.removeprefix('plat23-');repo='tex-pk02_src.dpkdir' if 'custom/' not in mat else 'map-plat23_src.dpkdir';diffuse=re.search(r'diffuseMap\s+(\S+)',shader(mat))
 if diffuse and diffuse[1]+'.png' != path and 'plat23_pk02_src/' in diffuse[1]:
  path=diffuse[1]+'.png';repo='map-plat23_src.dpkdir';name='plat23-'+Path(path).name
 output_name=Path(name).stem+'.webp';requests[name]=(repo,path,output_name,False)
 spec={'map':output_name,'metalness':0.12,'roughness':0.78,'doubleSided':'cull none' in shader(mat)}
 if '/light' in mat:
  color=[.28,.55,1] if 'blue' in mat else [1,.22,.12] if 'red' in mat else [1,.64,.22];spec.update(emissive=color,emissiveMap=output_name,emissiveIntensity=.65)
 if 'surfaceparm trans' in shader(mat):spec['transparent']=True
 if 'forcefield' in mat:spec.update(color=[.35,.65,1,.3],emissive=[.1,.4,1],emissiveIntensity=.5)
 normal=re.search(r'normalMap\s+(\S+)',shader(mat));normalpath=normal[1]+'.png' if normal else path.replace('_d.png','_n.png') if path.endswith('_d.png') else None
 if normalpath:
  normalname='plat23-'+Path(normalpath).name;normalout=Path(normalname).stem+'.webp';requests[normalname]=('tex-pk02_src.dpkdir',normalpath,normalout,True);spec['normalMap']=normalout;spec['normalScale']=.6
 materials[mat]=spec

def image_convert(item):
 name,(repo,path,dest,optional)=item;cache=args.texture_cache/name;url=base+repo+'/'+revisions[repo]+'/'+path
 if cache.exists():data=cache.read_bytes()
 else:
  try:data=urllib.request.urlopen(url,timeout=45).read();cache.parent.mkdir(parents=True,exist_ok=True);cache.write_bytes(data)
  except Exception:
   if optional:return name,None
   raise
 digest=hashlib.sha256(data).hexdigest()
 if name in provenance:assert provenance[name]['sha256']==digest, 'Source image changed: '+name
 image=Image.open(__import__('io').BytesIO(data));image.save(out/'textures'/dest,'WEBP',quality=90 if optional else 88,method=6)
 return name,{'url':url,'sha256':digest,'dimensions':list(image.size),'output':dest}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for name,result in pool.map(image_convert,sorted(requests.items())):
  if result:provenance[name]=result
missing={v[2] for k,v in requests.items() if k not in provenance}
for spec in materials.values():
 if spec.get('normalMap') in missing:spec.pop('normalMap');spec.pop('normalScale',None)
provenance={k:v for k,v in provenance.items() if k in requests}
used_textures={spec[k] for spec in materials.values() for k in ['map','normalMap','emissiveMap'] if k in spec}
for path in (out/'textures').glob('*.webp'):
 if path.name not in used_textures:path.unlink()
provenance_path.write_text(json.dumps(dict(sorted(provenance.items())),indent=2)+'\n')

# Split long edges for useful spatial culling, preserving exact plane and UV mapping.
def split(a,uv,n):
 lengths=np.array([np.linalg.norm(a[1]-a[0]),np.linalg.norm(a[2]-a[1]),np.linalg.norm(a[0]-a[2])]);edge=int(np.argmax(lengths))
 if lengths[edge]<=12:return [(a,uv,n)]
 i=edge;j=(edge+1)%3;k=(edge+2)%3;m=(a[i]+a[j])/2;um=(uv[i]+uv[j])/2
 return split(np.array([a[i],m,a[k]]),np.array([uv[i],um,uv[k]]),n)+split(np.array([m,a[j],a[k]]),np.array([um,uv[j],uv[k]]),n)
blob=bytearray();primitives=[];triangle_count=0

def pack(a,dtype):
 while len(blob)%4:blob.append(0)
 a=np.asarray(a,dtype=dtype);d={'offset':len(blob),'length':a.size};blob.extend(a.tobytes());return d
for mat,triangles in sorted(render.items()):
 spatial=collections.defaultdict(list);w,h=texture_meta[mat]['size']
 for a,uv,n in triangles:
  for tri in split(a,uv,n):spatial[tuple(np.floor(tri[0].mean(0)/CHUNK).astype(int))].append(tri)
 for key,triangles in sorted(spatial.items()):
  # Index only vertices with identical authored position/normal/UV.
  lookup={};positions=[];normals=[];uvs=[];indices=[]
  for a,uv,n in triangles:
   for v,u in zip(a,uv):
    signature=tuple(np.round(np.concatenate((v,n,u)),7))
    if signature not in lookup:lookup[signature]=len(positions);positions.append(v);normals.append(n);uvs.append(u/[w,h])
    indices.append(lookup[signature])
  a=np.array(positions);lo=a.min(0);span=a.max(0)-lo;quant=np.rint((a-lo)/np.where(span>0,span,1)*65535);assert len(a)<65536
  primitive={'material':mat,'min':rounded(lo),'span':rounded(span),'position':pack(quant,'<u2'),'normal':pack(np.rint(np.array(normals)*32767),'<i2'),'uv':pack(uvs,'<f4'),'index':pack(indices,'<u2'),'indexType':16};primitives.append(primitive);triangle_count+=len(indices)//3
bounds=np.concatenate([a for ts in render.values() for a,u,n in ts]);manifest={'name':'Platform 23','spatialChunks':True,'chunkSize':CHUNK,'materials':materials,'models':[{'name':'Platform 23 authored brush and patch geometry','meshes':[primitives]}],'bounds':{'min':rounded(bounds.min(0)),'max':rounded(bounds.max(0))},'sourceTransform':{'scale':SCALE,'offset':OFFSET.tolist(),'axes':['x','z','-y']},'license':'CC BY-SA 3.0; textures CC BY 3.0'}
(out/'environment.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n');(out/'geometry.bin.gz').write_bytes(gzip.compress(blob,compresslevel=9,mtime=0))
collision_bounds={'min':rounded(np.min(np.array([b['min'] for b in brushes]+[b['min'] for b in patches]),axis=0)),'max':rounded(np.max(np.array([b['max'] for b in brushes]+[b['max'] for b in patches]),axis=0))}
collision={'version':1,'scale':SCALE,'offset':OFFSET.tolist(),'bounds':collision_bounds,'brushes':brushes,'patches':patches,'foundationRails':foundation_rails,'foundation':{'positions':rounded(np.array(foundation).reshape(-1)),'min':[-94,-.51,-59],'max':[94,1.48,57]},'walkable':{'positions':rounded(np.array(walkable).reshape(-1))}}
(out/'collision-data.js').write_text('// Generated from original Platform 23 map. CC BY-SA 3.0; see ATTRIBUTION.md.\n// Convex interior: dot(plane.xyz, point) <= plane.w; min/max only broad phase.\nexport const PLATFORM_COLLISION='+json.dumps(collision,separators=(',',':'))+';\n')
metrics={'sourceBrushes':source_brushes,'invalidBrushes':invalid,'solidBrushes':len(brushes),'sourcePatches':patch_count,'collisionPatches':len(patches),'walkableTriangles':len(walkable),'renderTriangles':triangle_count,'sourceRenderTriangles':sum(map(len,render.values()))-recovered_ground_triangles,'recoveredGroundTriangles':recovered_ground_triangles,'materials':len(materials),'spatialPrimitives':len(primitives),'geometryBytes':len(blob),'geometryGzipBytes':(out/'geometry.bin.gz').stat().st_size,'textureFiles':len(list((out/'textures').glob('*.webp'))),'textureBytes':sum(x.stat().st_size for x in (out/'textures').glob('*.webp')),'normalMapMaterials':sum('normalMap' in x for x in materials.values()),'bounds':manifest['bounds'],'sourceSha256':hashlib.sha256(text.encode()).hexdigest()}
(out/'asset-validation.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps(metrics,indent=2))
