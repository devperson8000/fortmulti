import {mkdir,cp,writeFile,readFile,rm,access} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
for(const file of ['app.js','engine.js','network.js','network-tuning.js','simulation.js','connection-stability.js','multiplayer-runtime.js','index.html'])await access('dist/'+file);
const url=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
if(key.startsWith('sb_secret_'))throw Error('Use a public Supabase publishable key, never a secret key.');
if(key.startsWith('eyJ')){try{const role=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role;if(role==='service_role')throw Error('Use the public anon or publishable key, never the service-role key.');}catch(e){if(e.message.includes('service-role'))throw e;}}
if((url&&!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))||(!url&&key)||(url&&!key))throw Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set together, using a valid Supabase project URL.');
const configTemplate=await readFile('public/config.js','utf8'),placeholder="window.SUNNY_CONFIG={url:'',key:''};";
if(!configTemplate.includes(placeholder))throw Error('public/config.js is missing the build configuration placeholder.');
await writeFile('dist/config.js',configTemplate.replace(placeholder,'window.SUNNY_CONFIG='+JSON.stringify({url,key})+';'));
console.log('Static app built. '+(url&&key?'Online presence, invites and private parties configured.':'Online multiplayer awaits Supabase URL and public key; same-browser invite testing is available.'));
