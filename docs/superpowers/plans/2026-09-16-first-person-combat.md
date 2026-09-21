# First-Person Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Sunny Skirmish's lobby and third-person aerial sequence while delivering polished, performant first-person landed combat with original high-detail weapons, procedural animation, and lightweight sniper ballistics.

**Architecture:** Retain the existing custom WebGL renderer and host-authoritative `Match` simulation. Add small pure modules for camera presentation, view-model motion, projectiles, quality selection, and effect pooling; integrate those modules into `engine.js` and `simulation.js` only after deterministic tests pass. Supabase continues to carry semantic input/snapshot/event state rather than rendered transforms.

**Tech Stack:** Browser ES modules, custom WebGL, Node.js 20 test runner, Supabase Realtime Broadcast, static Vercel build.

**Spec:** `docs/superpowers/specs/2026-09-16-first-person-combat-design.md`

## Global Constraints

- Lobby camera, party flow, social drawer, outfit flow, and ready-up behavior remain unchanged.
- Transport, freefall, canopy deployment, and gliding remain third-person in this release.
- Landed local combat is first-person; remote players remain full-body third-person characters.
- AR, SMG, and shotgun remain host-authoritative hitscan; the sniper alone uses lightweight projectile travel and mild gravity.
- Do not migrate to Three.js/React Three Fiber or run the uploaded LONGSHOT renderer beside the current renderer.
- Do not add the planned military transport plane or alter the Supabase database schema.
- No per-frame heap allocation in the common view-model transform path after initialization.
- Keep simulation authoritative and render interpolation cosmetic.
- Publish only to `test`; do not modify `main` without a later explicit instruction.
- Preserve Sunny Skirmish branding and use original procedural geometry rather than copying protected models or interface assets.

## File Map

- Create `public/first-person-system.js`: pure camera-mode and landing-transition logic.
- Create `public/view-model.js`: pure first-person pose, reload phase, recoil, sway, and quality-budget logic.
- Create `public/ballistics.js`: pure bounded projectile integration and collision helpers.
- Create `public/effect-pool.js`: reusable visual-effect slots with hard capacity limits.
- Modify `public/weapon-system.js`: add immutable presentation/ballistic tuning to existing profiles.
- Modify `public/simulation.js`: host-owned sniper projectile lifecycle and semantic presentation state.
- Modify `public/engine.js`: first-person world camera, local-avatar visibility, foreground pass, models, effects, and pointer-lock UX.
- Modify `public/index.html` and `public/game.css`: match HUD/settings only; do not change lobby structure/selectors.
- Modify `public/multiplayer-runtime.js`: deduplicate projectile terminal events without increasing input cadence.
- Add focused tests for every new pure module and extend existing simulation/render integration tests.
- Modify `package.json` syntax command so every new public module is checked.

---

### Task 1: Camera Presentation State Machine

**Files:**
- Create: `public/first-person-system.js`
- Create: `tests/first-person-system.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `createCameraPresentation(): CameraPresentation`
- Produces: `stepCameraPresentation(state, sample, dt): CameraPresentation`
- Produces: `cameraMode(sample): 'lobby'|'aerial'|'transition'|'firstPerson'|'spectator'`
- Produces: `canFireDuringPresentation(state): boolean`
- `sample` shape: `{lobby:boolean, air:string, alive:boolean, spectating:boolean, roundToken:string|number}`

- [ ] **Step 1: Write the failing camera-state tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCameraPresentation,stepCameraPresentation,cameraMode,canFireDuringPresentation} from '../public/first-person-system.js';

const sample=(overrides={})=>({lobby:false,air:'landed',alive:true,spectating:false,roundToken:1,...overrides});

test('lobby and aerial modes never enter first person',()=>{
 assert.equal(cameraMode(sample({lobby:true})),'lobby');
 assert.equal(cameraMode(sample({air:'glider'})),'aerial');
 assert.equal(cameraMode(sample({air:'freefall'})),'aerial');
});

test('landing blends for 450ms and gates early firing',()=>{
 let state=createCameraPresentation();
 state=stepCameraPresentation(state,sample({air:'glider'}),.016);
 state=stepCameraPresentation(state,sample(),.10);
 assert.equal(state.mode,'transition');
 assert.ok(state.blend>0&&state.blend<.7);
 assert.equal(canFireDuringPresentation(state),false);
 state=stepCameraPresentation(state,sample(),.24);
 assert.ok(state.blend>=.7);
 assert.equal(canFireDuringPresentation(state),true);
 state=stepCameraPresentation(state,sample(),.20);
 assert.equal(state.mode,'firstPerson');
 assert.equal(state.blend,1);
});

test('death and a new round reset the presentation deterministically',()=>{
 let state={...createCameraPresentation(),mode:'firstPerson',blend:1,roundToken:1,lastAir:'landed'};
 state=stepCameraPresentation(state,sample({alive:false,spectating:true}),.016);
 assert.equal(state.mode,'spectator');
 state=stepCameraPresentation(state,sample({air:'bus',roundToken:2}),.016);
 assert.equal(state.mode,'aerial');
 assert.equal(state.blend,0);
});
```

- [ ] **Step 2: Run the new tests and verify the missing-module failure**

Run: `node --test tests/first-person-system.test.mjs`  
Expected: FAIL because `public/first-person-system.js` does not exist.

- [ ] **Step 3: Implement the pure presentation state machine**

