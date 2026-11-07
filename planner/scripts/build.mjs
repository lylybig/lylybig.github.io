import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const profile=JSON.parse(read('data/profile.json'));
const progress=JSON.parse(read('data/progress.json'));
const monthFiles=fs.readdirSync(path.join(root,'data')).filter(f=>/^\d{4}-\d{2}\.json$/.test(f)).sort();
const months=Object.fromEntries(monthFiles.map(f=>[f.slice(0,7),JSON.parse(read('data/'+f))]));
const dates=Object.values(months).flatMap(m=>Object.keys(m.days)).sort();
const template=read('src/template.html');
const write=(p,body)=>{const target=path.join(root,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);};
write('assets/style.css',read('src/style.css'));
write('assets/app.js',read('src/app.js'));
const dataSource='window.PLANNER_DATA = '+JSON.stringify({profile,progress,months}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n';
write('assets/plan-data.js',dataSource);
const html=(view,date,prefix,title,url='')=>template.replaceAll('{{TITLE}}',title).replaceAll('{{VIEW}}',view).replaceAll('{{DATE}}',date).replaceAll('{{PREFIX}}',prefix).replaceAll('{{CANONICAL}}','https://divinyan.com/planner/'+url).replace('{{STYLE}}',()=>read('src/style.css').replace(/^@charset[^\n]*\n/,'' )).replace('{{DATA}}',()=>dataSource).replace('{{APP}}',()=>read('src/app.js').replace(/<\/script/gi,'<\\/script'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:profile.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const defaultDate=dates.includes(today)?today:dates.at(-1);
write('index.html',html('day',defaultDate,'./','日周月计划中心'));
for(const date of dates)write(`daily/${date}.html`,html('day',date,'../',date+' 日计划',`daily/${date}.html`));
const weeks=[...new Set(Object.values(months).flatMap(m=>Object.keys(m.weekly)))].sort();
for(const week of weeks){const first=dates.find(d=>d>=week)||dates.at(-1);write(`weekly/${week}.html`,html('week',first,'../',week+' 周计划',`weekly/${week}.html`));}
for(const m of Object.values(months))write(`monthly/${m.month}.html`,html('month',m.range.start,'../',m.month+' 月计划',`monthly/${m.month}.html`));
write('plan-manifest.json',JSON.stringify({schemaVersion:1,timezone:profile.timezone,defaultDate,dayPlans:dates.map(date=>({date,url:`daily/${date}.html`})),weekPlans:weeks.map(date=>({date,url:`weekly/${date}.html`})),monthPlans:Object.keys(months).map(month=>({month,url:`monthly/${month}.html`}))},null,2)+'\n');
console.log(`Built ${dates.length} daily, ${weeks.length} weekly and ${Object.keys(months).length} monthly HTML plans.`);
