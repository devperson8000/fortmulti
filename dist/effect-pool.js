const copy3=(target,source)=>{
 target[0]=Number(source?.[0])||0;
 target[1]=Number(source?.[1])||0;
 target[2]=Number(source?.[2])||0;
 return target;
};

const createSlot=()=>({
 active:false,kind:'',life:0,maxLife:0,tracer:false,shell:false,projectileId:null,
 a:[0,0,0],b:[0,0,0],p:[0,0,0],v:[0,0,0],col:[1,1,1]
});

export function createEffectPool(capacity=96){
 const size=Math.max(1,Math.floor(Number(capacity)||1));
 const slots=Array.from({length:size},createSlot);
 let activeCount=0;

 const chooseSlot=()=>{
  let shortest=slots[0];
  for(const slot of slots){
   if(!slot.active)return slot;
   if(slot.life<shortest.life)shortest=slot;
  }
  return shortest;
 };

 return {
  get capacity(){return size;},
  get activeCount(){return activeCount;},
  spawn(data={}){
   const slot=chooseSlot();
   if(!slot.active)activeCount++;
   slot.active=true;
   slot.kind=String(data.kind||'impact');
   slot.life=Math.max(0,Number(data.life)||0);
   slot.maxLife=Math.max(slot.life,Number(data.maxLife)||slot.life||.001);
   slot.tracer=Boolean(data.tracer);
   slot.shell=Boolean(data.shell);
   slot.projectileId=data.projectileId??null;
   copy3(slot.a,data.a);copy3(slot.b,data.b);copy3(slot.p,data.p);
   copy3(slot.v,data.v);copy3(slot.col,data.col||[1,1,1]);
   return slot;
  },
  update(dt){
   const step=Math.max(0,Number(dt)||0);
   for(const slot of slots){
    if(!slot.active)continue;
    slot.life-=step;
    if(slot.life<=0){slot.active=false;activeCount--;}
   }
  },
  forEachActive(callback){for(const slot of slots)if(slot.active)callback(slot);},
  clear(){for(const slot of slots)slot.active=false;activeCount=0;}
 };
}
