// The decoded song is shared by rounds. Scheduling and camera timing use the
// same AudioContext clock, including when a recovering client needs to seek.
export function createDeploymentAudio({fetchAudio=fetch}={}){
 const contexts=new WeakMap();
 const encoded=fetchAudio(new URL('./audio/deployment-intro.mp3',import.meta.url)).then(r=>{
  if(!r.ok)throw Error('Deployment music unavailable');return r.arrayBuffer();
 }).catch(()=>null);
 function stop(context){
  const state=context&&contexts.get(context),voice=state?.voice;if(!voice)return;
  state.voice=null;state.finished=true;const now=context.currentTime;
  voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);voice.gain.gain.linearRampToValueAtTime(0,now+.12);
  try{voice.source.stop(now+.12);}catch{}
 }
 return {
  load(context){
   if(!context)return Promise.resolve(false);
   if(contexts.has(context))return contexts.get(context).ready;
   const state={buffer:null,voice:null,sequence:'',ready:null};contexts.set(context,state);
   state.ready=encoded.then(async bytes=>{try{if(bytes)state.buffer=await context.decodeAudioData(bytes.slice(0));}catch{}return Boolean(state.buffer);});
   return state.ready;
  },
  update(context,sequence,musicTime){
   const state=context&&contexts.get(context);
   if(!state?.buffer||context.state!=='running'||!sequence||!Number.isFinite(musicTime))return null;
   if(state.sequence!==sequence){stop(context);state.sequence=sequence;state.finished=false;}
   if(state.voice)return context.currentTime-state.voice.anchor;
   if(state.finished||musicTime>=state.buffer.duration)return null;
   const now=context.currentTime,source=context.createBufferSource(),gain=context.createGain(),anchor=now-musicTime;
   source.buffer=state.buffer;source.loop=false;source.connect(gain);gain.connect(context.destination);
   const start=Math.max(now,anchor),offset=Math.max(0,musicTime),level=.65;
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+Math.max(.02,.65-offset));
   const tail=anchor+state.buffer.duration;
   gain.gain.setValueAtTime(level,Math.max(start+.02,tail-.65));gain.gain.linearRampToValueAtTime(0,Math.max(start+.03,tail));
   const voice={source,gain,anchor};state.voice=voice;
   source.onended=()=>{source.disconnect();gain.disconnect();if(state.voice===voice){state.voice=null;state.finished=true;}};
   source.start(start,offset);return musicTime;
  },
  stop,
  reset(context){stop(context);const state=context&&contexts.get(context);if(state){state.sequence='';state.finished=false;}}
 };
}
