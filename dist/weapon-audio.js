// Fetch and decode away from the shot path. Each bullet gets its own voice;
// overlapping decay tails share this buffer and never restart an earlier shot.
export function createWeaponAudio(){
 const encoded=fetch(new URL('./audio/ar-shot.wav',import.meta.url)).then(response=>{
  if(!response.ok)throw new Error('AR audio unavailable');
  return response.arrayBuffer();
 }).catch(()=>null),contexts=new WeakMap();
 return {
  load(context){
   if(!context)return Promise.resolve(false);
   const cached=contexts.get(context);if(cached)return cached.ready;
   const state={buffer:null,ready:null};contexts.set(context,state);
   state.ready=encoded.then(bytes=>bytes?context.decodeAudioData(bytes.slice(0)):null).then(buffer=>{state.buffer=buffer;return Boolean(buffer);}).catch(()=>false);
   return state.ready;
  },
  play(context,weapon){
   const buffer=context&&contexts.get(context)?.buffer;
   if(weapon!=='ar'||!buffer||context.state==='closed')return false;
   const source=context.createBufferSource(),gain=context.createGain();
   source.buffer=buffer;source.loop=false;gain.gain.value=.32;
   source.connect(gain);gain.connect(context.destination);
   source.onended=()=>{source.disconnect();gain.disconnect();};
   source.start();return true;
  }
 };
}
