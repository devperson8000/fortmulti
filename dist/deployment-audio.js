import {DEPLOYMENT_CUES,DEPLOYMENT_MUSIC_END} from './deployment-cinematic.js';
import {DEPLOYMENT_RIFF} from './deployment-cues.js';

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
  const riffStart=DEPLOYMENT_RIFF.start,loopEnd=DEPLOYMENT_RIFF.end,loopLength=loopEnd-riffStart,tailCue=state.buffer.duration-DEPLOYMENT_RIFF.crossfade;
  if(voice.outro||musicTime<tailCue-.08||state.buffer.duration<loopEnd+.1)return;
  const now=context.currentTime,source=context.createBufferSource(),gain=context.createGain(),start=Math.max(now,voice.anchor+tailCue),end=voice.anchor+DEPLOYMENT_MUSIC_END;
  // Continue the eight-beat phase instead of restarting the riff on a new bar.
  const songTime=start-voice.anchor,phase=((songTime-riffStart)%loopLength+loopLength)%loopLength;
  source.buffer=state.riff||state.buffer;source.loop=true;source.loopStart=state.riff?0:riffStart;source.loopEnd=state.riff?state.riff.duration:loopEnd;
  const offset=(state.riff?0:riffStart)+phase,level=.88;
  source.connect(gain);gain.connect(context.destination);
  gain.gain.setValueAtTime(0,start);
  const fadeAt=end-.85;
  if(start>=fadeAt){
   // Recovery inside the ending keeps its global fade level and deadline.
   const attackEnd=Math.min(end,start+Math.min(.015,(end-start)*.2));
   gain.gain.linearRampToValueAtTime(level*Math.max(0,(end-attackEnd)/.85),attackEnd);
  }else{
   gain.gain.linearRampToValueAtTime(level,Math.min(fadeAt,Math.max(start+.015,voice.anchor+state.buffer.duration)));
   gain.gain.setValueAtTime(level,fadeAt);
  }
  gain.gain.linearRampToValueAtTime(0,end);
  voice.layers.push({source,gain});voice.outro=true;
  source.onended=()=>{
   source.disconnect();gain.disconnect();
   // Render completion can precede speaker output by the device latency.
   // Keep the anchor available until the final audible frame has completed.
   if(state.voice===voice)voice.outroEnded=true;
  };
  source.start(start,offset);source.stop(end);
 }
 return {
  load(context){
   if(!context)return Promise.resolve(false);
   if(contexts.has(context))return contexts.get(context).ready;
   const state={buffer:null,riff:null,voice:null,sequence:'',ready:null};contexts.set(context,state);
   // Audio time freezes while the server's deployment continues. A suspended
   // voice must not resume at its old offset, even if animation frames pause.
   context.addEventListener?.('statechange',()=>{if(context.state!=='running')cancelVoice(context);});
   state.ready=encoded.then(async bytes=>{try{
    if(bytes)state.buffer=await context.decodeAudioData(bytes.slice(0));
    const buffer=state.buffer;
    if(buffer?.getChannelData&&context.createBuffer&&buffer.duration>DEPLOYMENT_RIFF.end){
     const a=Math.round(DEPLOYMENT_RIFF.start*buffer.sampleRate),b=Math.round(DEPLOYMENT_RIFF.end*buffer.sampleRate),fade=Math.round(.02*buffer.sampleRate);
     state.riff=context.createBuffer(buffer.numberOfChannels,b-a,buffer.sampleRate);
     for(let channel=0;channel<buffer.numberOfChannels;channel++){
      const input=buffer.getChannelData(channel),output=state.riff.getChannelData(channel);output.set(input.subarray(a,b));
      // Blend into the samples immediately before the loop start. Keep all
      // 235200 samples, so smoothing cannot shorten the measured beat period.
      for(let i=0;i<fade;i++){const blend=(1-Math.cos(i/(fade-1)*Math.PI))*.5;output[output.length-fade+i]=output[output.length-fade+i]*(1-blend)+input[a-fade+i]*blend;}
     }
    }
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
    if(state.voice.outroEnded&&current>=DEPLOYMENT_MUSIC_END){state.voice=null;state.finished=true;return current;}
    scheduleOutro(context,state,state.voice,current);return current;
   }
   if(state.finished)return null;
   if(musicTime>=DEPLOYMENT_MUSIC_END){state.finished=true;return null;}
   const now=context.currentTime,anchor=now-musicTime,layers=[],voice={layers,anchor};
   state.voice=voice;
   // Play the entire supplied opening and verse, keeping the spoken edit.
   if(musicTime<state.buffer.duration){
    const source=context.createBufferSource(),gain=context.createGain(),start=Math.max(now,anchor),offset=Math.max(0,musicTime),level=.65;
    source.buffer=state.buffer;source.connect(gain);gain.connect(context.destination);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+Math.max(.02,.65-offset));
    const tail=anchor+state.buffer.duration;
    gain.gain.setValueAtTime(level,Math.max(start+.02,tail-DEPLOYMENT_RIFF.crossfade));
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
   // Lazily schedule the instrumental near the end of the supplied verse; earlier calls
   // retain a single voice and cannot flood nodes with speculative loops.
   scheduleOutro(context,state,voice,musicTime);
   return musicClock(context,voice);
  },
  stop,
  reset(context){stop(context);const state=context&&contexts.get(context);if(state){state.sequence='';state.finished=false;}}
 };
}
