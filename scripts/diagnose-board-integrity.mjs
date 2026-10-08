import {readFileSync} from 'node:fs';
const source=readFileSync('public/engine.js','utf8');
const snippets=[
'shipBoardingCamera(boardingPod',
'shipLaunchAt(sequenceElapsed)',
'Segmented deck provides actual launch holes',
'if(!boardingView&&(cinematic',
"body.classList.toggle('pod-exterior'"
];
for(let i=0;i<snippets.length;i++){if(!source.includes(snippets[i])){console.log('FAILED: '+snippets[i]);process.exit(61+i)}}
console.log('All boarding integration snippets present');
