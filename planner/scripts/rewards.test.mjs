import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../src/rewards.js',import.meta.url),'utf8'),context);
const rewards=context.window.PLANNER_REWARDS;
const events=[{id:'a',start:'08:00',end:'09:00',category:'research',project:'gauge'},{id:'b',start:'09:10',end:'09:40',category:'english',project:'english'},{id:'rest',start:'09:00',end:'09:10',category:'break'}];
test('XP is derived from completed work, and undo/recheck cannot accumulate points',()=>{
 const state={a:{done:true},rest:{done:true}};assert.equal(rewards.measure(events,state).xp,60);assert.equal(rewards.measure(events,state).count,1);
 state.a.done=false;assert.equal(rewards.measure(events,state).xp,0);state.a.done=true;assert.equal(rewards.measure(events,state).xp,60);
 state.b=true;const full=rewards.measure(events,state);assert.equal(full.xp,90);assert.equal(full.percent,100);assert(full.badges.every(b=>b.unlocked));
});
test('empty and restored progress never invent achievements or XP',()=>{
 const empty=rewards.measure([],{});assert.equal(empty.xp,0);assert.equal(empty.percent,0);assert.equal(empty.level,1);assert(empty.badges.every(b=>!b.unlocked));
 const restored=rewards.measure(events,JSON.parse(JSON.stringify({a:{done:true},unknown:{done:true}})));assert.equal(restored.xp,60);assert.equal(restored.next.id,'b');
});
test('encouragement matches the project and only celebrates the whole day when all work is marked',()=>{
 const partial=rewards.measure(events,{a:true});assert.match(rewards.encourage(events[0],partial).message,/GAUGE|证据/);
 const full=rewards.measure(events,{a:true,b:true});assert.equal(rewards.encourage(events[1],full).title,'今天的计划收齐了 ✨');
});
test('class attendance and written English tasks do not invent spoken practice',()=>{
 const partial=rewards.measure(events,{a:true});
 assert.match(rewards.encourage({id:'class',project:'english',category:'fixed',title:'ENGL 105 B'},partial).message,/课程和会议/);
 assert.doesNotMatch(rewards.encourage({id:'homework',project:'english',category:'english',title:'英语课程作业'},partial).message,/又开口/);
});
