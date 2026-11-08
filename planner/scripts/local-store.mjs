import fs from 'node:fs/promises';
import path from 'node:path';

const excluded=new Set(['rest','break','commute','buffer']);
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
export function createLocalStore(root,{onSync=()=>({status:'disabled'})}={}){
 let queue=Promise.resolve(),sequence=0;
 const read=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(path.join(root,file),'utf8'));}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return structuredClone(fallback);throw e;}};
 const write=async(file,value)=>{const target=path.join(root,file),temp=path.join(root,'work','.local-write-'+process.pid+'-'+(++sequence)+'.json');await fs.mkdir(path.dirname(target),{recursive:true});await fs.mkdir(path.dirname(temp),{recursive:true});await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await fs.rename(temp,target);};
 const serialize=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const plans=async()=>{const events=new Map(),dates=new Set();for(const name of await fs.readdir(path.join(root,'data'))){if(!/^\d{4}-\d{2}\.json$/.test(name))continue;const m=await read('data/'+name);for(const date of Object.keys(m.days))dates.add(date);for(const e of m.events)events.set(e.id,e);}return {events,dates};};
 const progress=()=>read('data/progress.json',{schemaVersion:1,updatedAt:null,events:{},journals:{},feedback:{}});
 async function savePatch(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw failure('无效的记录格式。');
  if(Object.keys(body).some(k=>!['events','journals'].includes(k)))throw failure('只接受任务状态和复盘内容。');
  const plan=await plans(),changes=[],journals=[];
  for(const [id,value] of Object.entries(body.events||{})){
   const event=plan.events.get(id),done=typeof value==='boolean'?value:value?.done;
   if(!event||excluded.has(event.category)||typeof done!=='boolean')throw failure('任务编号或完成状态无效。');
   changes.push([id,done,event.date]);
  }
  for(const [date,value] of Object.entries(body.journals||{})){
   if(!plan.dates.has(date)||!value||typeof value!=='object'||Array.isArray(value))throw failure('复盘日期无效。');
   const energy=String(value.energy??''),note=value.note??'';
   if(!['','1','2','3','4','5'].includes(energy)||typeof note!=='string'||note.length>20000)throw failure('精力或复盘内容格式无效。');
   journals.push([date,{energy,note}]);
  }
  const p=await progress(),now=new Date().toISOString();p.events||={};p.journals||={};p.feedback||={};
  for(const [id,done,date] of changes){p.events[id]={done,updatedAt:now};p.feedback[date]={status:'draft',updatedAt:now,needsPlanning:true,processedAt:null};}
  for(const [date,j] of journals){p.journals[date]={...j,updatedAt:now};p.feedback[date]={status:'draft',updatedAt:now,needsPlanning:true,processedAt:null};}
  if(changes.length||journals.length){p.updatedAt=now;await write('data/progress.json',p);}
  return {persistence:'files',savedAt:p.updatedAt,progress:p};
 }
 return {
  get:async()=>{await queue;return {persistence:'files',progress:await progress()};},
  patch:body=>serialize(()=>savePatch(body)),
  submit:body=>serialize(async()=>{
   const plan=await plans(),date=body?.date;if(!plan.dates.has(date))throw failure('复盘日期无效。');
   const p=await progress(),now=new Date().toISOString(),j=p.journals[date]||{};
   const previous=await read('data/reviews/'+date+'.json',null);
   if(previous)await write('data/reviews/history/'+date+'-r'+(previous.revision||1)+'.json',previous);
   const completed=[...plan.events.values()].filter(e=>e.date===date&&!excluded.has(e.category)&&(typeof p.events[e.id]==='boolean'?p.events[e.id]:p.events[e.id]?.done)).map(e=>({id:e.id,title:e.title,recordedAt:p.events[e.id]?.updatedAt||now}));
   const review={schemaVersion:1,date,revision:(previous?.revision||0)+1,reportedAt:now,source:'local-web',rawNote:j.note||'',completed,inProgress:null,blockers:null,energy:j.energy?Number(j.energy):null,sleep:null,nextActions:null,planAdjustments:[],status:'pending-review',needsPlanning:true,processedAt:null};
   await write('data/reviews/'+date+'.json',review);
   p.feedback||={};p.feedback[date]={status:'submitted',updatedAt:now,needsPlanning:true,processedAt:null};p.updatedAt=now;await write('data/progress.json',p);
   const sync=onSync();return {persistence:'files',savedAt:now,reviewPath:'data/reviews/'+date+'.json',review,progress:p,sync};
  })
 };
}
