import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const label='com.divinyan.planner.local';
const domain='gui/'+process.getuid(),target=domain+'/'+label;
const plist=path.join(os.homedir(),'Library','LaunchAgents',label+'.plist');
const serviceState=path.join(os.homedir(),'Library','Application Support','DivinYanPlanner');
const log=path.join(serviceState,'local-server.log');
const errorLog=path.join(serviceState,'local-server-error.log');
const ownedConfig=()=>{
 const config=fs.readFileSync(plist,'utf8'),runtime=path.join(serviceState,'run.mjs');
 return config.includes(root)||(config.includes(runtime)&&fs.existsSync(runtime)&&fs.readFileSync(runtime,'utf8').includes('const root='+JSON.stringify(root)));
};
const run=(command,args)=>spawnSync(command,args,{encoding:'utf8',timeout:15000});
const job=()=>{
 const result=run('/bin/launchctl',['print',target]);
 return {loaded:result.status===0,pid:Number(result.stdout?.match(/\bpid = (\d+)/)?.[1])||null,state:result.stdout?.match(/\bstate = ([^\n]+)/)?.[1]||null};
};
const healthy=async()=>{try{const response=await fetch('http://127.0.0.1:4173/api/state',{signal:AbortSignal.timeout(1000)});const value=await response.json();return response.ok&&value.persistence==='files';}catch{return false;}};
const action=process.argv[2]||'status';
if(process.platform!=='darwin')throw Error('This service manager is for macOS.');
if(action==='status')console.log(JSON.stringify({...job(),healthy:await healthy(),installed:fs.existsSync(plist),url:'http://127.0.0.1:4173'}));
else if(action==='uninstall'){
 if(fs.existsSync(plist)){
  if(!ownedConfig())throw Error('Service belongs to another checkout; kept its configuration.');
  run('/bin/launchctl',['bootout',target]);
  fs.unlinkSync(plist);
 }
 console.log(JSON.stringify({status:'uninstalled',recordsPreserved:true}));
}else if(action==='install'){
 if(fs.existsSync(plist)&&!ownedConfig())throw Error('Service belongs to another checkout; kept its configuration.');
 const state=await fetch('http://127.0.0.1:4173/api/state',{signal:AbortSignal.timeout(1000)}).then(r=>r.json()).catch(()=>null);
 if(state?.sync?.status==='running')throw Error('GitHub synchronization is running. Wait for it to finish before restarting the service.');
 const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const candidate=run('/usr/bin/which',['node']).stdout?.trim();
 const node=candidate?.startsWith('/')&&fs.existsSync(candidate)?candidate:process.execPath;
 const body=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(path.join(serviceState,'run.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(serviceState)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>5</integer>
<key>ProcessType</key><string>Background</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(path.dirname(node))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string><key>PLANNER_PORT</key><string>4173</string><key>PLANNER_SOURCE_ROOT</key><string>${xml(root)}</string></dict>
<key>StandardOutPath</key><string>${xml(log)}</string>
<key>StandardErrorPath</key><string>${xml(errorLog)}</string>
</dict></plist>\n`;
 fs.mkdirSync(path.dirname(plist),{recursive:true});fs.mkdirSync(path.dirname(log),{recursive:true});
 // Runtime code is derived from this checkout; all plans and feedback remain in root.
 for(const name of ['serve.mjs','local-store.mjs'])fs.copyFileSync(path.join(root,'scripts',name),path.join(serviceState,name));
 fs.writeFileSync(path.join(serviceState,'run.mjs'),`import fs from 'node:fs/promises';\nimport {createPlannerServer} from './serve.mjs';\nconst root=${JSON.stringify(root)};\nconsole.log('Starting local planner runtime');\nawait fs.access(root+'/data/progress.json');\nconst server=createPlannerServer({root});\nserver.listen(4173,'127.0.0.1',()=>console.log('Local planner ready on 127.0.0.1:4173'));\n`);
 run('/bin/launchctl',['bootout',target]);
 const listeners=run('/usr/sbin/lsof',['-t','-iTCP:4173','-sTCP:LISTEN']).stdout?.trim().split(/\s+/).filter(Boolean)||[];
 for(const item of listeners){
  const pid=Number(item),command=run('/bin/ps',['-p',item,'-o','command=']).stdout||'';
  if(!command.includes(path.join(root,'scripts','serve.mjs'))&&!command.includes(path.join(serviceState,'run.mjs')))throw Error('Another process owns port 4173; left it running.');
  try{process.kill(pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
 }
 fs.writeFileSync(plist,body,{mode:0o644});
 const valid=run('/usr/bin/plutil',['-lint',plist]);
 if(valid.status!==0)throw Error(valid.stderr||valid.stdout||'Invalid service configuration.');
 const loaded=run('/bin/launchctl',['bootstrap',domain,plist]);
 let ready=false;
 if(loaded.status===0)for(let attempt=0;attempt<40;attempt++){
  if(await healthy()){ready=true;break;}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!ready){
  const diagnostic=run('/bin/launchctl',['print',target]).stdout?.split('\n').filter(line=>/state =|last exit|runs =|spawn|reason/i.test(line)).join('\n');
  run('/bin/launchctl',['bootout',target]);
  fs.unlinkSync(plist);
  const fallback=run(process.execPath,[path.join(root,'scripts','start-local.mjs')]);
  console.error('Managed service did not start; background fallback: '+(fallback.status===0?'restored':'failed')+'. '+(loaded.stderr||diagnostic||'Inspect '+errorLog));
  process.exitCode=1;
 }else console.log(JSON.stringify({status:'installed',...job(),healthy:true,autoStartAtLogin:true,restartOnExit:true,plist,url:'http://127.0.0.1:4173'}));
}else throw Error('Use install, status or uninstall.');
