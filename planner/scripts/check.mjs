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
  const workload=es.filter(e=>!['rest','commute','buffer'].includes(e.category)).reduce((n,e)=>n+minutes(e.end)-minutes(e.start),0);
  assert(workload<=9*60,`More than 9 planned work hours ${date}: ${workload/60}`);
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
console.log(`Checked ${checked} day plans, ${ids.size} events, no overlaps, sleep and Friday rest, holidays, workload, HTML assets and README links.`);
