import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('lobby header uses the transparent Horizon logo without blend-mode masking',async()=>{
 const [markup,styles]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/lobby.css',import.meta.url),'utf8')
 ]);
 assert.match(markup,/<img class="horizon-logo horizon-logo-lobby" src="horizon-logo-transparent\.webp" alt="Horizon">/);
 assert.match(styles,/\.horizon-logo-lobby\{[^}]*background:transparent[^}]*isolation:isolate/s);
 assert.doesNotMatch(styles,/\.horizon-logo-lobby\{[^}]*mix-blend-mode/s);
});
