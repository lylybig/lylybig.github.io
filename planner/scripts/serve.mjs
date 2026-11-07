import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const resolved=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!resolved.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
 if(p.split('/').some(x=>x.startsWith('.')&&x!=='')){res.writeHead(403);res.end('Forbidden');return;}
 try{const st=fs.statSync(resolved);if(!st.isFile())throw Error();res.setHeader('Content-Type',mime[path.extname(resolved)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(resolved));}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PLANNER_PORT||4173),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port));
