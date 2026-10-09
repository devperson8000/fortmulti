"""Extract one-shot samples from the user's battle clip; never ship the whole video."""
import argparse, hashlib, json, pathlib, subprocess, tempfile, wave
import numpy as np
parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('--out',default='public/audio');args=parser.parse_args();out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
# Measured attack windows: stop the rapid-fire crops before the next attack.
clips=[('sentinel-shot',4.415,.100,.035),('viper-shot',8.035,.100,.035),('longbow-shot',1.350,.620,.200)]
metadata=[]
with tempfile.TemporaryDirectory() as tmp:
 for name,start,duration,fade in clips:
  intermediate=pathlib.Path(tmp)/(name+'.wav');subprocess.run(['ffmpeg','-v','error','-ss',str(start),'-i',args.source,'-t',str(duration),'-vn','-ac','1','-ar','48000','-af','highpass=f=100,lowpass=f=8500','-y',str(intermediate)],check=True)
  with wave.open(str(intermediate)) as w:a=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float64)/32768
  a-=a.mean();a*=.72/max(np.max(np.abs(a)),1e-9);attack=min(len(a),96);a[:attack]*=np.linspace(0,1,attack);tail=min(len(a),round(fade*48000));a[-tail:]*=np.linspace(1,0,tail)**2
  pcm=np.rint(a*32767).astype('<i2')
  with wave.open(str(out/(name+'.wav')),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);w.writeframes(pcm.tobytes())
  metadata.append(dict(file=name+'.wav',sourceStart=start,sourceSeconds=duration,fadeSeconds=fade,outputSeconds=len(a)/48000,peak=float(np.max(np.abs(a)))))
pathlib.Path('docs/weapons/battle-audio-extraction.json').write_text(json.dumps({'source':'User-uploaded download (2).mp4','sha256':hashlib.sha256(pathlib.Path(args.source).read_bytes()).hexdigest(),'samples':metadata},indent=2)+'\n')
