import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const planner=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env={...process.env,GIT_SSH_COMMAND:'ssh -o BatchMode=yes -o ConnectTimeout=20'};
function run(cmd,args,cwd=planner,quiet=false){return execFileSync(cmd,args,{cwd,env,encoding:'utf8',stdio:quiet?['ignore','pipe','pipe']:['ignore','pipe','inherit'],timeout:120000}).trim();}
const repository=run('git',['rev-parse','--show-toplevel']);
const git=(args,quiet=false)=>run('git',args,repository,quiet);
if(path.relative(repository,planner)!=='planner')throw Error('Run from the homepage repository planner/ directory.');
const expected='git@github.com:lylybig/lylybig.github.io.git';
const remote=git(['remote','get-url','origin']);
if(remote!==expected&&remote!=='https://github.com/lylybig/lylybig.github.io.git')throw Error('Origin does not match the authorized homepage repository.');
const branch=git(['symbolic-ref','--short','HEAD']);
if(branch!=='main')throw Error('Expected main; review branch before synchronization.');
const allowed=p=>/^planner\/(README\.md|AGENTS\.md|package\.json|\.gitignore|index\.html|plan-manifest\.json|automation-status\.json)$/.test(p)||/^planner\/(src|scripts|data|assets|daily|weekly|monthly)\//.test(p);
function changedFiles(){
 const raw=execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all'],{cwd:repository,env,encoding:'utf8'});
 const chunks=raw.split('\0').filter(Boolean),files=[];
 for(let i=0;i<chunks.length;i++){const status=chunks[i].slice(0,2),file=chunks[i].slice(3);files.push(file);if(/[RC]/.test(status))files.push(chunks[++i]);}
 return [...new Set(files)];
}
const plannerFiles=()=>changedFiles().filter(p=>p.startsWith('planner/'));
function checkScope(files){const unexpected=files.filter(p=>!allowed(p)||/(^|\/)(\.env|id_rsa|id_ed25519)(\.|$)|\.(pem|key)$/.test(p));if(unexpected.length)throw Error('Review unexpected plan files: '+unexpected.join(', '));}
checkScope(plannerFiles());
git(['fetch','origin']);
const [ahead,behind]=git(['rev-list','--left-right','--count','HEAD...origin/main']).split(/\s+/).map(Number);
if(behind){if(ahead||plannerFiles().length)throw Error('Remote changes require review; no overwrite performed.');git(['merge','--ff-only','origin/main']);}
if(!behind&&!ahead&&plannerFiles().length===0){const head=git(['rev-parse','HEAD']);console.log(JSON.stringify({status:'synchronized',changedFiles:0,branch,local:head,remote:head,website:'https://divinyan.com/planner/'}));process.exit(0);}
run(process.execPath,['scripts/build.mjs']);
run(process.execPath,['scripts/check.mjs']);
const files=plannerFiles();checkScope(files);
if(files.length){
 git(['add','--',...files]);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 git(['commit','--only','-m',process.argv[2]||'Update research plans '+date,'--',...files]);
}
const head=git(['rev-parse','HEAD']);
const prior=git(['ls-remote','origin','refs/heads/main']).split(/\s+/)[0];
if(prior!==head)git(['push','origin','main']);
const remoteHead=git(['ls-remote','origin','refs/heads/main']).split(/\s+/)[0];
if(remoteHead!==head)throw Error('Remote HEAD verification failed; local work is preserved.');
console.log(JSON.stringify({status:'synchronized',changedFiles:files.length,branch,local:head,remote:remoteHead,website:'https://divinyan.com/planner/',note:'Verify GitHub Pages publication separately.'}));
run(process.execPath,['scripts/verify-live.mjs','--wait']);
console.log(JSON.stringify({status:'published',website:'https://divinyan.com/planner/',commit:head}));
