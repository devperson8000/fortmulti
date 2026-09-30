export const QUALITY_PRESETS=Object.freeze({
 low:Object.freeze({pixelRatio:1,effects:40,remoteDetail:.55,shadows:false,stormSegments:40}),
 medium:Object.freeze({pixelRatio:1.25,effects:80,remoteDetail:.78,shadows:true,stormSegments:64}),
 high:Object.freeze({pixelRatio:1.6,effects:144,remoteDetail:1,shadows:true,stormSegments:96})
});

const LEVELS=['low','medium','high'];
const validLevel=value=>LEVELS.includes(value)?value:'medium';

export function createAutoQuality(initial='medium'){
 return {level:validLevel(initial),samples:new Float32Array(60),sampleCount:0,sampleIndex:0,total:0,slowSince:null,fastSince:null,cooldownUntil:0};
}

export function sampleAutoQuality(state,frameMs,now=performance.now()){
 const sample=Math.max(1,Math.min(80,Number(frameMs)||16.7)),index=state.sampleIndex;
 if(state.sampleCount<state.samples.length){state.sampleCount++;state.total+=sample;}
 else{state.total+=sample-state.samples[index];}
 state.samples[index]=sample;state.sampleIndex=(index+1)%state.samples.length;
 if(state.sampleCount<12)return state;
 const average=state.total/state.sampleCount,time=Number(now)||0;
 if(average>21){state.fastSince=null;if(state.slowSince==null)state.slowSince=time;}
 else if(average<14){state.slowSince=null;if(state.fastSince==null)state.fastSince=time;}
 else{state.slowSince=null;state.fastSince=null;}
 if(time<state.cooldownUntil)return state;
 const position=LEVELS.indexOf(state.level);
 if(state.slowSince!=null&&time-state.slowSince>=4000&&position>0){state.level=LEVELS[position-1];state.slowSince=null;state.fastSince=null;state.cooldownUntil=time+6000;}
 else if(state.fastSince!=null&&time-state.fastSince>=15000&&position<LEVELS.length-1){state.level=LEVELS[position+1];state.slowSince=null;state.fastSince=null;state.cooldownUntil=time+6000;}
 return state;
}

export function qualityPreset(selection,autoState){
 return QUALITY_PRESETS[selection==='auto'?autoState.level:validLevel(selection)];
}
