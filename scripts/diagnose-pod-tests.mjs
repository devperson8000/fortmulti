import {spawnSync} from 'node:child_process';
const patterns=[
 'press E reserves a pod',
 'hatches open, pods disappear',
 'exterior camera holds',
 'outro is an uninterrupted',
 'ship rendering uses the outside'
];
for(let i=0;i<patterns.length;i++){
 const p=spawnSync(process.execPath,['--test','--test-name-pattern',patterns[i],'tests/pod-boarding.test.mjs'],{encoding:'utf8'});
 if(p.status!==0){process.stderr.write(p.stdout||'');process.stderr.write(p.stderr||'');process.exit(51+i);}
}
const build=spawnSync('npm',['run','build'],{stdio:'inherit'});
process.exit(build.status||0);