```js
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const ease=value=>{const t=clamp01(value);return t*t*(3-2*t);};
export const LANDING_TRANSITION_SECONDS=.45;

export function createCameraPresentation(){
 return {mode:'aerial',blend:0,elapsed:0,lastAir:'bus',roundToken:null};
}

export function cameraMode({lobby=false,air='landed',alive=true,spectating=false}={}){
 if(lobby)return 'lobby';
 if(!alive||spectating)return 'spectator';
 return air==='landed'?'firstPerson':'aerial';
}

export function stepCameraPresentation(prior,sample={},dt=.016){
 const state=prior||createCameraPresentation(),step=Math.max(0,Math.min(.1,Number(dt)||0));
 const nextRound=state.roundToken!==null&&sample.roundToken!==state.roundToken;
 if(nextRound)return {...createCameraPresentation(),mode:cameraMode(sample),roundToken:sample.roundToken,lastAir:sample.air||'bus'};
 const direct=cameraMode(sample),landed=sample.air==='landed',justLanded=landed&&state.lastAir!=='landed'&&direct==='firstPerson';
 if(justLanded||state.mode==='transition'){
  const elapsed=justLanded?step:state.elapsed+step,raw=clamp01(elapsed/LANDING_TRANSITION_SECONDS);
  return {mode:raw>=1?'firstPerson':'transition',blend:ease(raw),elapsed,lastAir:'landed',roundToken:sample.roundToken};
 }
 return {mode:direct,blend:direct==='firstPerson'?1:0,elapsed:0,lastAir:sample.air||'landed',roundToken:sample.roundToken};
}

export const canFireDuringPresentation=state=>state?.mode==='firstPerson'||(state?.mode==='transition'&&(state.blend||0)>=.7);
```

- [ ] **Step 4: Add the new module to the syntax check and run tests**

Modify the `syntax` script to include `node --check public/first-person-system.js`.  
Run: `npm run syntax && node --test tests/first-person-system.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit the camera state machine**

```bash
git add public/first-person-system.js tests/first-person-system.test.mjs package.json
git commit -m "feat: add first-person camera state machine"
```

---

### Task 2: Weapon Presentation Profiles and Procedural View-Model Motion

**Files:**
- Create: `public/view-model.js`
- Create: `tests/view-model.test.mjs`
- Modify: `public/weapon-system.js`
- Modify: `tests/weapons.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `weaponForSlot(slot)` and immutable `profile.presentation` data.
- Produces: `createViewModelState(): ViewModelState`
- Produces: `stepViewModel(state, input, dt): ViewModelState`
- Produces: `reloadStage(profile, remaining): 'idle'|'release'|'eject'|'insert'|'action'|'settle'`
- `input` shape: `{weapon, moving, sprinting, aiming, reloading, equipRemaining, mouseX, mouseY, shotImpulse, time}`

- [ ] **Step 1: Add failing animation and profile tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPON_PROFILES} from '../public/weapon-system.js';
import {createViewModelState,stepViewModel,reloadStage} from '../public/view-model.js';

test('each weapon has complete immutable presentation tuning',()=>{
 for(const profile of Object.values(WEAPON_PROFILES)){
  assert.ok(profile.presentation.anchor.length===3);
  assert.ok(profile.presentation.adsAnchor.length===3);
  assert.ok(profile.presentation.recoil.length===3);
  assert.ok(Object.isFrozen(profile.presentation));
 }
});

test('reload phases progress through a deterministic sequence',()=>{
 const profile=WEAPON_PROFILES.ar,d=profile.reloadDuration;
 assert.equal(reloadStage(profile,d),'release');
 assert.equal(reloadStage(profile,d*.72),'eject');
 assert.equal(reloadStage(profile,d*.44),'insert');
 assert.equal(reloadStage(profile,d*.18),'action');
 assert.equal(reloadStage(profile,d*.04),'settle');
 assert.equal(reloadStage(profile,0),'idle');
});

test('view-model motion is bounded and recovers after recoil',()=>{
 let state=createViewModelState();
 const base={weapon:WEAPON_PROFILES.ar,moving:0,sprinting:false,aiming:false,reloading:0,equipRemaining:0,mouseX:0,mouseY:0,time:0};
 state=stepViewModel(state,{...base,shotImpulse:1},.016);
 assert.ok(state.recoil>0);
 for(let i=0;i<120;i++)state=stepViewModel(state,{...base,time:i/60},1/60);
 assert.ok(state.recoil<.01);
 for(const value of [...state.position,...state.rotation])assert.ok(Number.isFinite(value)&&Math.abs(value)<2);
});
```

- [ ] **Step 2: Run the tests and confirm missing exports fail**

Run: `node --test tests/view-model.test.mjs`  
Expected: FAIL because `view-model.js` and presentation data do not exist.

- [ ] **Step 3: Add immutable presentation data to all four weapon profiles**

Use this exact shape, with weapon-specific values:

```js
presentation:Object.freeze({
 anchor:Object.freeze([.34,-.34,-.78]),
 adsAnchor:Object.freeze([0,-.255,-.58]),
 scale:1,
 recoil:Object.freeze([-.085,.035,.018]),
 sway:.018,
 bob:.014,
 sprint:Object.freeze([.32,-.22,.5]),
 model:'ar'
})
```

Set `model` to `ar`, `shotgun`, `smg`, and `sniper`; use a stronger Z recoil for shotgun/sniper, a tighter ADS anchor for sniper, and shorter models/scales for SMG. Freeze every nested array so tests cannot mutate shared tuning.

- [ ] **Step 4: Implement allocation-free pose stepping**

`createViewModelState()` preallocates `position` and `rotation` arrays. `stepViewModel()` mutates and returns the same state object:

```js
const damp=(from,to,speed,dt)=>from+(to-from)*(1-Math.exp(-speed*Math.min(.1,Math.max(0,dt))));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createViewModelState(){
 return {position:[0,0,0],rotation:[0,0,0],recoil:0,swayX:0,swayY:0,bobPhase:0,stage:'idle'};
}

