// Rebuild from the pinned Godot TPS demo scenes. Mesh files are not used as collision.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
const source=resolve(process.argv[2]||'/workspace/fortmulti-artifacts/reactor-map/source');
const output=resolve(process.argv[3]||'public/maps/reactor/collision-data.js');
const I=[1,0,0,0,1,0,0,0,1,0,0,0];
const point=(m,p)=>[0,1,2].map(k=>m[9+k]+m[k]*p[0]+m[3+k]*p[1]+m[6+k]*p[2]);
const compose=(a,b)=>[...b.slice(0,9).map((_,i)=>a[i%3]*b[Math.floor(i/3)*3]+a[3+i%3]*b[Math.floor(i/3)*3+1]+a[6+i%3]*b[Math.floor(i/3)*3+2]),...point(a,b.slice(9))];
const shapes=[];
async function scene(file,outer=I,prefix=''){
 const text=await readFile(resolve(source,file),'utf8'),sections=[...text.matchAll(/^\[(node|sub_resource|ext_resource) ([^\n]+)\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)];
 const resources=new Map(),external=new Map(),nodes=new Map();
 for(const [,kind,attrs,body] of sections){const attr=k=>attrs.match(new RegExp(`(?:^| )${k}="([^"]+)"`))?.[1];if(kind==='ext_resource'){external.set(attr('id'),attr('path'));continue;}if(kind==='sub_resource'){const type=attr('type');if(!type.endsWith('Shape3D'))continue; const vector=body.match(/size = Vector3\(([^)]+)\)/),radius=Number(body.match(/radius = ([\d.]+)/)?.[1]||.5),height=Number(body.match(/height = ([\d.]+)/)?.[1]||2);resources.set(attr('id'),{type,size:vector?vector[1].split(',').map(Number):[radius*2,height,radius*2],radius});continue;}
 const parent=attr('parent'),name=attr('name'),path=parent&&parent!=='.'?`${parent}/${name}`:name;
 const local=body.match(/transform = Transform3D\(([^)]+)\)/)?.[1].split(',').map(Number)||I;
 const parentTransform=!parent?outer:parent==='.'?(nodes.get('$root')||outer):(nodes.get(parent)||outer),transform=compose(parentTransform,local);nodes.set(path,transform);if(!parent)nodes.set('$root',transform);
 const instance=attrs.match(/instance=ExtResource\("([^"]+)"\)/)?.[1],ext=external.get(instance);if(ext?.endsWith('.tscn'))await scene(basename(ext),transform,`${prefix}${path}/`);
 const shapeId=body.match(/shape = SubResource\("([^"]+)"\)/)?.[1];if(shapeId&&body.indexOf('disabled = true')<0){const shape=resources.get(shapeId);if(shape)shapes.push({...shape,name:`${prefix}${file}/${path}`,transform:transform.map((v,i)=>i===10?v+8:v)});}
 }
}
for(const file of ['structure.tscn','core.tscn','props.tscn'])await scene(file);
await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,`// Generated from godotengine/tps-demo a82f15448e9b015440d3bbdf5e10801b260c4e9f, world Y + 8.\nexport const REACTOR_COLLISION = ${JSON.stringify(shapes)};\n`);
console.log(`Imported ${shapes.length} collision shapes to ${output}`);
