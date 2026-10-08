import {DEPLOYMENT_MUSIC_END,DEPLOYMENT_AUDIO_FADE_SECONDS} from './deployment-cinematic.js';

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
    if(state.voice.ended&&current>=state.voice.endMusic-.005){
     state.voice=null;state.finished=true;return null;
    }
    return current;
   }
   if(state.finished)return null;
   // Never restart the opening, loop a short riff, or play beyond the uploaded
   // recording. The complete original verse, including its ending, is one
   // continuously decoded and scheduled AudioBufferSourceNode.
   const endMusic=Math.min(DEPLOYMENT_MUSIC_END,state.buffer.duration);
   if(musicTime>=endMusic||endMusic<=0){state.finished=true;return null;}
   const now=context.currentTime,anchor=now-musicTime,start=Math.max(now,anchor);
   const offset=Math.max(0,musicTime),deadline=anchor+endMusic;
   if(start>=deadline){state.finished=true;return null;}
   const source=context.createBufferSource(),gain=context.createGain();
   const voice={layers:[{source,gain}],anchor,endMusic,ended:false};
   state.voice=voice;source.buffer=state.buffer;
   source.connect(gain);gain.connect(context.destination);
   // Keep the last salute on the original recording and end on its natural
   // timeline. Late-joining clients start at the correct already-faded level.
   const fadeStart=Math.max(0,endMusic-DEPLOYMENT_AUDIO_FADE_SECONDS);
   const fadeDuration=Math.max(.001,endMusic-fadeStart),level=.65;
   gain.gain.setValueAtTime(0,start);
   if(offset<fadeStart){
    // Never place a late-join attack past the global fade boundary. Doing so
    // briefly restored full volume after the outro was already fading.
    const attackEnd=Math.min(anchor+fadeStart,start+.14);
    gain.gain.linearRampToValueAtTime(level,attackEnd);
    if(attackEnd<anchor+fadeStart)gain.gain.setValueAtTime(level,anchor+fadeStart);
   }else{
    // Start at the song's CURRENT fade level, not at full gain. Leave enough
    // space for the short attack even if only a few milliseconds remain.
    const attackEnd=Math.min(deadline,start+Math.min(.018,(deadline-start)*.2));
    gain.gain.linearRampToValueAtTime(level*Math.max(0,(deadline-attackEnd)/fadeDuration),attackEnd);
   }
   gain.gain.linearRampToValueAtTime(0,deadline);
   source.onended=()=>{
    source.disconnect();gain.disconnect();
    if(state.voice!==voice)return;
    voice.ended=true;
    const stamp=context.getOutputTimestamp?.();
    // With valid device timestamps, keep the music clock alive until the last
    // audible samples reach the speakers, not merely the render buffer.
    if(!stamp||!Number.isFinite(stamp.contextTime)||!stamp.performanceTime){
     state.voice=null;state.finished=true;
    }
   };
   source.start(start,offset);
   // A full-length buffer ends naturally. Schedule an early stop only if the
   // cinematic handoff comes before the recording's own final sample.
   if(endMusic<state.buffer.duration-.001)source.stop(deadline);
   return musicClock(context,voice);
  },
  stop,
  reset(context){stop(context);const state=context&&contexts.get(context);if(state){state.sequence='';state.finished=false;}}
 };
}