export function reloadStage(profile,remaining){
 if(!(remaining>0))return 'idle';
 const progress=1-remaining/profile.reloadDuration;
 if(progress<.16)return 'release';
 if(progress<.38)return 'eject';
 if(progress<.7)return 'insert';
 if(progress<.9)return 'action';
 return 'settle';
}

export function stepViewModel(state,input,dt){
 const profile=input.weapon,p=profile.presentation,step=Math.min(.1,Math.max(0,Number(dt)||0));
 state.recoil=clamp(state.recoil+Math.max(0,input.shotImpulse||0),0,1);
 state.recoil=damp(state.recoil,0,11,step);
 state.swayX=damp(state.swayX,clamp(input.mouseX||0,-24,24)*p.sway*.01,10,step);
 state.swayY=damp(state.swayY,clamp(input.mouseY||0,-24,24)*p.sway*.01,10,step);
 state.bobPhase+=(input.moving||0)*step*9;
 state.stage=reloadStage(profile,input.reloading||0);
 const anchor=input.aiming?p.adsAnchor:p.anchor,bob=Math.sin(state.bobPhase)*p.bob*(input.moving||0),sprint=input.sprinting?1:0;
 state.position[0]=damp(state.position[0],anchor[0]+state.swayX+p.sprint[0]*sprint,16,step);
 state.position[1]=damp(state.position[1],anchor[1]+bob+p.sprint[1]*sprint,16,step);
 state.position[2]=damp(state.position[2],anchor[2]+p.recoil[0]*state.recoil+p.sprint[2]*sprint,18,step);
 state.rotation[0]=damp(state.rotation[0],p.recoil[1]*state.recoil+.45*sprint,18,step);
 state.rotation[1]=damp(state.rotation[1],state.swayX*.8,14,step);
 state.rotation[2]=damp(state.rotation[2],p.recoil[2]*state.recoil-state.swayY*.6+.35*sprint,14,step);
 return state;
}
```

- [ ] **Step 5: Run focused and existing weapon tests**

Run: `npm run syntax && node --test tests/view-model.test.mjs tests/weapons.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit the presentation foundation**

```bash
git add public/view-model.js public/weapon-system.js tests/view-model.test.mjs tests/weapons.test.mjs package.json
git commit -m "feat: add procedural weapon presentation state"
```

---

### Task 3: Lightweight Sniper Ballistics

**Files:**
- Create: `public/ballistics.js`
- Create: `tests/ballistics.test.mjs`
- Modify: `public/weapon-system.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `createProjectile({id,owner,origin,direction,speed,gravity,range,damage,spawnTick})`
- Produces: `advanceProjectile(projectile, dt): Projectile`
- Produces: `segmentSphereTime(from,to,center,radius): number|null`
- Produces: `segmentAabbTime(from,to,min,max): number|null`
- Mutates projectile in place; does not allocate new velocity/position arrays after creation.

- [ ] **Step 1: Write failing ballistic tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectile,advanceProjectile,segmentSphereTime,segmentAabbTime} from '../public/ballistics.js';

test('sniper projectile travels forward and gains mild downward velocity',()=>{
 const p=createProjectile({id:'p1',owner:'a',origin:[0,2,0],direction:[0,0,-1],speed:180,gravity:18,range:360,damage:116,spawnTick:1});
 const step=advanceProjectile(p,.1);
 assert.ok(step.position[2]<-17.9);
 assert.ok(p.velocity[1]<0);
 assert.equal(step.expired,false);
});

test('swept collision catches targets and walls between ticks',()=>{
 assert.ok(segmentSphereTime([0,1,0],[0,1,-20],[0,1,-10],.7)!==null);
 assert.ok(segmentAabbTime([0,1,0],[0,1,-20],[-1,0,-11],[1,3,-9])!==null);
 assert.equal(segmentSphereTime([0,1,0],[0,1,-20],[5,1,-10],.7),null);
});

test('projectiles expire at bounded range',()=>{
 const p=createProjectile({id:'p2',owner:'a',origin:[0,0,0],direction:[0,0,-1],speed:200,gravity:0,range:30,damage:1,spawnTick:1});
 assert.equal(advanceProjectile(p,.2).expired,true);
});
```

- [ ] **Step 2: Verify the tests fail before implementation**

Run: `node --test tests/ballistics.test.mjs`  
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement bounded in-place projectile integration and swept intersections**

Each projectile owns reusable `previous` and `position` arrays; do not use shared module-level vectors. Normalize the creation direction once. Apply velocity and then `velocity[1] -= gravity * dt`; cap `dt` at `.05`; mark expired when `distance >= range` or `age >= 3` seconds. Implement sphere intersection with the quadratic segment equation and AABB intersection with the slab method, returning the earliest normalized `t` in `[0,1]`.

