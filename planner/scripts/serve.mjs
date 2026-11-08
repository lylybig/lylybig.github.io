import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createLocalStore} from './local-store.mjs';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.jpg':'image/jpeg','.png':'image/png'};
export function createPlannerServer({root=defaultRoot,syncRunner}={}){
 let syncing=false,rerun=false,sync={status:'idle',message:'尚未请求同步。'};
 function requestSync(){
  if(syncing){rerun=true;return {...sync};}
  syncing=true;sync={status:'running',startedAt:new Date().toISOString(),message:'记录已写入文件，正在提交、推送并核验网页。'};
  const job=Promise.resolve().then(()=>syncRunner?syncRunner():new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['scripts/sync.mjs','Save feedback from local planner'],{cwd:root,stdio:['ignore','pipe','pipe']});let output='';
   for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-16000);});
   child.once('error',reject);child.once('close',code=>code===0?resolve(output):reject(new Error('同步未完成；本地记录已保存，请查看服务日志。\n'+output)));
  }));
  Promise.resolve(job).then(output=>{sync={status:'succeeded',finishedAt:new Date().toISOString(),message:String(output).includes('"status":"published"')?'GitHub 已同步，网页内容已核验。':'GitHub 提交已核对一致；本次未重新发布网页。'};for(const line of String(output).split('\n')){try{const value=JSON.parse(line);if(value.commit||value.remote)sync.commit=value.commit||value.remote;}catch{}}},error=>{console.error(error.message);sync={status:'failed',finishedAt:new Date().toISOString(),message:'本地文件已保存；GitHub 或网页同步未完成，请点击重试同步。'};}).finally(()=>{syncing=false;if(rerun){rerun=false;requestSync();}});
  return {...sync};
 }
 const store=createLocalStore(root,{onSync:requestSync});
 const server=http.createServer(async(req,res)=>{
  const port=server.address()?.port,hosts=new Set(['127.0.0.1:'+port,'localhost:'+port]);
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  try{
   if(!hosts.has(req.headers.host)){json(403,{error:'仅允许本机访问。'});return;}
   const url=new URL(req.url,'http://'+req.headers.host),p=decodeURIComponent(url.pathname);
   if(p.startsWith('/api/')){
    const origin=req.headers.origin;
    if(origin&&!hosts.has(new URL(origin).host)){json(403,{error:'拒绝其他网站访问本地记录。'});return;}
    if(req.method==='GET'&&p==='/api/state'){json(200,{...await store.get(),sync});return;}
    if(req.method!=='POST'||!origin||origin!=='http://'+req.headers.host||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){json(403,{error:'保存需要来自本地网页的 JSON 请求。'});return;}
    const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>1000000)throw Object.assign(new Error('记录内容过大。'),{status:413});chunks.push(chunk);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('记录内容无法解析。'),{status:400});}
    if(p==='/api/progress'){const saved=await store.patch(body);if(syncing)rerun=true;json(200,saved);return;}
    if(p==='/api/review'){json(200,await store.submit(body));return;}
    if(p==='/api/sync'){json(202,{sync:requestSync()});return;}
    json(404,{error:'接口不存在。'});return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const resolved=path.resolve(root,'.'+(p==='/'?'/index.html':p));
   if(!resolved.startsWith(root+path.sep)||p.split('/').some(x=>x.startsWith('.')&&x!=='')){res.writeHead(403);res.end('Forbidden');return;}
   let real;try{real=await fs.realpath(resolved);}catch{res.writeHead(404);res.end('Not found');return;}
   if(!real.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
   const st=await fs.stat(real);if(!st.isFile()){res.writeHead(404);res.end('Not found');return;}
   res.writeHead(200,{'Content-Type':mime[path.extname(real)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await fs.readFile(real));
  }catch(error){json(error.status||500,{error:error.status?error.message:'本地保存失败，未确认写入；请重试。'});}
 });
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createPlannerServer();server.listen(Number(process.env.PLANNER_PORT||4173),'127.0.0.1',()=>console.log('Local feedback: http://127.0.0.1:'+server.address().port+' — records are saved to planner/data/'));
}
