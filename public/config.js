window.SUNNY_CONFIG={url:'',key:''};

(()=>{
 const installBufferReuse=Proto=>{
  if(!Proto||Proto.__sunnyDynamicReuse)return;
  Object.defineProperty(Proto,'__sunnyDynamicReuse',{value:true});
  const originalBind=Proto.bindBuffer,originalData=Proto.bufferData,originalSub=Proto.bufferSubData;
  if(typeof originalBind!=='function'||typeof originalData!=='function'||typeof originalSub!=='function')return;
  const boundByContext=new WeakMap(),capacityByBuffer=new WeakMap();
  Proto.bindBuffer=function(target,buffer){let bound=boundByContext.get(this);if(!bound){bound=new Map();boundByContext.set(this,bound);}bound.set(target,buffer);return originalBind.call(this,target,buffer);};
  Proto.bufferData=function(target,value,usage){
   if(this.canvas?.id==='game'&&usage===this.DYNAMIC_DRAW&&ArrayBuffer.isView(value)){
    const buffer=boundByContext.get(this)?.get(target),capacity=buffer?(capacityByBuffer.get(buffer)||0):0;
    if(buffer&&capacity>=value.byteLength){originalSub.call(this,target,0,value);return;}
    const result=originalData.apply(this,arguments);if(buffer)capacityByBuffer.set(buffer,value.byteLength);return result;
   }
   return originalData.apply(this,arguments);
  };
 };
 installBufferReuse(globalThis.WebGLRenderingContext?.prototype);
 installBufferReuse(globalThis.WebGL2RenderingContext?.prototype);

 const nativeDpr=Number(window.devicePixelRatio)||1,maxCap=Math.min(nativeDpr,1.35),minCap=Math.min(nativeDpr,1);
 if(nativeDpr>1.05){
  let cap=maxCap,last=performance.now(),average=16.7,slowFrames=0,fastFrames=0;
  try{Object.defineProperty(window,'devicePixelRatio',{configurable:true,get:()=>Math.min(nativeDpr,cap)});}catch{return;}
  const sample=now=>{
   if(document.hidden){last=now;requestAnimationFrame(sample);return;}
   const dt=Math.min(100,Math.max(1,now-last));last=now;average=average*.94+dt*.06;
   if(average>24){slowFrames++;fastFrames=0;}else if(average<18.2){fastFrames++;slowFrames=Math.max(0,slowFrames-1);}else{slowFrames=Math.max(0,slowFrames-1);fastFrames=0;}
   if(slowFrames>=120&&cap>minCap){cap=Math.max(minCap,cap-.15);slowFrames=0;}else if(fastFrames>=900&&cap<maxCap){cap=Math.min(maxCap,cap+.1);fastFrames=0;}
   requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
 }
})();

Promise.all([
 import('./connection-stability.js'),
 import('./multiplayer-runtime.js')
]).catch(error=>console.error('Multiplayer stability runtime failed to load',error));
