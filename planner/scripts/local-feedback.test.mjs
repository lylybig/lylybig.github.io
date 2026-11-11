import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createPlannerServer} from './serve.mjs';
import {createLocalStore} from './local-store.mjs';

async function fixture(t,syncRunner=async()=>'{"status":"published","commit":"isolated-test"}'){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'planner-feedback-test-'));
 await fs.mkdir(path.join(root,'data'));await fs.writeFile(path.join(root,'index.html'),'<h1>test fixture</h1>');
 await fs.writeFile(path.join(root,'data/2026-11.json'),JSON.stringify({days:{'2026-11-08':{},'2026-11-09':{}},events:[{id:'a',date:'2026-11-08',title:'Task A',category:'research'},{id:'b',date:'2026-11-08',title:'Task B',category:'english'},{id:'rest',date:'2026-11-08',title:'Rest',category:'rest'}]}));
 const server=createPlannerServer({root,syncRunner});server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});});
 const post=(route,body,extra={})=>fetch(base+'/api/'+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
 return {root,base,post};
}
test('completed tasks survive a fresh store and concurrent page edits merge',async t=>{
 const f=await fixture(t);
 const results=await Promise.all([f.post('progress',{events:{a:{done:true}}}),f.post('progress',{events:{b:{done:true}}})]);
 assert(results.every(r=>r.status===200));
 const fresh=await createLocalStore(f.root).get();assert.equal(fresh.progress.events.a.done,true);assert.equal(fresh.progress.events.b.done,true);
 await f.post('progress',{events:{a:{done:false}}});const disk=JSON.parse(await fs.readFile(path.join(f.root,'data/progress.json')));assert.equal(disk.events.a.done,false);assert.equal(disk.events.b.done,true);
});
test('Chinese journal is durable and submission produces an honest review and history',async t=>{
 let requested=0;const f=await fixture(t,async()=>{requested++;return '{"status":"published","commit":"isolated-test"}';});
 await f.post('progress',{events:{a:true},journals:{'2026-11-08':{energy:'3',note:'完成 Task A，Task B 仍在运行；不是已完成。'}}});
 const response=await f.post('review',{date:'2026-11-08'});assert.equal(response.status,200);const saved=await response.json();
 assert.deepEqual(saved.review.completed.map(e=>e.id),['a']);assert.equal(saved.review.inProgress,null);assert.equal(saved.review.blockers,null);assert.equal(saved.review.status,'pending-review');assert.equal(saved.review.energy,3);
 const disk=JSON.parse(await fs.readFile(path.join(f.root,'data/reviews/2026-11-08.json')));assert.equal(disk.rawNote,'完成 Task A，Task B 仍在运行；不是已完成。');
 await f.post('review',{date:'2026-11-08'});const history=JSON.parse(await fs.readFile(path.join(f.root,'data/reviews/history/2026-11-08-r1.json')));assert.equal(history.revision,1);assert(requested>=1);
});
test('invalid IDs, paths, cross-site requests and non-JSON writes cannot change records',async t=>{
 const f=await fixture(t);
 for(const body of [{events:{unknown:true}},{events:{rest:true}},{events:{a:'yes'}},{events:{a:true},journals:{'../../outside':{note:'bad'}}}])assert.equal((await f.post('progress',body)).status,400);
 assert.equal((await f.post('review',{date:'../../outside'})).status,400);
 assert.equal((await f.post('progress',{events:{a:true}},{Origin:'https://unrelated.example'})).status,403);
 assert.equal((await f.post('progress',{events:{a:true}},{'Content-Type':'text/plain'})).status,403);
 assert.equal((await fetch(f.base+'/.git/config')).status,403);
 await assert.rejects(fs.access(path.join(f.root,'data/progress.json')));
});
test('sync failure keeps local feedback and reports failure without claiming publication',async t=>{
 const f=await fixture(t,async()=>{throw Error('isolated sync failure');});
 await f.post('progress',{journals:{'2026-11-08':{note:'真实草稿',energy:''}}});
 assert.equal((await f.post('review',{date:'2026-11-08'})).status,200);
 await new Promise(resolve=>setTimeout(resolve,20));const state=await(await fetch(f.base+'/api/state')).json();assert.equal(state.sync.status,'failed');
 const disk=JSON.parse(await fs.readFile(path.join(f.root,'data/reviews/2026-11-08.json')));assert.equal(disk.rawNote,'真实草稿');
});
test('verified Git push and failed publication are reported separately and a retry can verify publication',async t=>{
 const sha='a'.repeat(40),pushed=JSON.stringify({status:'synchronized',local:sha,remote:sha});let attempts=0;
 const f=await fixture(t,async()=>{
  if(attempts++===0)throw Object.assign(Error('isolated Pages verification failure'),{syncOutput:pushed+'\n'+JSON.stringify({status:'publication-not-verified'})});
  return pushed+'\n'+JSON.stringify({status:'published',commit:sha});
 });
 await f.post('progress',{journals:{'2026-11-08':{note:'保留这份真实记录'}}});
 await f.post('sync',{});
 let state=await(await fetch(f.base+'/api/state')).json();
 assert.equal(state.sync.status,'publication-pending');assert.equal(state.sync.gitStatus,'synchronized');assert.equal(state.sync.publicationStatus,'pending');assert.equal(state.sync.commit,sha);
 assert(state.sync.message.includes('GitHub 仓库已更新'));assert(!state.sync.message.includes('核验通过'));
 await f.post('sync',{});state=await(await fetch(f.base+'/api/state')).json();
 assert.equal(state.sync.status,'succeeded');assert.equal(state.sync.publicationStatus,'published');assert.equal(state.progress.journals['2026-11-08'].note,'保留这份真实记录');
});
test('successful command without publication evidence cannot claim the webpage is updated',async t=>{
 const sha='b'.repeat(40),f=await fixture(t,async()=>JSON.stringify({status:'synchronized',local:sha,remote:sha,changedFiles:0}));
 await f.post('sync',{});const state=await(await fetch(f.base+'/api/state')).json();
 assert.equal(state.sync.status,'publication-pending');assert.equal(state.sync.publicationStatus,'pending');assert.equal(state.sync.commit,sha);
});
