import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'plan-manifest.json'),'utf8'));
const files=['index.html','method.html',manifest.dayPlans[0].url,manifest.dayPlans[1]?.url||manifest.dayPlans[0].url,manifest.weekPlans.find(w=>w.date>=manifest.dayPlans[0].date)?.url||manifest.weekPlans[0].url,manifest.monthPlans[0].url,'assets/app.js'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const expected=files.map(file=>({file,sha:hash(fs.readFileSync(path.join(root,file)))}));
const attempts=process.argv.includes('--wait')?4:1;
let problems=[];
for(let attempt=1;attempt<=attempts;attempt++){
 const results=await Promise.all(expected.map(async({file,sha})=>{
  try{
   const response=await fetch('https://divinyan.com/planner/'+file+'?v='+sha.slice(0,12),{signal:AbortSignal.timeout(10000),cache:'no-store'});
   if(!response.ok)return file+': HTTP '+response.status;
   if(hash(Buffer.from(await response.arrayBuffer()))!==sha)return file+': online content differs';
   return null;
  }catch(error){return file+': '+error.message;}
 }));
 problems=results.filter(Boolean);
 if(!problems.length){console.log(JSON.stringify({status:'published',url:'https://divinyan.com/planner/',verifiedFiles:files}));process.exit(0);}
 if(attempt<attempts){console.log('Waiting for GitHub Pages publication ('+attempt+'/'+attempts+').');await new Promise(resolve=>setTimeout(resolve,25000));}
}
console.error(JSON.stringify({status:'publication-not-verified',url:'https://divinyan.com/planner/',problems,note:'GitHub push may have succeeded; check Pages deployment separately.'}));
process.exitCode=1;
