import {mkdir,cp,writeFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
const url=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
if(key.startsWith('sb_secret_'))throw Error('Use a public Supabase publishable key, never a secret key.');
await writeFile('dist/config.js','window.SUNNY_CONFIG='+JSON.stringify({url,key})+';\n');
console.log('Static app built. '+(url&&key?'Online rooms configured.':'Online rooms await Supabase URL and public key; local testing is available.'));
