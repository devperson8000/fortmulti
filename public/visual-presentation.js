import {gridBounds,rampHeight} from './build-grid.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const rgb=h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);
const grass=rgb('78b84f'),meadow=rgb('91ba63'),sand=rgb('dfcc9b');
export function terrainColor(x,z){
 const r=Math.hypot(x*.96,z),beach=smooth((r-266)/27),edge=smooth((r-222)/40),variation=1+Math.sin(x*.023+z*.015)*.035+Math.cos(z*.043-x*.012)*.025;
 return grass.map((v,i)=>(v+(meadow[i]-v)*edge)*(1-beach)*variation+sand[i]*beach);
}
export function buildPresentation(age,hp=100,maxHP=100){
 const t=smooth(Math.max(0,age)/.24);
 return {scale:.93+.07*t,reveal:1-t,damage:clamp(1-hp/Math.max(1,maxHP))};
}
export function createMotionPresentation(){return {initialized:false,position:[0,0,0],yaw:0,grounded:true,vertical:0,speed:0,strafe:0,lean:0,turn:0,landing:0,phase:0,cameraY:0,stepIndex:0,stepped:false};}
export function stepMotionPresentation(s,p,dt=.016){
 const step=clamp(Number(dt)||0,0,.05),position=p.p||[0,0,0],yaw=Number.isFinite(p.yaw)?p.yaw:0,grounded=typeof p.grounded==='boolean'?p.grounded:!['jump','fall'].includes(p.locomotionState||p.animationState);
 if(!s.initialized){s.position=position.slice();s.yaw=yaw;s.grounded=grounded;s.initialized=true;}
 const dx=position[0]-s.position[0],dz=position[2]-s.position[2],distance=Math.hypot(dx,dz),teleport=distance>3,angle=Math.atan2(Math.sin(yaw-s.yaw),Math.cos(yaw-s.yaw));
 const inferred=step>0&&!teleport?distance/step:0,speed=Number.isFinite(p.moveSpeed)?Math.max(0,p.moveSpeed):inferred;
 s.speed=damp(s.speed,clamp(speed,0,12),12,step);
 const lateral=!teleport&&step>0?(dx*Math.cos(yaw)-dz*Math.sin(yaw))/step:0;
 s.strafe=damp(s.strafe,clamp(lateral/10,-1,1)*.075,10,step);
 s.turn=damp(s.turn,clamp(step>0?angle/step:0,-3,3)*.025,10,step);
 s.lean=damp(s.lean,grounded?clamp(s.speed/10)*.065:0,9,step);
 if(!s.grounded&&grounded&&!teleport)s.landing=Math.max(s.landing,clamp(Math.abs(s.vertical)/18,.15,1));
 s.landing=damp(s.landing,0,12,step);
 s.phase+=grounded?s.speed*step*2.5:0;
 const index=Math.floor(s.phase/Math.PI);s.stepped=grounded&&s.speed>.7&&index!==s.stepIndex;s.stepIndex=index;
 const bob=grounded?Math.sin(s.phase*2)*.009*clamp(s.speed/6):0;
 s.cameraY=damp(s.cameraY,bob-s.landing*.085,24,step);
 s.position[0]=position[0];s.position[1]=position[1];s.position[2]=position[2];s.yaw=yaw;s.grounded=grounded;s.vertical=Number(p.vy)||0;
 return s;
}
// Warm key light and blue hemisphere shading are baked into the existing
// six-float vertex stream; no extra per-frame mesh or shadow-map allocations.
export function litColor(col,normal,sun){
 const hemi=clamp(normal[1]*.5+.5),direct=Math.max(0,normal.reduce((v,n,i)=>v+n*sun[i],0));
 return col.map((v,i)=>clamp(v*([.43,.49,.6][i]+hemi*.22+direct*[.4,.34,.25][i]),0,1));
}
export const WORLD_VERTEX=`attribute vec3 aPosition;attribute vec3 aColor;uniform mat4 uMatrix;uniform vec3 uEye;varying vec3 vColor;varying vec3 vWorld;varying vec3 vDirection;varying float vFog;void main(){gl_Position=uMatrix*vec4(aPosition,1.);vColor=aColor;vWorld=aPosition;vDirection=aPosition-uEye;vFog=1.-exp(-max(0.,length(vDirection)-55.)*.0036);}`;
export const WORLD_FRAGMENT=`precision highp float;varying vec3 vColor;varying vec3 vWorld;varying vec3 vDirection;varying float vFog;void main(){vec3 direction=normalize(vDirection);float sun=pow(max(0.,dot(direction,normalize(vec3(-.6,1.,.4)))),8.);vec3 haze=mix(vec3(.69,.84,.89),vec3(.95,.84,.67),sun*.36);float grain=sin(vWorld.x*3.1+vWorld.z*2.7)*sin(vWorld.y*5.3+vWorld.z*4.1)*.006;float water=1.-smoothstep(-5.1,-4.8,vWorld.y);float ripple=sin(vWorld.x*.28+vWorld.z*.18)*sin(vWorld.z*.36-vWorld.x*.11)*.018;vec3 col=mix(vColor+grain+vec3(ripple)*water,haze,clamp(vFog,0.,.75));gl_FragColor=vec4(col,1.);}`;
export const SKY_VERTEX=`attribute vec2 aClip;uniform vec3 uForward;uniform vec3 uRight;uniform vec3 uUp;uniform vec2 uLens;varying vec3 vRay;void main(){gl_Position=vec4(aClip,.999,1.);vRay=uForward+aClip.x*uRight*uLens.x+aClip.y*uUp*uLens.y;}`;
export const SKY_FRAGMENT=`precision highp float;varying vec3 vRay;uniform float uTime;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}void main(){vec3 ray=normalize(vRay);float elevation=smoothstep(-.12,1.,ray.y);vec3 sky=mix(vec3(.72,.85,.9),vec3(.22,.55,.82),pow(elevation,.45));float sun=dot(ray,normalize(vec3(-.6,1.,.4)));sky+=vec3(.25,.16,.05)*pow(max(sun,0.),16.);sky=mix(sky,vec3(1.,.96,.79),smoothstep(.9991,.9997,sun));vec2 uv=ray.xz/max(.16,ray.y)*1.2+vec2(uTime*.002,0.);float cloud=noise(uv)*.65+noise(uv*2.1)*.35;float mask=smoothstep(.58,.78,cloud)*smoothstep(.04,.22,ray.y);sky=mix(sky,vec3(.94,.96,.94),mask*.66);gl_FragColor=vec4(sky,1.);}`;

export function surfaceAtPoint(point,structures,obstacles,height){
 for(const b of structures){if(b.type===3){const y=rampHeight(b,point[0],point[2]);if(y!==null&&Math.abs(point[1]-y)<.22)return b.material||'wood';}else{const bounds=gridBounds(b);if(point.every((v,i)=>v>=bounds.min[i]-.2&&v<=bounds.max[i]+.2))return b.material||'wood';}}
 for(const box of obstacles)if(point.every((v,i)=>v>=box.min[i]-.2&&v<=box.max[i]+.2))return box.surface||'stone';
 if(point[1]<height(point[0],point[2])+.25)return 'grass';return null;
}