Return the same projectile object instead of allocating a result object:

```js
export function advanceProjectile(projectile,dt){
 const step=Math.min(.05,Math.max(0,Number(dt)||0));
 projectile.previous[0]=projectile.position[0];projectile.previous[1]=projectile.position[1];projectile.previous[2]=projectile.position[2];
 projectile.position[0]+=projectile.velocity[0]*step;
 projectile.position[1]+=projectile.velocity[1]*step;
 projectile.position[2]+=projectile.velocity[2]*step;
 projectile.velocity[1]-=projectile.gravity*step;
 const moved=Math.hypot(projectile.position[0]-projectile.previous[0],projectile.position[1]-projectile.previous[1],projectile.position[2]-projectile.previous[2]);
 projectile.distance+=moved;projectile.age+=step;
 projectile.expired=projectile.distance>=projectile.range||projectile.age>=projectile.maxAge;
 return projectile;
}
```

- [ ] **Step 4: Add sniper-only ballistic metadata**

Add `projectile:null` to AR, shotgun, and SMG. Add this immutable value to sniper:

```js
projectile:Object.freeze({speed:180,gravity:18,maxAge:3})
```

- [ ] **Step 5: Run ballistic and weapon tests**

Run: `npm run syntax && node --test tests/ballistics.test.mjs tests/weapons.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit ballistics**

```bash
git add public/ballistics.js public/weapon-system.js tests/ballistics.test.mjs package.json
git commit -m "feat: add bounded sniper projectile ballistics"
```

---

### Task 4: Host-Authoritative Projectile Simulation

**Files:**
- Modify: `public/simulation.js`
- Modify: `tests/simulation.test.mjs`
- Modify: `tests/weapons.test.mjs`

**Interfaces:**
- Consumes: projectile helpers from Task 3.
- Adds: `Match.projectiles: Projectile[]`, `Match.projectileSequence: number`
- Adds private methods: `spawnProjectile(player,input,profile,muzzle,direction)` and `tickProjectiles(dt)`.
- Shot event for sniper includes `{projectileId}` and no immediate damage; terminal event is `{type:'projectile-impact',id,by,weapon,point,hit,damage}`.

- [ ] **Step 1: Add failing authoritative projectile tests**

```js
const playing=()=>{
 const match=new Match(world,['a','b']);
 match.phase='playing';
 for(const player of match.players){player.air='landed';player.p[1]=0;}
 match.players[0].p=[0,0,0];match.players[1].p=[0,0,-20];
 return match;
};

test('sniper damage occurs on projectile arrival rather than trigger time',()=>{
 const m=playing(),target=m.players[1];target.p=[0,0,-90];
 m.input('a',{slot:4,yaw:0,pitch:0,aimYaw:0,aimPitch:0,aim:true});
 for(let i=0;i<11;i++)m.tick(.05);
 m.input('a',{slot:4,yaw:0,pitch:0,aimYaw:0,aimPitch:0,aim:true,fire:true});m.tick(.016);
 const before=target.shield;
 assert.equal(target.shield,before);
 assert.equal(m.projectiles.length,1);
 for(let i=0;i<20&&target.shield===before;i++)m.tick(.025);
 assert.ok(target.shield<before);
 assert.ok(m.events.some(e=>e.type==='projectile-impact'&&e.hit==='b'));
});

test('walls stop sniper projectiles before player damage',()=>{
 const m=playing(),target=m.players[1];target.p=[0,0,-40];
 m.structures=[{x:0,z:-20,y:0,angle:0,type:2,hp:150}];
 m.input('a',{slot:4,yaw:0,aim:true});for(let i=0;i<11;i++)m.tick(.05);
 m.input('a',{slot:4,yaw:0,aim:true,fire:true});
 for(let i=0;i<30;i++)m.tick(.025);
 assert.equal(target.shield,100);
 assert.ok(m.structures[0].hp<150);
});

