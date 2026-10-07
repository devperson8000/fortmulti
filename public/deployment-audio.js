import {DEPLOYMENT_CUES,DEPLOYMENT_MUSIC_END} from './deployment-cinematic.js';

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
 function scheduleOutro(context,state,voice,musicTime){
  const riffStart=DEPLOYMENT_CUES.mainRiff,loopLength=3.96,loopEnd=riffStart+loopLength,tailCue=DEPLOYMENT_CUES.impact+.38;
  if(voice.outro||musicTime<tailCue-.08||state.buffer.duration<loopEnd+.1)return;
  const now=context.currentTime,source=context.createBufferSource(),gain=context.createGain(),start=Math.max(now,voice.anchor+tailCue),end=voice.anchor+DEPLOYMENT_MUSIC_END;
  const offset=riffStart+Math.max(0,musicTime-tailCue)%loopLength;
  source.buffer=state.buffer;source.loop=true;source.loopStart=riffStart;source.loopEnd=loopEnd;
  source.connect(gain);gain.connect(context.destination);
  gain.gain.setValueAtTime(0,start);
  gain.gain.linearRampToValueAtTime(.46,Math.max(start+.015,Math.min(end-.7,start+.35)));
  gain.gain.setValueAtTime(.46,Math.max(start+.02,end-.85));
  gain.gain.linearRampToValueAtTime(0,Math.max(start+.03,end));
  voice.layers.push({source,gain});voice.outro=true;
  source.onended=()=>{source.disconnect();gain.disconnect();if(state.voice===voice){state.voice=null;state.finished=true;}};
  source.start(start,offset);source.stop(Math.max(start+.04,end));
 }
 return {
  load(context){
   if(!context)return Promise.resolve(false);
   if(contexts.has(context))return contexts.get(context).ready;
   const state={buffer:null,voice:null,sequence:'',ready:null};contexts.set(context,state);
   // Audio time freezes while the server's deployment continues. A suspended
   // voice must not resume at its old offset, even if animation frames pause.
   context.addEventListener?.('statechange',()=>{if(context.state!=='running')cancelVoice(context);});
   state.ready=encoded.then(async bytes=>{try{if(bytes)state.buffer=await context.decodeAudioData(bytes.slice(0));}catch{}return Boolean(state.buffer);});
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
   if(state.voice){const current=musicClock(context,state.voice);scheduleOutro(context,state,state.voice,current);return current;}
   if(state.finished)return null;
   if(musicTime>=DEPLOYMENT_MUSIC_END){state.finished=true;return null;}
   const now=context.currentTime,anchor=now-musicTime,layers=[],voice={layers,anchor};
   state.voice=voice;
   // The original edited opening/verse is unchanged, including its fade.
   if(musicTime<state.buffer.duration){
    const source=context.createBufferSource(),gain=context.createGain(),start=Math.max(now,anchor),offset=Math.max(0,musicTime),level=.65;
    source.buffer=state.buffer;source.connect(gain);gain.connect(context.destination);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+Math.max(.02,.65-offset));
    const tail=anchor+state.buffer.duration;
    gain.gain.setValueAtTime(level,Math.max(start+.02,tail-.65));
    gain.gain.linearRampToValueAtTime(0,Math.max(start+.03,tail));
    layers.push({source,gain});
    source.onended=()=>{
     source.disconnect();gain.disconnect();
     if(state.voice===voice&&!voice.outro){
      const cue=musicClock(context,voice);
      state.voice=null;
      // A suspended/render-throttled client can resume during the outro.
      state.finished=cue<DEPLOYMENT_CUES.impact+.25;
     }
    };
    source.start(start,offset);
   }
   // Lazily schedule the instrumental only near touchdown; earlier calls
   // retain a single voice and cannot flood nodes with speculative loops.
   scheduleOutro(context,state,voice,musicTime);
   return musicClock(context,voice);
  },
  stop,
  reset(context){stop(context);const state=context&&contexts.get(context);if(state){state.sequence='';state.finished=false;}}
 };
}
