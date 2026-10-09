import {WEAPON_PROFILES} from './weapon-system.js';

export const beginDrag=(slot,x,y,pointerId)=>({slot,x,y,pointerId,dragging:false});
export function moveDrag(d,x,y){if(Math.hypot(x-d.x,y-d.y)>=6)d.dragging=true;return d.dragging;}
export const finishDrag=(d,to)=>d.dragging&&Number.isInteger(to)&&to>=1&&to<=5&&to!==d.slot?{from:d.slot,to}:null;
export function dragGhostPosition(x,y,width,height,viewportWidth,viewportHeight){
 const fit=(pointer,size,viewport)=>Math.max(0,Math.min(Math.max(0,viewport-size-12),pointer+18));
 return {x:fit(x,width,viewportWidth),y:fit(y,height,viewportHeight)};
}

export function createInventoryMenu({root,getState,onMove,onSelect,onOpen,onClose,getThumbnail=()=>null}){
 let opened=false,drag=null,keyboardSource=null,signature='',previousFocus=null;
 const cards=root.querySelector('[data-inventory-cards]'),ghost=root.querySelector('[data-drag-ghost]'),hint=root.querySelector('[data-inventory-hint]'),defaultHint='Drag to move · Drop on a weapon to swap · Click to equip';
 const setHint=text=>{if(hint.textContent!==text)hint.textContent=text;};
 hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');
 const buttons=Array.from({length:5},(_,i)=>{
  const b=document.createElement('button');b.type='button';b.className='inventory-card';b.dataset.inventorySlot=String(i+1);
  b.innerHTML=`<span class="inventory-card-top"><kbd>${i+1}</kbd><span class="inventory-equipped" aria-hidden="true">IN HAND</span></span><span class="inventory-card-art"></span><strong></strong><small></small><span class="inventory-ammo-track" aria-hidden="true"><i class="inventory-ammo-fill"></i></span><span class="inventory-card-action"></span>`;
  cards.append(b);return b;
 });
 const clearTargets=()=>{for(const b of buttons){b.classList.remove('drop-target');delete b.dataset.dropKind;delete b.dataset.dropLabel;}};
 const cancel=()=>{
  const pointerId=drag?.pointerId;drag=null;keyboardSource=null;ghost.hidden=true;ghost.replaceChildren();delete root.dataset.dragging;
  clearTargets();for(const b of buttons)b.classList.remove('drag-source','keyboard-source');setHint(defaultHint);
  if(pointerId!=null&&cards.hasPointerCapture(pointerId))cards.releasePointerCapture(pointerId);
 };
 function update(){
  if(!opened)return;const state=getState();if(!state.alive||state.phase!=='playing'){close();return;}
  const next=JSON.stringify([state.inventory,state.slot,state.utilities,state.materials,state.rules,state.inventory.map(w=>w?Boolean(getThumbnail(w.type)):false)]);
  if(next===signature)return;signature=next;
  for(const [i,b]of buttons.entries()){
   const item=state.inventory[i],profile=WEAPON_PROFILES[item?.type],art=b.querySelector('.inventory-card-art'),image=profile&&getThumbnail(item.type),equipped=Boolean(item&&state.slot===i+1);
   b.dataset.itemId=item?.id||'';b.classList.toggle('empty',!item);b.classList.toggle('equipped',equipped);b.style.setProperty('--rarity',profile?.color||'#405868');
   b.setAttribute('aria-label',item?`Slot ${i+1}: ${profile.name}, ${item.ammo} rounds. Drag to rearrange or press Space then a destination.`:`Slot ${i+1}: empty`);b.setAttribute('aria-pressed',String(equipped));
   art.replaceChildren();if(image){const img=document.createElement('img');img.src=image;img.alt='';img.draggable=false;art.append(img);}else art.textContent=profile?.icon||'＋';
   b.querySelector('strong').textContent=profile?.name||'EMPTY SLOT';b.querySelector('small').textContent=item?`${item.ammo} / ${profile.magazineCapacity} ROUNDS`:'Drag a weapon here';
   b.querySelector('.inventory-ammo-fill').style.width=profile?`${Math.max(0,Math.min(1,item.ammo/profile.magazineCapacity))*100}%`:'0%';
   b.querySelector('.inventory-card-action').textContent=item?'DRAG TO MOVE':'AVAILABLE';
  }
  const count=root.querySelector('[data-inventory-count]');if(count)count.textContent=`${state.inventory.filter(Boolean).length} / 5 WEAPONS`;
  root.querySelector('[data-inventory-utilities]').textContent=state.rules?.building===false?`7  SHIELD ${state.utilities?.shield||0}   ·   8  MED KIT ${state.utilities?.health||0}`:`0  PICKAXE   ·   Z  WALL   ·   V  RAMP   ·   7  SHIELD ${state.utilities?.shield||0}   ·   8  MED KIT ${state.utilities?.health||0}   ·   9  SHOCKWAVE ${state.utilities?.shockwave||0}`;
  root.querySelector('[data-inventory-materials]').textContent=`WOOD ${state.materials?.wood||0}   /   STONE ${state.materials?.stone||0}`;
 }
 function open(){
  const state=getState();if(opened||!state.alive||state.phase!=='playing')return;
  opened=true;previousFocus=document.activeElement;root.hidden=false;document.body.classList.add('inventory-open');onOpen();signature='';cancel();update();buttons[state.slot>=1&&state.slot<=5?state.slot-1:0].focus({preventScroll:true});
 }
 function close(){if(!opened)return;opened=false;cancel();root.hidden=true;document.body.classList.remove('inventory-open');previousFocus?.focus?.({preventScroll:true});onClose();}
 root.querySelector('[data-inventory-close]').onclick=close;
 cards.addEventListener('pointerdown',e=>{
  const b=e.target.closest('[data-inventory-slot]');if(!b||e.button!==0||!b.dataset.itemId)return;
  cancel();drag=beginDrag(Number(b.dataset.inventorySlot),e.clientX,e.clientY,e.pointerId);b.focus({preventScroll:true});cards.setPointerCapture(e.pointerId);e.preventDefault();
 });
 cards.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointerId||!moveDrag(drag,e.clientX,e.clientY))return;
  const source=buttons[drag.slot-1];source.classList.add('drag-source');root.dataset.dragging='true';
  if(ghost.hidden){
   const preview=source.cloneNode(true);preview.removeAttribute('data-inventory-slot');preview.disabled=true;preview.classList.remove('drag-source');ghost.replaceChildren(preview);ghost.hidden=false;
   drag.width=ghost.offsetWidth;drag.height=ghost.offsetHeight;
  }
  const p=dragGhostPosition(e.clientX,e.clientY,drag.width,drag.height,innerWidth,innerHeight);ghost.style.transform=`translate3d(${p.x}px,${p.y}px,0)`;
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-inventory-slot]');clearTargets();
  if(target&&cards.contains(target)&&target!==source){
   const occupied=Boolean(target.dataset.itemId),slot=Number(target.dataset.inventorySlot);target.classList.add('drop-target');target.dataset.dropKind=occupied?'swap':'move';target.dataset.dropLabel=occupied?'RELEASE TO SWAP':'RELEASE TO MOVE';
   setHint(occupied?`Release to swap with ${WEAPON_PROFILES[getState().inventory[slot-1]?.type]?.name||'this weapon'} in slot ${slot}`:`Release to move to empty slot ${slot}`);
  }else setHint(target===source?'Release in the original slot to cancel':'Release outside the slots to cancel');
 });
 cards.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.pointerId)return;
  const d=drag,target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-inventory-slot]'),op=finishDrag(d,target&&cards.contains(target)?Number(target.dataset.inventorySlot):null);
  cancel();if(op)onMove(op.from,op.to);else if(!d.dragging)onSelect(d.slot);signature='';update();
 });
 cards.addEventListener('pointercancel',cancel);cards.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);
 cards.addEventListener('keydown',e=>{
  const b=e.target.closest('[data-inventory-slot]');if(!b)return;const slot=Number(b.dataset.inventorySlot);
  if(e.code==='Space'){
   e.preventDefault();if(keyboardSource){const from=keyboardSource;cancel();if(from!==slot)onMove(from,slot);signature='';update();}
   else if(b.dataset.itemId){keyboardSource=slot;b.classList.add('keyboard-source');setHint('Choose a destination and press Space to move or swap');}
  }else if(e.code==='Enter'){e.preventDefault();cancel();onSelect(slot);signature='';update();}
  else if(e.code==='ArrowRight'||e.code==='ArrowLeft'){e.preventDefault();buttons[(slot-1+(e.code==='ArrowRight'?1:4))%5].focus();}
 });
 return {open,close,toggle:()=>opened?close():open(),update,get isOpen(){return opened;}};
}
