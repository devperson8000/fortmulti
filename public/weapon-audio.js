// Fetch and decode away from the shot path. Each bullet gets its own voice;
// overlapping decay tails share this buffer and never restart an earlier shot.
export function remoteGunshotGain(origin,listener){
 if(!Array.isArray(origin)||!Array.isArray(listener)||origin.length<3||listener.length<3||!origin.slice(0,3).every(Number.isFinite)||!listener.slice(0,3).every(Number.isFinite))return 0;
 const distance=Math.hypot(origin[0]-listener[0],origin[1]-listener[1],origin[2]-listener[2]);
 return distance>=120?0:.7*(1-distance/120)**2/(1+(distance/18)**2);
}
export function createWeaponAudio(){
 const samples=[{key:'ar:shot',file:'ar-shot.wav',gain:.32},{key:'shotgun:shot',file:'shotgun-shot.wav',gain:.42},{key:'shotgun:reload',file:'shotgun-reload.wav',gain:.7}],contexts=new WeakMap();
 const encoded=samples.map(sample=>fetch(new URL('./audio/'+sample.file,import.meta.url)).then(response=>{
  if(!response.ok)throw new Error('Weapon audio unavailable');return response.arrayBuffer();
 }).catch(()=>null));
 function voice(context,key,duration,elapsed=0,volume=1){
  const state=context&&contexts.get(context),buffer=state?.buffers.get(key),sample=samples.find(s=>s.key===key);
  if(!buffer||context.state==='closed')return null;
  const rate=duration>0?buffer.duration/duration:1,offset=Math.max(0,elapsed)*rate;
  if(offset>=buffer.duration)return null;
  const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buffer;source.loop=false;source.playbackRate.value=rate;gain.gain.value=sample.gain*volume;
  source.connect(gain);gain.connect(context.destination);
  source.onended=()=>{source.disconnect();gain.disconnect();if(state.reload?.source===source)state.reload=null;};
  source.start(0,offset);return {source,gain};
 }
 function stopReload(context){
  const state=context&&contexts.get(context),active=state?.reload;if(!active)return false;
  state.reload=null;const now=context.currentTime;
  // This voice has a constant gain until cancellation. Use the widely supported
  // scheduling API to anchor it before fading, including in older browsers.
  const level=active.gain.gain.value;active.gain.gain.cancelScheduledValues(now);active.gain.gain.setValueAtTime(level,now);active.gain.gain.linearRampToValueAtTime(0,now+.045);
  active.source.stop(now+.045);return true;
 }
 return {
  load(context){
   if(!context)return Promise.resolve(false);
   const cached=contexts.get(context);if(cached)return cached.ready;
   const state={buffers:new Map(),reload:null,ready:null};contexts.set(context,state);
   state.ready=Promise.all(encoded.map(async(bytesPromise,i)=>{try{const bytes=await bytesPromise;if(bytes)state.buffers.set(samples[i].key,await context.decodeAudioData(bytes.slice(0)));}catch{}})).then(()=>state.buffers.size===samples.length);
   return state.ready;
  },
  play(context,weapon,volume=1){
   if(!Number.isFinite(volume)||volume<=0)return false;
   return Boolean(voice(context,weapon+':shot',undefined,0,Math.min(1,volume)));
  },
  playReload(context,weapon,duration,elapsed=0){
   if(!(duration>0)||!Number.isFinite(duration)||!Number.isFinite(elapsed))return false;
   stopReload(context);const active=voice(context,weapon+':reload',duration,elapsed);
   if(!active)return false;contexts.get(context).reload=active;return true;
  },
  stopReload
 };
}