test('round reset clears in-flight projectiles',()=>{
 const m=playing();m.players[1].p=[100,0,-100];
 m.input('a',{slot:4,yaw:0,aim:true});for(let i=0;i<11;i++)m.tick(.05);
 m.input('a',{slot:4,yaw:0,aim:true,fire:true});m.tick(.016);
 assert.equal(m.projectiles.length,1);m.startRound(false);assert.equal(m.projectiles.length,0);
});
```

- [ ] **Step 2: Run focused tests and verify immediate-hit behavior fails**

Run: `node --test tests/simulation.test.mjs tests/weapons.test.mjs`  
Expected: FAIL in the new projectile tests because sniper still uses immediate hitscan.

- [ ] **Step 3: Initialize and reset projectile state**

Import `createProjectile`, `advanceProjectile`, `segmentSphereTime`, and `segmentAabbTime`. In the constructor set `this.projectiles=[]; this.projectileSequence=0;`. Clear `this.projectiles.length=0` in `startRound` and every match-completion reset path.

- [ ] **Step 4: Branch sniper fire into projectile creation**

In `fireWeapon`, retain camera-ray convergence and muzzle cover checking. For a profile with `projectile`, create one projectile using the converged muzzle direction, decrement ammo/cadence exactly once, emit the standard `shot` event with `projectileId`, and skip immediate damage. Hitscan profiles retain existing behavior unchanged.

Projectile IDs are deterministic for the host session:

```js
const projectileId=`${p.id}:${++this.projectileSequence}`;
this.projectiles.push(createProjectile({id:projectileId,owner:p.id,origin:muzzle,direction:muzzleDirection,speed:profile.projectile.speed,gravity:profile.projectile.gravity,range:profile.range,damage:profile.damage,spawnTick:this.elapsed}));
this.event({type:'shot',by:p.id,weapon:profile.id,a:muzzle,b:crosshairTrace.end,traces:[crosshairTrace.end],hits:[],hit:null,damage:0,projectileId});
```

- [ ] **Step 5: Tick projectiles with earliest-hit selection**

For every projectile step, find the lowest collision `t` across structures, obstacles, and non-owner living players. Apply only that earliest result. Use player center `[x,y+1.25,z]` and radius `.72`; reuse the existing structure hit/damage logic; emit one `projectile-impact`; remove by swap-pop to avoid array shifting. Expired projectiles emit `{type:'projectile-expire',id,by}` and are removed without damage.

- [ ] **Step 6: Run simulation and weapon tests**

Run: `node --test tests/simulation.test.mjs tests/weapons.test.mjs tests/ballistics.test.mjs`  
Expected: PASS, including existing wall/hitscan/cadence tests.

- [ ] **Step 7: Commit authoritative projectile simulation**

```bash
git add public/simulation.js tests/simulation.test.mjs tests/weapons.test.mjs
git commit -m "feat: simulate sniper projectiles on the host"
```

---

### Task 5: First-Person World Camera and Local-Avatar Visibility

**Files:**
- Modify: `public/engine.js`
- Modify: `tests/render-integration.test.mjs`

**Interfaces:**
- Consumes: Task 1 camera presentation state.
- Produces renderer invariants: local avatar visible in aerial/lobby, hidden in first-person/transition after blend `.5`, view-model hidden outside first-person/transition.
- Preserves: `drawLobby()` body and all `#lobby` selectors unchanged.

- [ ] **Step 1: Add failing source-integration and behavior tests**

```js
test('renderer uses the pure presentation state and protects the lobby',async()=>{
 const source=await readFile(new URL('../public/engine.js',import.meta.url),'utf8');
 assert.match(source,/stepCameraPresentation\(/);
 assert.match(source,/canFireDuringPresentation\(/);
 assert.match(source,/cameraPresentation\.mode==='firstPerson'/);
 assert.match(source,/drawFirstPersonViewModel\(/);
});

test('local grounded avatar is not drawn behind the first-person camera',async()=>{
 const source=await readFile(new URL('../public/engine.js',import.meta.url),'utf8');
 assert.match(source,/const showLocalAvatar=.*cameraPresentation\.mode/);
 assert.match(source,/if\(showLocalAvatar/);
});
```

Add this exact extraction guard before editing, store its first printed digest in the test, and keep the assertion after editing:

```js
const extractLobby=source=>{
 const start=source.indexOf('function drawLobby(){');
 const end=source.indexOf('\nwindow.Game=',start);
 assert.ok(start>=0&&end>start);
 return source.slice(start,end);
};
const digest=createHash('sha256').update(extractLobby(source)).digest('hex');
assert.equal(digest,'a3c62d045b38605e35de305615d2b2291599b975e99b30bdeae5fe3986d23238');
```

- [ ] **Step 2: Run render integration tests and verify failure**

Run: `node --test tests/render-integration.test.mjs`  
Expected: FAIL because the presentation module is not integrated.

- [ ] **Step 3: Integrate camera state without changing aerial paths**

Import Task 1 exports, initialize `cameraPresentation=createCameraPresentation()`, and step it once per frame using local lobby/air/alive/spectator/round state. Preserve the current bus/freefall/deploying/glider branches exactly. For landed combat use:

```js
const firstPersonEye=add(player.p,[0,1.72,0]);
const firstPersonTarget=add(firstPersonEye,forward);
const transition=cameraPresentation.mode==='transition'?cameraPresentation.blend:cameraPresentation.mode==='firstPerson'?1:0;
eye=[mix(thirdPersonEye[0],firstPersonEye[0],transition),mix(thirdPersonEye[1],firstPersonEye[1],transition),mix(thirdPersonEye[2],firstPersonEye[2],transition)];
cameraTarget=[mix(thirdPersonTarget[0],firstPersonTarget[0],transition),mix(thirdPersonTarget[1],firstPersonTarget[1],transition),mix(thirdPersonTarget[2],firstPersonTarget[2],transition)];
```

The first-person ray uses `yaw + recoilYaw` and `pitch + recoilPitch`. World camera collision remains active during transition but is skipped at full first-person because the eye anchor is already on the player.

- [ ] **Step 4: Gate local-avatar and input behavior**

Define:

```js
const showLocalAvatar=player.hp>0&&(player.air!=='landed'||cameraPresentation.mode==='aerial'||cameraPresentation.mode==='lobby'||(cameraPresentation.mode==='transition'&&cameraPresentation.blend<.5));
```

Wrap only the local world-character submission with `if(showLocalAvatar)`. Do not change remote character rendering. Add `canFireDuringPresentation(cameraPresentation)` to both local `shoot()` and `window.Game.input().fire` so hidden transition shots cannot reach the host.

- [ ] **Step 5: Run integration and full existing tests**

