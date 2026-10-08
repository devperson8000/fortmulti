import struct,json,math,hashlib,sys
from pathlib import Path
# Run from the repository root with the verified uncompressed Godot resource and baked forest JSON.
if len(sys.argv)!=3: raise SystemExit("Usage: python scripts/map-assets/bake-height.py terrain-uncompressed.res forest-geometry.json")
v=struct.unpack_from('<1048576f',open(sys.argv[1],'rb').read(),620)
clamp=lambda t:max(0,min(1,t))
smooth=lambda t:clamp(t)**2*(3-2*clamp(t))
zones=[(0,0,65,0),(-202,76,43,6),(184,82,44,10),(126,-188,44,12),(-92,-178,44,8),(8,202,42,9)]
def height(x,z):
 sx=(x+320)/640*1023;sz=(z+320)/640*1023;ix=min(1022,int(sx));iz=min(1022,int(sz));tx=sx-ix;tz=sz-iz
 raw=(v[iz*1024+ix]*(1-tx)+v[iz*1024+ix+1]*tx)*(1-tz)+(v[(iz+1)*1024+ix]*(1-tx)+v[(iz+1)*1024+ix+1]*tx)*tz
 y=5+max(0,raw)*.06
 for cx,cz,r,level in zones:
  t=smooth((r+48-math.hypot(x-cx,z-cz))/48);y=y*(1-t)+level*t
 shore=smooth((306-math.hypot(x*.96,z))/30)
 return -5+(y+5)*shore
values=[round(height(x,z)*100) for z in range(-320,321,4) for x in range(-320,321,4)]
open('public/maps/ironwood/height-data.js','w').write('// Adapted Terrain3D demo terrain. See Terrain3D-LICENSE.txt and SOURCE.md. Units: centimeters.\nexport const HEIGHT_SAMPLES=new Int16Array('+json.dumps(values,separators=(',',':'))+');\n')
forest=json.load(open(sys.argv[2]));text='// Individual Kenney CC0 tree meshes. See Kenney-ASSET-LICENSE.md and SOURCE.md.\nexport const FOREST_TREES=['
for tree in forest:text+='{offset:'+json.dumps(tree['offset'])+',vertices:new Float32Array('+json.dumps(tree['vertices'],separators=(',',':'))+')},'
open('public/maps/ironwood/forest-data.js','w').write(text+'];\n')
print('terrain samples',len(values),'range',min(values)/100,max(values)/100)
