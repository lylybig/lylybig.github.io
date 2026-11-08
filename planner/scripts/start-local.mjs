import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PLANNER_PORT||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local planner port.');
const url='http://127.0.0.1:'+port;
const log=path.join(root,'work','local-server.log');
async function healthy(){
 try{
  const response=await fetch(url+'/api/state',{signal:AbortSignal.timeout(1000)});
  return response.ok&&(await response.json()).persistence==='files';
 }catch{return false;}
}
function finish(status,pid){
 console.log(JSON.stringify({status,url,pid,log}));
 if(process.argv.includes('--open')){
  const browser=spawn('open',[url],{stdio:'ignore',detached:true});
  browser.on('error',error=>console.error('Open '+url+' in your browser: '+error.message));
  browser.unref();
 }
}
if(await healthy())finish('already-running');
else{
 fs.mkdirSync(path.dirname(log),{recursive:true});
 const fd=fs.openSync(log,'a');
 let child;
 try{child=spawn(process.execPath,[path.join(root,'scripts','serve.mjs')],{cwd:root,env:process.env,detached:true,stdio:['ignore',fd,fd]});}
 finally{fs.closeSync(fd);}
 let failure;
 child.on('error',error=>{failure=error.message;});
 child.on('exit',code=>{failure='Server exited with code '+code;});
 child.unref();
 let ready=false;
 for(let attempt=0;attempt<40;attempt++){
  if(await healthy()){ready=true;break;}
  if(failure)break;
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 if(!ready)throw Error((failure||'Local service did not become ready')+'. See '+log);
 fs.writeFileSync(path.join(root,'work','local-server.pid'),String(child.pid)+'\n');
 finish('started',child.pid);
}
