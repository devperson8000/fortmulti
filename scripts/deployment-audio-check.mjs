import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL||'http://127.0.0.1:4174',output=(process.env.GAME_ARTIFACTS||'/workspace/fortmulti-artifacts/deployment-boarding')+'/audio';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage();await page.addInitScript(()=>localStorage.setItem('horizon-callsign',JSON.stringify({name:'Ranger'})));await page.goto(url);
 const results=[];
 for(const sampleRate of[44100,48000])for(const offset of[0,27.2,29.75,29.82,29.834]){
  const result=await page.evaluate(async({sampleRate,offset})=>{
   const [{createDeploymentAudio},{DEPLOYMENT_MUSIC_END:end,DEPLOYMENT_MUSIC_FADE:fade}]=await Promise.all([import('/deployment-audio.js'),import('/deployment-cinematic.js')]);
   const duration=end-offset,native=new OfflineAudioContext(2,Math.ceil((duration+.1)*sampleRate),sampleRate),sources=[],gains=[];let decoded;
   const context=new Proxy(native,{get(target,name){
    if(name==='state')return 'running';if(name==='currentTime')return 0;if(name==='getOutputTimestamp')return undefined;
    if(name==='decodeAudioData')return async bytes=>decoded=await target.decodeAudioData(bytes);
    if(name==='createBufferSource')return()=>{const source=target.createBufferSource(),row={};sources.push(row);const start=source.start.bind(source),stop=source.stop.bind(source);source.start=(...args)=>{Object.assign(row,{start:args,loop:source.loop,duration:source.buffer.duration});return start(...args);};source.stop=(...args)=>{row.stop=args;return stop(...args);};return source;};
    if(name==='createGain')return()=>{const gain=target.createGain(),events=[];gains.push(events);for(const method of['setValueAtTime','linearRampToValueAtTime','cancelScheduledValues']){const fn=gain.gain[method].bind(gain.gain);gain.gain[method]=(...args)=>{events.push({method,args});return fn(...args);};}return gain;};
    const value=Reflect.get(target,name,target);return typeof value==='function'?value.bind(target):value;
   }});
   const music=createDeploymentAudio();const loaded=await music.load(context);music.update(context,'native-offline',offset);
   const rendered=await native.startRendering();let peak=0,tailPeak=0,maxForwardDifference=0,lastPeak=0;
   for(let c=0;c<2;c++){
    const actual=rendered.getChannelData(c),original=decoded.getChannelData(c);
    for(let i=0;i<actual.length;i++){
     peak=Math.max(peak,Math.abs(actual[i]));if(i/sampleRate>=duration)tailPeak=Math.max(tailPeak,Math.abs(actual[i]));
     if(i/sampleRate>=duration-.001&&i/sampleRate<duration)lastPeak=Math.max(lastPeak,Math.abs(actual[i]));
     if(offset===0&&i/sampleRate>=.7&&i/sampleRate<end-fade-.01)maxForwardDifference=Math.max(maxForwardDifference,Math.abs(actual[i]-original[i]*.65));
    }
   }
   let pcm=null;
   if(sampleRate===44100&&offset===0){const data=new Float32Array(rendered.length*2);for(let i=0;i<rendered.length;i++)for(let c=0;c<2;c++)data[i*2+c]=rendered.getChannelData(c)[i];const bytes=new Uint8Array(data.buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));pcm=btoa(binary);}
   return {sampleRate,offset,loaded,decodedDuration:decoded.duration,end,fade,sources,gains,peak,tailPeak,lastPeak,maxForwardDifference,pcm};
  },{sampleRate,offset});
  if(result.pcm){const data=Buffer.from(result.pcm,'base64'),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(3,20);header.writeUInt16LE(2,22);header.writeUInt32LE(sampleRate,24);header.writeUInt32LE(sampleRate*8,28);header.writeUInt16LE(8,32);header.writeUInt16LE(32,34);header.write('data',36);header.writeUInt32LE(data.length,40);await writeFile(output+'/runtime-music.wav',Buffer.concat([header,data]));}
  delete result.pcm;results.push(result);
  assert.equal(result.loaded,true);assert.equal(result.decodedDuration,30);assert.equal(result.sources.length,1);assert.equal(result.sources[0].loop,false);assert.equal(result.sources[0].start[1],offset);assert.ok(Math.abs(result.sources[0].stop[0]-(result.end-offset))<1e-9);
  assert.equal(result.tailPeak,0,'native audio output is silent after the exact gameplay deadline');assert.ok(result.peak<1,'no digital clipping');
  if(offset===0)assert.ok(result.maxForwardDifference<1e-6,'walkout/salute samples are the original song played forward at normal gain');
  if(offset>result.end-result.fade)assert.ok(result.gains[0].every(e=>e.args[0]<=.65*(result.end-offset)/result.fade+1e-9),'late recovery preserves the final fade level');
 }
 await writeFile(output+'/native-audio-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.length,sampleRates:[44100,48000],largestForwardSampleDifference:Math.max(...results.map(r=>r.maxForwardDifference)),peak:Math.max(...results.map(r=>r.peak)),tailPeak:Math.max(...results.map(r=>r.tailPeak))},null,2));
}finally{await browser.close();}
