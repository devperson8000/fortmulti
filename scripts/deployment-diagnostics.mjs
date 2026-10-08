// Preview-only test diagnostics; not part of the production branch.
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const build=spawnSync('npm',['run','build'],{encoding:'utf8',maxBuffer:10000000});
if(build.status!==0){process.stdout.write(build.stdout||'');process.stderr.write(build.stderr||'');process.exit(build.status||1);}
const test=spawnSync('npm',['test'],{encoding:'utf8',maxBuffer:30000000});
await writeFile('dist/pod-test-results.txt',[
 'test status: '+test.status,
 'stdout:',String(test.stdout||'').slice(-100000),
 'stderr:',String(test.stderr||'').slice(-30000)
].join('\n'));
console.log('Preview diagnostic published; test exit: '+test.status);