Run: `npm run syntax && npm test`  
Expected: PASS; the recorded lobby hash remains identical.

- [ ] **Step 6: Commit first-person camera integration**

```bash
git add public/engine.js tests/render-integration.test.mjs
git commit -m "feat: transition landed gameplay to first person"
```

---

### Task 6: Foreground Arms, Detailed Weapons, and Procedural Animations

**Files:**
- Modify: `public/engine.js`
- Modify: `tests/render-integration.test.mjs`
- Modify: `public/game.css`

**Interfaces:**
- Consumes: `stepViewModel()` and weapon `presentation` profiles from Task 2.
- Adds renderer functions: `drawFirstPersonViewModel(profile,state)`, `drawFirstPersonArms(state,skin,cloth)`, `drawFirstPersonWeapon(profile,state)`.
- Adds no network payloads.

- [ ] **Step 1: Add failing renderer contract tests**

```js
test('foreground view model has an isolated depth pass and no frame-path allocation',async()=>{
 const source=await readFile(new URL('../public/engine.js',import.meta.url),'utf8');
 assert.match(source,/gl\.clear\(gl\.DEPTH_BUFFER_BIT\)/);
 assert.match(source,/stepViewModel\(viewModelState/);
 assert.match(source,/drawFirstPersonArms\(/);
 assert.match(source,/drawFirstPersonWeapon\(/);
 assert.doesNotMatch(source,/function drawFirstPersonViewModel[\s\S]*?new Float32Array/);
});
```

- [ ] **Step 2: Run the renderer contract tests and verify failure**

Run: `node --test tests/render-integration.test.mjs`  
Expected: FAIL because foreground functions are absent.

- [ ] **Step 3: Build immutable view-model component buffers once**

At initialization, generate local-space meshes for the arms and each weapon component into temporary arrays, upload each component to one static WebGL buffer, then discard the temporary arrays. Store `{buffer,count,basePosition,baseRotation}` records for sleeves, forearms, hands, stocks, receivers, magazines, barrels, sights, scopes, pumps, and bolts. Do not regenerate vertices during `frame()`.

Add a preallocated `Float32Array(16)` matrix scratch and a `composeViewModelMatrix(out,projection,position,rotation,scale)` helper that writes into `out` without allocating arrays. Per frame, animation changes only component matrices.

- [ ] **Step 4: Add the isolated foreground projection pass**

At frame end, only when first-person/transition is active, the local player is alive, not spectating, and not fully scoped:

```js
gl.clear(gl.DEPTH_BUFFER_BIT);
const projection=viewModelProjection;
drawFirstPersonViewModel(profile,viewModelState,projection);
```

`drawFirstPersonViewModel` iterates the prebuilt component records, writes each component's combined 62-degree projection/model transform into the shared matrix scratch, sets `uMatrix`, and calls the existing `draw(component.buffer,component.count)`. Set `uEye` to `[0,0,0]` during this pass so the camera-space model receives no distance fog. Rebind the world uniforms only on the next frame, so there is no extra world draw.

- [ ] **Step 5: Build original rounded arms and four distinct weapon silhouettes**

Use existing `box`, `ellipsoid`, `tube`, and color helpers redirected to `viewGeo`. Arms use overlapping ovoid shoulder/forearm/hand pieces with matching skin/sleeve materials. Each weapon includes these original components:

- AR: stock, receiver, separate magazine, handguard, barrel, front/rear sight, muzzle device.
- Shotgun: stock, thick receiver, pump grip, tube magazine, barrel rib, front bead.
- SMG: compact stock, short receiver, vertical magazine, short barrel, reflex sight.
- Sniper: stock, long receiver, separate magazine, bolt handle, long barrel, scope body/turrets/lenses.

Keep every invariant component in its initialization-time GPU buffer and animate only component matrices for the weapon root, magazine, pump, and bolt.

- [ ] **Step 6: Map procedural state to reload/equip/action parts**

For `release`, tilt the root and move the support hand to the magazine. For `eject`, translate magazine down. For `insert`, reverse magazine travel. For `action`, animate AR/SMG slide, shotgun pump, or sniper bolt. For `settle`, damp the root to the stance anchor. Sprint lowers the root; ADS moves it to `adsAnchor`; scope hides the entire view model only after scope blend exceeds `.82`.

- [ ] **Step 7: Connect shot impulses, movement, mouse sway, switching, and building**

Call `stepViewModel` once per frame with the current semantic state. Pass a one-frame `shotImpulse` from authoritative local shot events. In build slots render a curved holographic blueprint and compact tool instead of a firearm while preserving the world preview and click-to-build behavior.

- [ ] **Step 8: Run renderer and full tests**

Run: `npm run syntax && npm test`  
Expected: PASS with no view-model vertex generation and no new typed-array creation inside `frame()`.

- [ ] **Step 9: Commit view models**

```bash
git add public/engine.js public/game.css tests/render-integration.test.mjs
git commit -m "feat: render detailed animated first-person weapons"
```

---

### Task 7: Bounded Effects and Projectile Presentation

