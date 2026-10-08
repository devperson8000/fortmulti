import {DEPLOYMENT_MUSIC_END,DEPLOYMENT_MUSIC_FADE} from './deployment-cinematic.js';

// The decoded song is shared by rounds. Scheduling and camera timing use the
// same AudioContext clock, including when a recovering client needs to seek.
export function createDeploymentAudio({fetchAudio=fetch}={}){
 const contexts=new WeakMap();
 const encoded=fetchAudio(new URL('./audio/deployment-intro.mp3',import.meta.url)).then(r=>{
  if(!r.ok)throw Error('Deployment music unavailable');return r.arrayBuffer();
 }).catch(()=>null);
 function cancelVoice(context,fade=0){
  const state=context&&contexts.get(context),voice=state?.voice;if(!voice)return;
  state.voice=null;const now=context.currentTime;
  for(const layer of voice.layers){
   layer.gain.gain.cancelScheduledValues(now);
   layer.gain.gain.setValueAtTime(fade?layer.gain.gain.value:0,now);
   if(fade)layer.gain.gain.linearRampToValueAtTime(0,now+fade);
   try{layer.source.stop(now+fade);}catch{}
  }
 }
 function stop(context){
  const state=context&&contexts.get(context);if(!state)return;
  state.finished=true;cancelVoice(context,context.state==='running'?.12:0);
 }
 function musicClock(context,voice){
  const now=context.currentTime,stamp=context.getOutputTimestamp?.();let audible=now;
  // currentTime runs ahead of the speakers. Project a valid device timestamp
  // to this frame so lyric cues follow audible output rather than render-ahead.
  if(stamp&&Number.isFinite(stamp.contextTime)&&stamp.contextTime>=0&&Number.isFinite(stamp.performanceTime)&&stamp.performanceTime>0){
   audible=Math.min(now,stamp.contextTime+Math.max(0,performance.now()-stamp.performanceTime)/1000);
  }
  // Device timestamp refreshes can jitter backward by an audio block. Hold
  // the cue until it catches up rather than briefly reversing the camera.
  return voice.clock=Math.max(voice.clock??-Infinity,audible-voice.anchor);
 }
 return {
  load(context){
   if(!context)return Promise.resolve(false);
   if(contexts.has(context))return contexts.get(context).ready;
   const state={buffer:null,voice:null,sequence:'',ready:null};contexts.set(context,state);
   // Audio time freezes while the server's deployment continues. A suspended
   // voice must not resume at its old offset, even if animation frames pause.
   context.addEventListener?.('statechange',()=>{if(context.state!=='running')cancelVoice(context);});
   state.ready=encoded.then(async bytes=>{try{
    if(bytes)state.buffer=await context.decodeAudioData(bytes.slice(0));
   }catch{}return Boolean(state.buffer);});
   return state.ready;
  },
  time(context,sequence){
   const state=context&&contexts.get(context);
   return state?.voice&&state.sequence===sequence&&context.state==='running'?musicClock(context,state.voice):null;
  },
  update(context,sequence,musicTime){
   const state=context&&contexts.get(context);
   if(state&&context.state!=='running'){cancelVoice(context);return null;}
   if(!state?.buffer||context.state!=='running'||!sequence||!Number.isFinite(musicTime))return null;
   if(state.sequence!==sequence){stop(context);state.sequence=sequence;state.finished=false;}
   if(state.voice){
    const current=musicClock(context,state.voice);
    if(state.voice.ended&&current>=DEPLOYMENT_MUSIC_END){state.voice=null;state.finished=true;return current;}
    return current;
   }
   if(state.finished)return null;
   if(musicTime>=DEPLOYMENT_MUSIC_END){state.finished=true;return null;}
   const now=context.currentTime,anchor=now-musicTime,source=context.createBufferSource(),gain=context.createGain();
   const voice={layers:[{source,gain}],anchor},start=Math.max(now,anchor),offset=Math.max(0,musicTime),level=.65;
   const end=anchor+DEPLOYMENT_MUSIC_END,fadeAt=end-DEPLOYMENT_MUSIC_FADE;
   state.voice=voice;
   // One forward-playing voice: the provided verse continues through the
   // walkout and salute, then fades before the gameplay handoff.
   source.buffer=state.buffer;source.connect(gain);gain.connect(context.destination);
   gain.gain.setValueAtTime(0,start);
   if(start>=fadeAt){
    const attackEnd=Math.min(end,start+Math.min(.02,(end-start)*.2));
    gain.gain.linearRampToValueAtTime(level*Math.max(0,(end-attackEnd)/DEPLOYMENT_MUSIC_FADE),attackEnd);
   }else{
    gain.gain.linearRampToValueAtTime(level,Math.min(fadeAt,start+Math.max(.02,.65-offset)));
    gain.gain.setValueAtTime(level,fadeAt);
   }
   gain.gain.linearRampToValueAtTime(0,end);
   source.onended=()=>{
    source.disconnect();gain.disconnect();
    if(state.voice!==voice)return;
    // Keep the clock through output-device latency after the scheduled stop.
    if(context.currentTime-anchor>=DEPLOYMENT_MUSIC_END-.05)voice.ended=true;
    else{state.voice=null;state.finished=true;}
   };
   source.start(start,offset);source.stop(end);
   return musicClock(context,voice);
  },
  stop,
  reset(context){stop(context);const state=context&&contexts.get(context);if(state){state.sequence='';state.finished=false;}}
 };
}
