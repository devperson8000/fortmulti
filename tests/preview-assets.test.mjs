import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('preview serves lobby SVG artwork and game assets with browser-compatible content types', {timeout:10000}, async () => {
  const reservation=createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port=reservation.address().port; await new Promise(resolve=>reservation.close(resolve));
  const child=spawn(process.execPath,['serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  const exited=once(child,'exit');
  try {
    await Promise.race([once(child.stdout,'data'),exited.then(()=>{throw new Error('Preview exited before startup');})]);
    for(const [asset,expected] of [['horizon-field-crest.svg','image/svg+xml'],['lobby-contours.svg','image/svg+xml'],['hcs-logo.png','image/png'],['engine.js','text/javascript'],['audio/ar-shot.wav','audio/wav'],['maps/platform23/geometry.bin.gz','application/gzip']]) {
      const response=await fetch(`http://127.0.0.1:${port}/${asset}`);
      assert.equal(response.status,200,asset); assert.equal(response.headers.get('content-type'),expected,asset); await response.arrayBuffer();
    }
  } finally {child.kill(); await exited;}
});