**Files:**
- Create: `public/effect-pool.js`
- Create: `tests/effect-pool.test.mjs`
- Modify: `public/engine.js`
- Modify: `public/multiplayer-runtime.js`
- Modify: `tests/multiplayer-runtime.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `createEffectPool(capacity)` with `spawn(data)`, `update(dt)`, `forEachActive(callback)`, `clear()`, `activeCount`.
- Produces: `acceptEventId(cache,id,now,ttl): boolean` for projectile terminal-event deduplication.
- Consumes: shot/projectile events from Task 4.

- [ ] **Step 1: Write failing pool and deduplication tests**

```js
test('effect pool reuses bounded slots under sustained fire',()=>{
 const pool=createEffectPool(8);
 for(let i=0;i<100;i++)pool.spawn({kind:'tracer',life:.2,x:i});
 assert.equal(pool.activeCount,8);
 pool.update(.21);assert.equal(pool.activeCount,0);
 for(let i=0;i<8;i++)pool.spawn({kind:'impact',life:.1});
 assert.equal(pool.activeCount,8);
});

test('projectile event ids are accepted once inside their ttl',()=>{
 const cache=new Map();
 assert.equal(acceptEventId(cache,'a:1',1000,3000),true);
 assert.equal(acceptEventId(cache,'a:1',1200,3000),false);
 assert.equal(acceptEventId(cache,'a:1',5001,3000),true);
});
```

- [ ] **Step 2: Run tests and confirm missing exports fail**

Run: `node --test tests/effect-pool.test.mjs tests/multiplayer-runtime.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement a fixed-capacity reusable pool**

Preallocate slot objects in `createEffectPool`. `spawn` chooses the first inactive slot or replaces the active slot with the lowest remaining life. Mutate slot fields rather than spreading/cloning. `update` clamps `dt` to `.1` and deactivates expired slots. `clear` marks every slot inactive.

- [ ] **Step 4: Replace unbounded `effects.push` paths**

Create separate capacities by quality tier, default Medium: 48 tracers, 72 impacts, 24 muzzle/casing effects, and 16 projectile visuals. Cosmetic hitscan tracers use authoritative shot endpoints. Sniper visuals interpolate the latest host projectile/impact timestamps and terminate on either impact or expiry event.

- [ ] **Step 5: Add terminal-event deduplication**

Implement `acceptEventId` in `multiplayer-runtime.js` by storing expiry timestamps and pruning expired entries when the cache exceeds 128 keys. Apply it only to `projectile-impact` and `projectile-expire`; do not alter input cadence or snapshot cadence.

- [ ] **Step 6: Run focused and full tests**

Run: `npm run syntax && npm test`  
Expected: PASS; existing network cadence assertions remain unchanged.

- [ ] **Step 7: Commit bounded effects**

```bash
git add public/effect-pool.js public/engine.js public/multiplayer-runtime.js tests/effect-pool.test.mjs tests/multiplayer-runtime.test.mjs package.json
git commit -m "perf: pool combat effects and deduplicate projectiles"
```

---

### Task 8: Auto Quality, HUD, Scope, and Pointer-Lock UX

**Files:**
- Create: `public/quality-system.js`
- Create: `tests/quality-system.test.mjs`
- Modify: `public/index.html`
- Modify: `public/game.css`
- Modify: `public/engine.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `QUALITY_PRESETS`, `createAutoQuality(initial)`, `sampleAutoQuality(state,frameMs,now)`.
- Persists keys: `sunny.graphicsQuality`, `sunny.mouseSensitivity`, `sunny.scopeSensitivity`.
- Adds match-only settings drawer IDs: `game-settings`, `graphics-quality`, `mouse-sensitivity`, `scope-sensitivity`, `resume-control`.

- [ ] **Step 1: Add failing quality tests**

```js
test('auto quality changes only after sustained pressure and uses hysteresis',()=>{
 let state=createAutoQuality('high');
 for(let i=0;i<60;i++)state=sampleAutoQuality(state,25,i*100);
 assert.equal(state.level,'medium');
 for(let i=0;i<20;i++)state=sampleAutoQuality(state,10,7000+i*100);
 assert.equal(state.level,'medium');
 for(let i=0;i<180;i++)state=sampleAutoQuality(state,10,10000+i*100);
 assert.equal(state.level,'high');
});

test('every quality preset has bounded render budgets',()=>{
 for(const preset of Object.values(QUALITY_PRESETS)){
  assert.ok(preset.pixelRatio>0&&preset.pixelRatio<=1.6);
  assert.ok(preset.effects>=16&&preset.effects<=160);
  assert.ok(preset.remoteDetail>0&&preset.remoteDetail<=1);
 }
});
```

- [ ] **Step 2: Verify the new tests fail**

Run: `node --test tests/quality-system.test.mjs`  
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement Low, Medium, High, and Auto selection**

Define immutable presets: Low `{pixelRatio:1,effects:40,remoteDetail:.55,shadows:false}`, Medium `{pixelRatio:1.25,effects:80,remoteDetail:.78,shadows:true}`, High `{pixelRatio:1.6,effects:144,remoteDetail:1,shadows:true}`. Auto samples a 60-frame rolling average, steps down above 21ms sustained for 4 seconds, and steps up below 14ms sustained for 15 seconds. Do not change simulation timestep or network cadence.

- [ ] **Step 4: Add match-only settings and persisted controls**

Place the settings drawer outside `#lobby`. Use labeled range inputs for mouse/scope sensitivity and a select for Auto/Low/Medium/High. Load finite clamped values from local storage; write on `change`; apply sensitivity in the existing mouse-look handler.

- [ ] **Step 5: Polish first-person HUD and scope**

