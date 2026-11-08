import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const profile=JSON.parse(read('data/profile.json'));
const manifests=JSON.parse(read('plan-manifest.json'));
const monthFiles=fs.readdirSync(path.join(root,'data')).filter(f=>/^\d{4}-\d{2}\.json$/.test(f));
const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
let checked=0;const ids=new Set();
for(const file of monthFiles){
 const m=JSON.parse(read('data/'+file));
 for(const e of m.events){assert(!ids.has(e.id),'Duplicate event '+e.id);ids.add(e.id);assert(minutes(e.start)<minutes(e.end),'Invalid duration '+e.title);assert(e.start>='07:00'&&e.end<='23:00','Sleep boundary '+e.date+' '+e.title);assert(m.days[e.date],'No day plan '+e.date);}
 for(const date of Object.keys(m.days)){
  const es=m.events.filter(e=>e.date===date).sort((a,b)=>a.start.localeCompare(b.start));
  for(let i=1;i<es.length;i++)assert(es[i-1].end<=es[i].start,`Overlap ${date}: ${es[i-1].title} / ${es[i].title}`);
  const day=new Date(date+'T12:00:00Z').getUTCDay();
  if(day===5)assert(es.filter(e=>e.end>'18:00').every(e=>e.category==='rest'),`Friday evening is not protected ${date}`);
  if(m.holidays.some(h=>h.date===date&&h.noClasses))assert(!es.some(e=>e.category==='fixed'&&/ENGL|Noble Lab/.test(e.title)),`Holiday class ${date}`);
  assert(m.days[date].priorities.length>0,'Missing priorities '+date);
  const nonWork=['rest','break','commute','buffer'];
  const workload=es.filter(e=>!nonWork.includes(e.category)).reduce((n,e)=>n+minutes(e.end)-minutes(e.start),0);
  assert(workload<=profile.workCadence.dailyWorkLimitMinutes,`Work budget exceeded ${date}: ${workload/60}`);
  if(m.cadence&&date>=m.cadence.effectiveFrom.date){
   let streak=0;
   for(let i=0;i<es.length;i++){
    const e=es[i],length=minutes(e.end)-minutes(e.start);
    if(i)assert.equal(es[i-1].end,e.start,'Unexplained gap '+date+' '+e.start);
    if(e.category==='break')assert.equal(length,10,'Break must be 10 minutes '+e.id);
    if(e.category==='fixed'||nonWork.includes(e.category))streak=0;
    else {streak+=length;assert(streak<=60,'More than 60 continuous self-directed work minutes '+date+' '+e.title);}
    if(e.category==='rest'&&!(day===5&&e.start>='18:00'))assert(/起床与早餐|午饭|晚饭|洗漱与睡前准备/.test(e.title),'Unexpected long rest '+date+' '+e.title);
    if(day!==5&&e.category==='rest')assert(length<=30,'Extra rest beyond meals/bedtime '+date);
   }
   assert.equal(es.at(-1).end,'23:00','Missing bedtime '+date);
   assert.equal(m.days[date].planBudget.workMinutes,workload,'Displayed work budget mismatch '+date);
  }
  checked++;
 }
}
for(const item of [...manifests.dayPlans,...manifests.weekPlans,...manifests.monthPlans]){
 assert(fs.existsSync(path.join(root,item.url)),`Missing HTML ${item.url}`);
 const html=read(item.url);const prefix=html.match(/data-prefix="([^"]+)"/)[1];
 assert(!/<script[^>]+src=/.test(html),'HTML should work standalone: '+item.url);
 assert(html.includes('window.PLANNER_DATA = '),'Missing embedded data '+item.url);
 assert(html.includes('rel="canonical" href="https://divinyan.com/planner/'+item.url+'"'),'Missing homepage URL '+item.url);
 assert(html.includes('href="https://divinyan.com/">个人主页'),'Missing homepage entry '+item.url);
 assert(read('README.md').includes('](https://divinyan.com/planner/'+item.url+')'),'Missing direct README URL '+item.url);
 assert(html.includes('function dayView()')&&html.includes('function weekView()')&&html.includes('function monthView()'),'Missing views '+item.url);
 for(const asset of ['assets/style.css','assets/app.js','assets/plan-data.js'])assert(fs.existsSync(path.resolve(root,path.dirname(item.url),prefix,asset)),`Missing asset ${item.url}: ${asset}`);
}
new vm.Script(read('src/app.js'));new vm.Script(read('assets/plan-data.js'));
assert(read('src/style.css').includes('color-scheme:light;'),'Light palette is not fixed');
assert(!read('src/style.css').includes('prefers-color-scheme:dark'),'Unexpected dark theme');
for(const match of read('README.md').matchAll(/\]\(([^)]+\.html)\)/g)){
 const local=match[1].startsWith('https://divinyan.com/planner/')?match[1].slice('https://divinyan.com/planner/'.length):!/^https?:/.test(match[1])?match[1]:null;
 if(local)assert(fs.existsSync(path.join(root,local)),`Broken README link ${match[1]}`);
}
assert.equal(profile.sleep.start,'23:00');assert.equal(profile.sleep.end,'07:00');
assert.equal(profile.workCadence.workMinutes,60);assert.equal(profile.workCadence.breakMinutes,10);
console.log(`Checked ${checked} day plans, ${ids.size} events, 60/10 cadence, no extra long rest, no overlaps, sleep and Friday rest, holidays, workload, HTML assets and README links.`);
// Check the actual schedule promises, rather than merely checking generated markup.
for(const file of monthFiles){
 const m=JSON.parse(read('data/'+file));
 for(const [date,day] of Object.entries(m.days)){
  if(date<(profile.planning?.effectiveFrom||'9999'))continue;
  const es=m.events.filter(e=>e.date===date),work=e=>!['rest','break','commute','buffer'].includes(e.category),length=e=>minutes(e.end)-minutes(e.start);
  const speaking=es.reduce((n,e)=>n+(e.activeSpeakingMinutes||0),0);
  assert(speaking>=75&&speaking<=90,'Spoken English allocation '+date);
  assert.equal(speaking,day.planBudget.activeSpeakingMinutes,'Displayed speaking budget '+date);
  assert(es.every(e=>!e.activeSpeakingMinutes||(e.project==='english'&&e.category==='english'&&e.activeSpeakingMinutes<=length(e))),'Do not count classes as spoken practice '+date);
  assert.equal(es.filter(e=>work(e)&&e.commitment!=='continuation').reduce((n,e)=>n+length(e),0),day.planBudget.coreMinutes,'Core budget '+date);
  assert.equal(es.filter(e=>e.commitment==='continuation').reduce((n,e)=>n+length(e),0),day.planBudget.continuationMinutes,'Continuation budget '+date);
  const research=es.filter(e=>['research','moe'].includes(e.category)),projects=new Set(research.map(e=>e.project)),dow=new Date(date+'T12:00:00Z').getUTCDay();
  assert(projects.size<=(dow===1?3:2),'Too many research contexts '+date);
  assert(research.every(e=>length(e)>=30&&e.minimumOutcome&&e.estimate?.activeMinutes===length(e)),'Fragmented or unscoped research '+date);
  const morning=research.filter(e=>e.end<='12:00');assert(new Set(morning.map(e=>e.project)).size<=1,'Morning focus switching '+date);
  assert(day.priorities.length<=3,'Too many promised outcomes '+date);
 }
 for(const [start,w] of Object.entries(m.weekly)){
  const end=new Date(start+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+7);
  const oral=m.events.filter(e=>e.date>=start&&e.date<end.toISOString().slice(0,10)).reduce((n,e)=>n+(e.activeSpeakingMinutes||0),0);
  assert.equal(oral,w.activeSpeakingMinutes,'Weekly oral total '+start);
 }
}
const progress=JSON.parse(read('data/progress.json'));
for(const id of Object.keys(progress.events))assert(ids.has(id),'Lost actual progress event '+id);
assert(read('method.html').includes('https://divinyan.com/planner/method.html'),'Method canonical URL');
console.log('Checked protected spoken English, scoped research blocks, focus continuity, core/continuation budgets and preserved progress IDs.');