Keep crosshair centered; express spread through the existing `--gap`; hide hip crosshair during full sniper scope; add a clean range line and restrained vignette; keep hit markers below the reticle center. Ammo/reload UI displays magazine count, capacity, current weapon, and stage label from `reloadStage`. Do not add lobby CSS overrides.

- [ ] **Step 6: Handle pointer-lock loss without clearing the round**

On unexpected pointer-lock loss, stop `firing` and `aim`, show `#resume-control`, and keep `running=true`. Clicking Resume requests pointer lock and resumes audio. Escape still opens the pause overlay. Blur continues clearing inputs to prevent stuck movement.

- [ ] **Step 7: Run DOM wiring, syntax, and all tests**

Run: `npm run syntax && npm test && npm run build`  
Expected: PASS and `dist/quality-system.js` exists.

- [ ] **Step 8: Commit UX and quality controls**

```bash
git add public/quality-system.js public/index.html public/game.css public/engine.js tests/quality-system.test.mjs package.json
git commit -m "feat: polish first-person HUD and adaptive quality"
```

---

### Task 9: Multiplayer Soak Regressions and Performance Guards

**Files:**
- Create: `tests/first-person-soak.test.mjs`
- Modify: `tests/render-integration.test.mjs`
- Modify: `tests/network-tuning.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes all completed systems.
- Produces no runtime API; adds release gates and documentation.

- [ ] **Step 1: Add a deterministic two-player combat soak test**

Simulate 45 seconds at 20Hz with two landed players alternating movement, AR sustained fire, sniper shot, reload, weapon switch, wall placement, and round reset. Assertions:

```js
assert.ok(snapshot.players.every(p=>p.p.every(Number.isFinite)));
assert.ok(snapshot.players.every(p=>Number.isFinite(p.hp)&&Number.isFinite(p.ammo)));
assert.ok(match.projectiles.length<=8);
assert.ok(match.events.length<=256);
assert.ok(match.structures.length<=32);
assert.doesNotThrow(()=>structuredClone(snapshot));
```

- [ ] **Step 2: Add renderer allocation guards**

Extend source integration tests to reject `effects.push(`, repeated `new Float32Array` in `frame`, and per-frame reinitialization of view-model/effect pools. Assert that local avatar suppression, scope hiding, build view model, and reusable buffers all remain wired.

- [ ] **Step 3: Add network-budget regression assertions**

Keep current `networkCadence()` values unchanged. Assert projectile terminal events are event-driven rather than added to continuous input payloads, and that four-player calculated broadcast use remains below the existing budget.

- [ ] **Step 4: Run the complete local release gate**

Run: `npm run check`  
Expected: syntax PASS, every Node test PASS, and static Vercel build PASS.

- [ ] **Step 5: Run a local two-browser manual checklist**

Start: `npm run dev`  
Verify in two Chrome windows:

1. Lobby appearance and controls are unchanged.
2. Both clients enter transport/drop/glide in third-person.
3. Each local camera transitions once into first-person after landing.
4. Movement never freezes while holding forward, strafing, aiming, or firing.
5. Crosshair-aligned AR/SMG/shotgun shots register on the target.
6. Sniper projectile travels, drops mildly, and is stopped by a wall.
7. Remote aim, reload, switch, fire, build, elimination, and rematch are visible.
8. Pointer-lock recovery, scope, settings persistence, and Auto quality work.
9. DevTools console has no uncaught errors and frame time stays stable on Medium.

- [ ] **Step 6: Update README controls and architecture notes**

Document third-person aerial/first-person landed behavior, ADS/scope, reload/switch/build controls, graphics presets, and the sniper-only projectile rule. State that Supabase schema/setup is unchanged.

- [ ] **Step 7: Commit release validation**

```bash
git add tests/first-person-soak.test.mjs tests/render-integration.test.mjs tests/network-tuning.test.mjs README.md
git commit -m "test: validate first-person multiplayer release"
```

---

### Task 10: Build Artifact and `test`-Only Publication

**Files:**
- Regenerate: `dist/**`
- Verify: `vercel.json`, `.env.example` if present, repository branch pointers.

**Interfaces:**
- Consumes the complete verified source.
- Produces the deployable static `dist` artifact on `test` only.

- [ ] **Step 1: Rebuild from a clean output directory**

Run: `npm run build`  
Expected: `dist` is recreated, contains every new public module, and prints the correct Supabase configuration status without exposing credentials.

- [ ] **Step 2: Compare source and built artifacts**

Run:

```bash
for file in first-person-system.js view-model.js ballistics.js effect-pool.js quality-system.js engine.js simulation.js weapon-system.js; do cmp "public/$file" "dist/$file"; done
```

Expected: every comparison exits 0.

- [ ] **Step 3: Run final verification after artifact generation**

Run: `npm run check`  
Expected: all checks PASS from the exact files being published.

- [ ] **Step 4: Commit generated artifacts**

```bash
git add dist package.json public tests README.md docs/superpowers/specs/2026-09-16-first-person-combat-design.md docs/superpowers/plans/2026-09-16-first-person-combat.md
git commit -m "build: package v8 first-person combat"
```

- [ ] **Step 5: Publish only the `test` branch and verify branch isolation**

Push the fast-forward v8 commit to `test`. Confirm remote `test` points to the new commit and remote `main` remains at its pre-v8 commit. If Vercel has a branch preview, verify its deployment status; do not promote it to production.
