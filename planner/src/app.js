(() => {
  'use strict';
  const data = window.PLANNER_DATA;
  const root = document.getElementById('app');
  const profile = data.profile;
  const prefix = root.dataset.prefix || './';
  const months = Object.values(data.months).sort((a, b) => a.month.localeCompare(b.month));
  const events = months.flatMap(m => m.events);
  const allDates = [...new Set(months.flatMap(m => Object.keys(m.days)))].sort();
  const minDate = allDates[0], maxDate = allDates.at(-1);
  const key = 'research-secretary-progress-v1';
  const localMode = location.protocol==='http:' && ['127.0.0.1','localhost'].includes(location.hostname);
  let serverReady=!localMode, queuedProgress=null, dirtyEvents={}, dirtyJournals={}, writing=null, submitting=false, syncPoll=null;
  let saveMessage=localMode?'正在连接本地文件保存服务…':'此页的草稿保存在浏览器；本地反馈页可直接写入计划文件。', syncInfo={status:'idle'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const duration = e => minute(e.end) - minute(e.start);
  const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const weekday = date => new Date(date + 'T12:00:00Z').getUTCDay();
  const monday = date => addDays(date, -((weekday(date) + 6) % 7));
  const localToday = () => new Intl.DateTimeFormat('en-CA', {timeZone: profile.timezone, year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  const clamp = date => date < minDate ? minDate : date > maxDate ? maxDate : date;
  const shortDate = date => `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日`;
  const fullDate = date => `${shortDate(date)} · 周${'日一二三四五六'[weekday(date)]}`;
  const listEvents = date => events.filter(e => e.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const monthFor = date => data.months[date.slice(0, 7)] || months[0];
  const isWork = e => !['rest', 'break', 'commute', 'buffer'].includes(e.category);
  const typeName = {research:'科研', moe:'MoE 项目', fixed:'课程与会议', english:'英语', rest:'用餐与休息', break:'10 分钟小休', deadline:'关键节点', admin:'行政与复盘', commute:'通勤', buffer:'缓冲'};
  const hours = count => (count / 60).toFixed(1).replace(/\.0$/, '');
  let progress = structuredClone(data.progress);
  if(!localMode)try { const saved = JSON.parse(localStorage.getItem(key)); if (saved?.schemaVersion === 1 && (!progress.updatedAt || saved.updatedAt > progress.updatedAt)) progress = saved; } catch (_) {}
  progress.events ||= {}; progress.journals ||= {};
  let date = clamp(prefix === './' ? localToday() : (root.dataset.date || localToday()));
  let view = root.dataset.view || 'day';
  let selectedId = null;
  const done = id => typeof progress.events[id] === 'boolean' ? progress.events[id] : Boolean(progress.events[id]?.done);
  const rewards=window.PLANNER_REWARDS;
  let reaction=null,reactionSequence=0,rewardPopupTimer=null,motionEnabled=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const celebrated=new Set();
  try{const seen=JSON.parse(localStorage.getItem('research-secretary-celebrations-v1')||'[]');if(Array.isArray(seen))for(const id of seen)if(typeof id==='string')celebrated.add(id);const saved=localStorage.getItem('research-secretary-motion');if(saved!==null)motionEnabled=saved==='on';}catch{}
  function questTree(level){
    return `<svg class="quest-tree" viewBox="0 0 100 110" role="img" aria-label="进度小树，第 ${level} 阶段"><ellipse cx="50" cy="99" rx="33" ry="7" fill="#dfeade"/><path d="M50 94V41" fill="none" stroke="#639d80" stroke-width="5" stroke-linecap="round"/><path d="M50 75C18 78 17 48 18 48C39 45 51 58 50 75Z" fill="#8ec8a6"/><path d="M50 60C81 64 83 34 82 34C60 32 48 44 50 60Z" fill="#66aa89"/><g opacity="${level>=3?1:.2}"><path d="M50 44C28 47 27 23 28 23C44 23 52 32 50 44Z" fill="#a8d8b6"/></g><g opacity="${level>=5?1:.15}"><circle cx="52" cy="25" r="13" fill="#f8d8bb"/><circle cx="52" cy="25" r="5" fill="#e5af77"/></g><circle cx="73" cy="78" r="3" fill="#deccec"/><path d="m23 24 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="#c1aedb"/></svg>`;
  }
  function questPanel(){
    const state=rewards.measure(listEvents(date),progress.events),active=reaction?.date===date?reaction:null;
    const title=active?.title||(state.count?'今天的小进展，正在累积':'从一小步开始，今天也能推进');
    const message=active?.message||(state.count?`你已标记完成 ${state.count} 个工作块。按自己的真实进度继续，一项项收好。`:'先完成眼前这一块。一个结果、一条排除的假设、一段更清楚的表达，都值得记录。');
    return `<div class="quest-panel ${active?.celebrate?'is-celebrating':''}" data-motion="${motionEnabled?'on':'off'}" aria-label="科研小旅程"><div class="quest-top"><div><div class="quest-eyebrow">科研小旅程</div><h4>Lv.${state.level} · ${escape(state.levelName)}</h4><span class="quest-xp" aria-label="今日经验值">${state.xp} XP</span></div>${questTree(state.level)}</div><div class="quest-progress-head"><span>核心工作进度</span><strong>${state.percent}%</strong></div><div class="quest-track" role="progressbar" aria-label="核心工作块完成的计划时长比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${state.percent}"><span style="width:${state.percent}%"></span></div><div class="quest-coach" aria-live="off"><strong>${escape(title)}</strong><p>${escape(message)}</p><small id="quest-save-status">${escape(active?.saveStatus||(state.count?'进度按当前完成标记显示':'等待你的第一小关'))}</small>${active?.celebrate?`<div class="quest-sparkles" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>`:''}</div><div class="quest-badges">${state.badges.map(b=>`<span class="quest-badge ${b.unlocked?'unlocked':''}" aria-label="${b.name}：${b.unlocked?'已点亮':'尚未点亮'}"><span aria-hidden="true">${b.icon}</span>${b.name}</span>`).join('')}</div><div class="quest-actions"><button class="btn" data-action="quest-next" ${state.next?'':'disabled'}>${state.next?'定位下一工作块':'今日工作块已收齐'}</button><button class="quest-motion" data-action="quest-motion" aria-pressed="${motionEnabled}">动效${motionEnabled?'开启':'关闭'}</button></div><details class="quest-rules"><summary>XP 怎么计算？</summary><p>按已勾选工作块的计划分钟计算，取消勾选会回退，反复勾选不会叠加。XP 是进度反馈，不代表科研质量。核心完成率只统计核心工作块；同题延续完成仍计 XP，但未完成不降低核心进度。休息、吃饭和通勤不计分；没有连续打卡惩罚。</p></details></div>`;
  }
  function updateQuestSave(){for(const id of ['quest-save-status','reward-popup-save']){const el=document.getElementById(id);if(el&&(id==='reward-popup-save'||reaction?.date===date))el.textContent=reaction.saveStatus;}}
  function showRewardPopup(event,checked,fresh,anchor){
    const popup=document.getElementById('reward-popup');if(!popup)return;
    const xp=minute(event.end)-minute(event.start),width=Math.min(330,window.innerWidth-24);
    popup.innerHTML=`<span class="reward-popup-mark" aria-hidden="true">${checked?'✦':'✓'}</span><div><strong>${escape(reaction.title)}</strong><p>${escape(reaction.message)}</p><small id="reward-popup-save">${escape(reaction.saveStatus)}</small></div>${checked&&fresh?`<span class="reward-popup-xp">+${xp} XP</span>`:''}`;
    popup.style.width=width+'px';popup.style.left=Math.max(12,Math.min(window.innerWidth-width-12,anchor?.left||window.innerWidth-width-24))+'px';
    popup.style.top=Math.max(12,Math.min(window.innerHeight-190,(anchor?.bottom||window.innerHeight-200)+10))+'px';
    popup.dataset.motion=motionEnabled?'on':'off';popup.hidden=false;clearTimeout(rewardPopupTimer);rewardPopupTimer=setTimeout(()=>{popup.hidden=true;},5200);
  }
  function completeTask(id,checked){
    const event=events.find(e=>e.id===id);if(!event||!isWork(event)||checked===done(id))return;
    if(localMode&&!serverReady){toast('请等待本地保存服务连接。');render();return;}
    const anchor=document.querySelector(`[data-complete="${CSS.escape(id)}"]`)?.getBoundingClientRect();
    const position=window.scrollY,sequence=++reactionSequence,wasCelebrated=celebrated.has(id);
    const before=rewards.measure(listEvents(event.date),progress.events);
    progress.events[id]={done:checked,updatedAt:new Date().toISOString()};
    const state=rewards.measure(listEvents(event.date),progress.events),words=checked?rewards.encourage(event,state):{title:'已按真实进度调整',message:'还没收尾也没关系，先把记录改准确，再继续推进。'};
    reaction={...words,id,date:event.date,celebrate:checked&&!wasCelebrated,saveStatus:localMode?'正在保存完成标记…':'正在保存浏览器草稿…'};
    if(checked&&wasCelebrated)reaction={...reaction,title:'完成标记已恢复',message:'这项进展重新显示在记录里，XP 按当前完成状态计算。'};
    const saving=persist();render();window.scrollTo(0,position);
    const fill=document.querySelector('.quest-track>span');if(fill&&event.date===date&&motionEnabled&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){fill.style.transition='none';fill.style.width=before.percent+'%';void fill.offsetWidth;fill.style.transition='';requestAnimationFrame(()=>{fill.style.width=state.percent+'%';});}
    const input=document.querySelector(`[data-complete="${CSS.escape(id)}"]`);if(input)input.focus({preventScroll:true});
    showRewardPopup(event,checked,!wasCelebrated,anchor);
    saving.then(()=>{if(reactionSequence!==sequence)return;reaction.saveStatus=localMode?'✓ 已写入本地文件':'✓ 已保存浏览器草稿';if(checked){celebrated.add(id);try{localStorage.setItem('research-secretary-celebrations-v1',JSON.stringify([...celebrated]));}catch{}}updateQuestSave();},()=>{if(reactionSequence!==sequence)return;reaction.saveStatus='完成标记尚未写入文件，请重试保存。';updateQuestSave();});
    setTimeout(()=>{if(reactionSequence!==sequence)return;reaction.celebrate=false;document.querySelector('.quest-panel')?.classList.remove('is-celebrating');document.querySelector('.quest-sparkles')?.remove();},2300);
  }
  function criteria(e) {
    if(e.doneCriteria && !/留下具体结果|记录完成结果|出席；会后记下一步/.test(e.doneCriteria)) return e.doneCriteria;
    if(/首轮回复/.test(e.title)) return '逐条覆盖核心质疑，核对每个数字与引用，经合作者审阅后发布；记录已保存版本与尚待跟进的问题。';
    if(/GAUGE/.test(e.title)) return '得到候选覆盖、受控消融或开销的可核验结果，或形成逐条对应 o5kg、nHpQ、Cbkq 的回应草稿；明确已有证据与缺口。';
    if(/ResNet/.test(e.title)) return '区分系数质量与重建保真，核对共同 readout 的真实效应；留下一份结论校准记录、分析结果或 reviewer 回应。';
    if(/Noisy Pairs/.test(e.title)) return '完成清楚的问题定义、直观例子或假设边界说明；对应具体 reviewer 问题并标明已证、未证和待核查部分。';
    if(/MoE|Kumar/.test(e.title)) return '每个涉及项目都写清结果、解释、阻塞、下一步；保存配置和结果位置，失败实验也记录判断依据。';
    if(/Bill|Noble|DIA/.test(e.title)) return '记录 DIA 是否到达、训练或流程验证结果、当前阻塞及下一步；准备需要 Bill 决策的问题。';
    if(e.category==='english') return '留下实际口语练习或作业进度；口语记录最影响理解的三个问题，作业以真实课程要求为准。';
    if(e.category==='admin') return '完成一个具体回复、注册步骤或进度记录；不能当场解决的事项写下负责窗口和下一次跟进时间。';
    if(e.category==='fixed') return '出席已确认安排，并记录需要跟进的下一步；实际变更以真实通知为准。';
    return e.doneCriteria || '记录真实结果和下一步。';
  }
  function persist() {
    progress.updatedAt = new Date().toISOString();
    try { localStorage.setItem(key, JSON.stringify(progress)); } catch (_) {}
    if(!localMode)return Promise.resolve();
    if(!serverReady){saveMessage='本地保存服务未连接，记录尚未写入文件。';refreshSaveStatus();return Promise.reject(new Error(saveMessage));}
    for(const [id,value] of Object.entries(progress.events))if(events.some(e=>e.id===id)&&JSON.stringify(value)!==JSON.stringify(queuedProgress.events?.[id]))dirtyEvents[id]=structuredClone(value);
    for(const [d,value] of Object.entries(progress.journals))if(allDates.includes(d)&&JSON.stringify(value)!==JSON.stringify(queuedProgress.journals?.[d]))dirtyJournals[d]=structuredClone(value);
    queuedProgress=structuredClone(progress);
    const result=flushFiles();result.catch(()=>{});return result;
  }
  async function api(route,body){
    const response=await fetch('/api/'+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
    const value=await response.json();if(!response.ok)throw Error(value.error||'保存失败。');return value;
  }
  function refreshSaveStatus(){
    const el=document.getElementById('file-save-state');if(el)el.textContent=saveMessage;
    const remote=document.getElementById('git-sync-state');if(remote)remote.textContent=localMode?((syncInfo.message||'点击“保存复盘并同步 GitHub”后提交、推送并核验网页。')+(syncInfo.commit?' 提交 '+syncInfo.commit.slice(0,7):'')):'';
    const retry=document.getElementById('retry-local-sync');if(retry){retry.hidden=!['failed','publication-pending'].includes(syncInfo.status);retry.textContent=syncInfo.status==='publication-pending'?'重试网页核验':'重试 GitHub 同步';}
    const count=document.getElementById('day-feedback-count');if(count){const work=listEvents(date).filter(isWork);count.textContent=feedbackLabel()+' · '+work.filter(e=>done(e.id)).length+'/'+work.length+' 工作块已勾选';}
  }
  function flushFiles(){
    if(writing)return writing;
    writing=(async()=>{
      while(Object.keys(dirtyEvents).length||Object.keys(dirtyJournals).length){
        const batch={events:dirtyEvents,journals:dirtyJournals};dirtyEvents={};dirtyJournals={};saveMessage='正在写入本地计划文件…';refreshSaveStatus();
        try{const saved=await api('progress',batch);progress.feedback=saved.progress.feedback;saveMessage='已写入本地计划文件 · '+new Date(saved.savedAt).toLocaleTimeString('zh-CN',{timeZone:profile.timezone});}
        catch(error){dirtyEvents={...batch.events,...dirtyEvents};dirtyJournals={...batch.journals,...dirtyJournals};saveMessage='未确认写入文件：'+error.message+' 请点击保存重试。';throw error;}
        finally{refreshSaveStatus();}
      }
    })().finally(()=>{writing=null;});
    return writing;
  }
  async function connectLocal(){
    try{const saved=await api('state');if(saved.persistence!=='files')throw Error('保存接口不可用');progress=saved.progress;progress.events||={};progress.journals||={};queuedProgress=structuredClone(progress);serverReady=true;saveMessage='已连接本地文件 · 勾选和输入会直接保存';syncInfo=saved.sync||{status:'idle'};render();if(syncInfo.status==='running')pollSync();}
    catch(error){saveMessage='本地保存服务未连接。请使用本项目的启动入口，当前不能确认写入文件。';render();}
  }
  function pollSync(){
    clearTimeout(syncPoll);syncPoll=setTimeout(async()=>{try{const state=await api('state');syncInfo=state.sync;refreshSaveStatus();if(syncInfo.status==='running')pollSync();}catch{syncInfo={status:'failed',message:'本地记录仍在；暂时无法查询 GitHub 同步状态。'};refreshSaveStatus();}},2000);
  }
  async function submitJournal(){
    if(!localMode){saveJournal();toast('草稿已保存在此浏览器。请打开本地反馈页写入计划文件。');return;}
    if(!serverReady||submitting){toast('请等待本地保存服务连接。');return;}
    submitting=true;const targetDate=date,button=document.querySelector('#journal-form button[type="submit"]');if(button)button.disabled=true;
    try{await saveJournal();await flushFiles();saveMessage='正在生成每日复盘记录并请求同步…';refreshSaveStatus();const saved=await api('review',{date:targetDate});progress.feedback=saved.progress.feedback;saveMessage='已提交复盘：'+saved.reviewPath+' · 待秘书读取并调整计划';syncInfo=saved.sync;refreshSaveStatus();toast('复盘已写入文件，正在同步 GitHub。');pollSync();}
    catch(error){saveMessage='保存未完成：'+error.message;refreshSaveStatus();toast(saveMessage);}
    finally{submitting=false;if(button)button.disabled=false;}
  }
  function feedbackLabel(){const item=progress.feedback?.[date];return item?(item.needsPlanning?(item.status==='submitted'?'已提交复盘 · 待秘书处理':'已写入本地进度'):'已处理'):(monthFor(date).days[date]?.feedback||'暂无反馈');}
  function feedbackStatus(){
    const href='http://127.0.0.1:4173/#view='+view+'&date='+date;
    return `<section class="notice feedback-status" aria-label="反馈保存状态"><strong>${localMode?'本地反馈 · 直接写入文件':'在线查看 · 本地反馈入口'}</strong><p id="file-save-state" role="status">${escape(saveMessage)}</p><button id="retry-local-sync" class="btn" data-action="retry-local-sync" ${['failed','publication-pending'].includes(syncInfo.status)?'':'hidden'}>${syncInfo.status==='publication-pending'?'重试网页核验':'重试 GitHub 同步'}</button><p id="git-sync-state" class="small">${localMode?escape(syncInfo.message||'点击保存复盘后同步 GitHub；保存记录不会自动唤醒秘书。'):''}</p>${localMode?'':`<a class="btn" href="${href}" style="margin-top:9px">在这台 Mac 打开本地反馈页 ↗</a>`}</section>`;
  }
  function readHash() { const q = new URLSearchParams(location.hash.slice(1)); const d = q.get('date'), v = q.get('view'); if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) date = clamp(d); if (['day','week','month'].includes(v)) view = v; }
  function navigate(v, d = date) { view = v; date = clamp(d); history.replaceState(null, '', `#view=${view}&date=${date}`); render(); window.scrollTo(0, 0); }
  function summary(es) {
    const research = es.filter(e => ['research','moe','deadline'].includes(e.category)).reduce((n,e) => n + duration(e), 0);
    const fixed = es.filter(e => e.category === 'fixed').reduce((n,e) => n + duration(e), 0);
    const english = es.filter(e => e.category === 'english').reduce((n,e) => n + duration(e), 0);
    const oral=es.reduce((n,e)=>n+(e.activeSpeakingMinutes||0),0),core=es.filter(e=>isWork(e)&&e.commitment!=='continuation').reduce((n,e)=>n+duration(e),0);
    const total = es.filter(isWork).reduce((n,e)=>n+duration(e),0), shortBreaks = es.filter(e=>e.category==='break').reduce((n,e)=>n+duration(e),0);
    return `<div class="summary-strip"><span><strong>${hours(total)}</strong>h 工作容量（含延续）</span><span><strong>${hours(core)}</strong>h 核心安排</span><span><strong>${hours(shortBreaks)}</strong>h 小休</span><span><strong>${hours(research)}</strong>h 科研与成果</span><span><strong>${hours(fixed)}</strong>h 课程与会议</span><span><strong>${oral}</strong>min 计划主动口语</span><span><strong>${hours(english)}</strong>h 英语自练/作业</span></div>`;
  }
  function legend() { return `<div class="legend">${[['research','科研'],['moe','MoE'],['fixed','固定安排'],['english','英语'],['break','10 分钟小休'],['rest','用餐 / 周五休息'],['deadline','关键节点']].map(([k,t])=>`<span><i class="${k}"></i>${t}</span>`).join('')}</div>`; }
  function fridayPolicyLabel() {
    const m=monthFor(date),start=monday(date),end=addDays(start,7);
    const exceptions=Object.entries(m.days).filter(([d,info])=>info.fridayRestOverride?.cancelled&&info.fridayRestOverride.appliesToDate===d&&info.fridayRestOverride.evidence==='user-confirmed'&&(view==='day'?d===date:view==='week'?d>=start&&d<end:true));
    return exceptions.length?'常规周五 18:00 后休息；'+exceptions.map(([d])=>shortDate(d)+' 仅当晚取消，22:30 收工').join('；'):'周五 18:00 后完整休息';
  }
  function shell(content) {
    const m = monthFor(date);
    const night=view==='day'?m.days[date]?.sleepOverride:null;
    const sleepLabel=night?`${night.start}–${profile.sleep.end}（仅当天）`:`常规 ${profile.sleep.start}–${profile.sleep.end}`;
    const titles = {day:fullDate(date), week:`${shortDate(monday(date))} — ${shortDate(addDays(monday(date),6))}`, month:`${date.slice(0,4)} 年 ${Number(date.slice(5,7))} 月`};
    const subtitles = {day:'把最重要的事做清楚，为意外和恢复留出空间。', week:'先看本周交付，再看每天把时间给了什么。', month:'用阶段目标组织忙碌，让科研、TA 资格与休息各有位置。'};
    root.innerHTML = `<div class="shell"><aside class="sidebar"><div><div class="brand"><span class="brand-mark">L</span><span>科研秘书</span></div><div class="side-label">YOUR PLANNING SPACE</div><nav class="side-nav" aria-label="计划视图">${[['day','日计划'],['week','周计划'],['month','月计划']].map(([k,t])=>`<button class="nav-item ${view===k?'active':''}" data-view="${k}">${t}</button>`).join('')}</nav><div class="side-label">当前主线</div><div class="side-project"><i class="dot deadline"></i>ICLR 三篇 rebuttal</div><div class="side-project"><i class="dot moe"></i>MoE-LLM / Agent-RL</div><div class="side-project"><i class="dot"></i>Noble / DIA</div><div class="side-project"><i class="dot english"></i>TA 英语资格</div></div><div class="side-bottom"><strong>认真推进，也好好休息</strong><p class="muted">常规 23:00–07:00 睡眠<br>${escape(fridayPolicyLabel())}</p><p style="margin-top:12px"><a href="${prefix}method.html">排程依据与英语路线 ↗</a></p><p style="margin-top:12px"><a href="https://divinyan.com/">个人主页 ↗</a></p><p style="margin-top:12px"><a href="https://github.com/lylybig/lylybig.github.io/blob/main/planner/README.md">README 与全部计划</a></p></div></aside><main class="main"><header class="hero"><div><div class="eyebrow">Liang's Research Secretary</div><h1>${titles[view]}</h1><p>${subtitles[view]}</p></div><span class="status-pill">${date<='2026-11-18'?'Rebuttal 冲刺期':'科研稳定推进期'}</span></header><div class="rules"><span>◷ 西雅图时间</span><span>☾ ${escape(sleepLabel)}</span><span>◌ 工作 60 分钟 / 休息 10 分钟</span><span>✧ ${escape(fridayPolicyLabel())}</span><span>计划更新 ${escape(m.updatedAt)}</span></div><div class="toolbar"><div class="segments" role="group" aria-label="切换计划">${[['day','日'],['week','周'],['month','月']].map(([k,t])=>`<button data-view="${k}" class="${view===k?'active':''}" aria-pressed="${view===k}">${t}</button>`).join('')}</div><div class="date-tools"><button class="btn icon" data-action="previous" aria-label="上一个日期范围">‹</button><button class="btn" data-action="today">今天</button><button class="btn icon" data-action="next" aria-label="下一个日期范围">›</button><input class="date-input" type="date" aria-label="选择计划日期" min="${minDate}" max="${maxDate}" value="${date}"></div></div>${cadencePanel()}${oneOffNotice()}${feedbackStatus()}${content}<footer class="footer"><span>计划 ≠ 已完成 · 实际进度以晚间汇报和复盘为准</span><div class="source-links"><a href="https://github.com/lylybig/lylybig.github.io/tree/main/planner" target="_blank" rel="noreferrer">GitHub 仓库 ↗</a><a href="${prefix}monthly/${m.month}.html">本月 HTML</a><button class="btn" data-action="export">导出复盘</button><button class="btn" data-action="import">导入复盘</button></div></footer><input id="progress-import" type="file" accept="application/json,.json" hidden></main></div><dialog id="event-dialog" aria-labelledby="dialog-heading"><div class="dialog-inner" id="dialog-inner"></div></dialog><div id="reward-popup" class="reward-popup" role="status" aria-live="polite" aria-atomic="true" hidden></div><div id="toast" class="toast" role="status" hidden></div>`;
  }
  function oneOffNotice(){
    const m=monthFor(date),start=monday(date),end=addDays(start,7);
    const items=Object.entries(m.days).filter(([d,info])=>info.oneOffNote&&(view==='day'?d===date:view==='week'?d>=start&&d<end:true));
    return items.map(([d,info])=>'<section class="notice"><strong>'+shortDate(d)+' · 用户确认的单次调整</strong><p>'+escape(info.oneOffNote)+'</p></section>').join('');
  }
  function cadencePanel() {
    return '<section class="notice cadence-notice"><strong>全月统一：自主工作 60 分钟，休息 10 分钟</strong><p>换任务不重置计时。常规工作窗口为 07:30–22:30；三餐各 30 分钟，随后留 30 分钟睡前准备。当天有临时调整时，以单次调整说明为准。常规周五 18:00 后完整下班，汇报提前到 17:10；用户确认的单次调整见下方说明。</p><p>固定课程、会议按真实时长；周末和学校假期同样执行 60/10。11-08 起同一科研问题连续推进 2–3 段，中间休息后继续；每天主动口语 75–90 分钟，听课和书面作业另计。</p></section>';
  }
  function monthBudget(m) {
    return '<section class="section"><div class="section-head"><h2>每周时间预算 · 60/10 贯穿全月</h2><span class="small muted">工作合计含课程、会议、英语与行政；不含用餐、小休或通勤</span></div><div class="panel budget-scroll"><table class="deadline-table"><thead><tr><th>周起始日</th><th>核心 / 工作容量</th><th>主动口语 / 小休</th><th>本周交付</th></tr></thead><tbody>'+Object.entries(m.weekly).map(([d,w])=>'<tr><td><a href="'+prefix+'weekly/'+d+'.html">'+shortDate(d)+'</a></td><td>'+hours(w.coreMinutes??w.workMinutes??0)+' / '+hours(w.workMinutes||0)+' h</td><td>'+hours(w.activeSpeakingMinutes||0)+' / '+hours(w.breakMinutes||0)+' h</td><td>'+escape(w.title)+'</td></tr>').join('')+'</tbody></table><p class="small muted" style="margin-top:12px">11 月 2 日周只含 7–8 日，11 月 30 日周只含当月最后一天。每天最多三项主要交付，口语占一项。延续块继续同一问题，吸收估时误差，不增加新承诺。75–90 分钟主动口语不包含课上听讲和书面作业。</p></div></section>';
  }
  function priorityCards() {
    const d = monthFor(date).days[date];
    return `<div class="overview-grid">${(d?.priorities || []).map((p,i)=>`<div class="priority-card"><span class="priority-num">${i+1}</span><div><strong>${escape(p)}</strong><p>这是本日最小交付方向；按实际材料推进，遇依赖先记录并缩小范围。</p></div></div>`).join('')}</div>`;
  }
  function focusPanel(d){
    if(!d?.focusWindows)return '';
    const b=d.planBudget;
    return `<section class="focus-panel"><div><span class="eyebrow">连续推进 · 可完成的下一步</span><h2>休息后，继续同一个问题</h2><p>核心安排 ${hours(b.coreMinutes)}h；同题延续 ${hours(b.continuationMinutes)}h。后者吸收估时误差，不增加必须完成的新成果。</p><div class="focus-windows">${d.focusWindows.map(w=>`<span><time>${w.start}–${w.end}</time> ${escape(profile.projects.find(p=>p.id===w.project)?.name||w.project)}</span>`).join('')}</div></div><div class="oral-highlight"><strong>${b.activeSpeakingMinutes}<small> min</small></strong><span>主动口语预算 / 日</span><p>初录 → 纠错 → 复录 → 答问<br>听课、材料、书面作业另计</p></div></section>`;
  }
  function decisionGates(m){
    if(!m.decisionGates)return '';
    return `<section class="section"><div class="section-head"><h2>本月关键依赖与取舍</h2><a href="${prefix}method.html">排程依据 ↗</a></div><div class="decision-grid">${m.decisionGates.map(g=>`<article class="panel"><span class="eyebrow">${shortDate(g.date)} · 内部检查点</span><h3>${escape(g.title)}</h3><p class="small muted">${escape(g.detail)}</p></article>`).join('')}</div><p class="small muted">已知资源：持续可用 20 张 H100。先确认已有证据、试跑吞吐和 ETA，再确定并行规模；机器墙钟时间与人的主动工作分开估计。</p></section>`;
  }
  function journalPanel() {
    const j = progress.journals[date] || {};
    return `<section class="panel"><h3>睡前汇报</h3><p class="small muted">用几句话就好：完成了什么、推进了什么、哪里卡住、今天累不累。</p><form class="journal-form" id="journal-form"><label>精力状态<select name="energy" ${localMode&&!serverReady?'disabled':''} aria-label="今天的精力"><option value="">尚未反馈</option>${[['1','很累，需要恢复'],['2','偏累'],['3','一般'],['4','不错'],['5','状态很好']].map(([v,t])=>`<option value="${v}" ${j.energy===v?'selected':''}>${t}</option>`).join('')}</select></label><label>今天的真实进度<textarea name="note" ${localMode&&!serverReady?'disabled':''} placeholder="例如：GAUGE 覆盖实验跑完了，消融还卡在配置；英语练了 20 分钟。">${escape(j.note || '')}</textarea></label><button class="btn primary" type="submit" ${localMode&&!serverReady?'disabled':''}>${localMode?'保存复盘并同步 GitHub':'保存浏览器草稿'}</button></form><p class="small muted" style="margin-top:10px">${localMode?'勾选和输入直接写入本地计划文件；点击保存会生成每日复盘并同步到公开个人主页仓库。之后对秘书说“按最新记录调整”即可，无需导出。保存不会自动唤醒秘书。':'此页只保存浏览器草稿。使用上方本地反馈入口，记录就能直接写入这台 Mac 的计划文件。' }</p></section>`;
  }
  function dayView() {
    const es = listEvents(date), work = es.filter(isWork), d = monthFor(date).days[date];
    const agenda = es.map(e=>`<div class="day-row"><time>${e.start}<br>— ${e.end}</time><button class="day-event ${done(e.id)?'done':''}" data-event="${e.id}" data-category="${e.category}"><strong>${done(e.id)?'✓ ':''}${escape(e.title)}</strong>${e.detail?`<p>${escape(e.detail)}</p>`:''}<span class="evidence">${e.commitment==='continuation'?'同题延续 · 不新增硬交付 · ':isWork(e)&&e.commitment?'核心 · ':''}${e.category==='fixed'?(e.oneOff?'用户确认 · 仅当天一次':'固定安排 · 未来实例按真实日历校准'):typeName[e.category] || '计划工作块'}</span></button></div>`).join('');
    const checks = work.map(e=>`<label class="task-check"><input type="checkbox" ${localMode&&!serverReady?'disabled':''} data-complete="${e.id}" ${done(e.id)?'checked':''}><span>${escape(e.title)}<br><small class="muted">${e.start}–${e.end}${e.commitment==='continuation'?' · 同题延续':e.commitment?' · 核心':''}</small></span></label>`).join('');
    const backlog = profile.backlog.filter(b=>b.due>=date || date<='2026-11-09');
    return `${priorityCards()}${focusPanel(d)}${summary(es)}${date===localToday()?'<div class="notice">从今天剩余的时间开始。过去的工作块不默认完成，也不要求你今晚全部补做。</div>':''}<div class="section-head"><h2>今天的时间安排</h2><span id="day-feedback-count" class="small muted">${escape(feedbackLabel())} · ${work.filter(e=>done(e.id)).length}/${work.length} 项已勾选</span></div><div class="day-layout"><div class="day-agenda">${agenda || '<div class="empty">该日尚未生成计划。</div>'}</div><aside class="aside-stack"><section class="panel quest-checklist"><h3>成果与完成标准</h3>${questPanel()}<p class="small muted quest-list-intro">完成一块，就点亮一小步。点击时间块可查看完整说明。</p>${checks}</section>${journalPanel()}${backlog.length?`<section class="panel"><h3>行政与待确认事项</h3>${backlog.slice(0,6).map(b=>`<div style="margin-top:12px"><strong class="small">${escape(b.title)}</strong><p class="small muted">${escape(b.detail)}</p></div>`).join('')}</section>`:''}<section class="panel"><h3>今天怎样算有推进</h3><p class="small muted">一项经过核验的结果、一条被排除的假设、一段更清楚的回应，都值得记录。未完成的任务会结合精力和真实截止重新分配。</p></section></aside></div>`;
  }
  function eventButton(e) {
    const top = (minute(e.start)-420)/60*120, height = duration(e)/60*120;
    return `<button class="event ${duration(e)<25?'short':''} ${e.category==='break'?'micro':''} ${done(e.id)?'done':''}" style="top:${top+(e.category==='break'?1:2)}px;height:${Math.max(e.category==='break'?8:16,height-(e.category==='break'?2:4))}px" data-event="${e.id}" data-category="${e.category}" aria-label="${escape(`${e.start}–${e.end} ${e.title}`)}" title="${escape(`${e.start}–${e.end} ${e.title}`)}"><span class="event-time">${e.start}–${e.end}</span><strong>${escape(e.category==='break'?'休息 10 分':e.title)}</strong>${duration(e)>=50&&e.detail?`<span class="event-detail">${escape(e.detail)}</span>`:''}</button>`;
  }
  function weekCalendar(start) {
    const dates = Array.from({length:7},(_,i)=>addDays(start,i));
    const gridHeight=(Math.max(1380,...dates.flatMap(listEvents).map(e=>minute(e.end)))-420)*2;
    const header = `<div class="week-headers"><div></div>${dates.map(d=>`<button class="day-header ${d===localToday()?'today':''} ${d===date?'selected':''}" data-day="${d}"><span class="weekday">周${'日一二三四五六'[weekday(d)]}</span><span class="day-number">${Number(d.slice(8))}</span></button>`).join('')}</div>`;
    const axis = `<div class="time-axis" style="height:${gridHeight}px">${Array.from({length:17},(_,i)=>`<span class="time-label" style="top:${i*120}px">${i+7}</span>`).join('')}</div>`;
    const cols = dates.map(d=>`<div class="day-column" style="height:${gridHeight}px">${listEvents(d).map(eventButton).join('') || '<div class="week-empty">尚无计划</div>'}</div>`).join('');
    const mobile = dates.map(d=>`<div class="mobile-day"><h3><button class="btn" data-day="${d}">${fullDate(d)}</button></h3>${listEvents(d).map(e=>`<div class="mobile-event"><time>${e.start}</time><button data-event="${e.id}">${escape(e.title)}</button></div>`).join('') || '<p class="small muted">尚无计划</p>'}</div>`).join('');
    return `<div class="calendar-wrap"><div class="calendar-top"><span class="calendar-title">${shortDate(start)} — ${shortDate(addDays(start,6))}</span><span class="small muted">America/Los_Angeles</span></div><div class="desktop-week">${header}<div class="week-body">${axis}${cols}</div></div><div class="mobile-agenda">${mobile}</div></div>`;
  }
  function weekView() {
    const start = monday(date), m = monthFor(date), info = m.weekly[start] || {title:'本周计划',goals:[],note:'请结合最新进度补充。'};
    const dates = Array.from({length:7},(_,i)=>addDays(start,i));
    const es = dates.flatMap(listEvents);
    return `<div class="weekly-top"><section class="panel"><div class="eyebrow">本周交付</div><h2 style="margin:7px 0 14px">${escape(info.title)}</h2><ul class="goal-list">${info.goals.map(g=>`<li>${escape(g)}</li>`).join('')}</ul><p class="small muted" style="margin-top:13px">${escape(info.note)}</p></section><section class="panel"><h3>这周的安排原则</h3><p class="small muted">同一科研问题连续 2–3 个 60/10 周期。周一集中整理 Kumar 两项目是多主题例外；课会多的日期减少新增交付。核心与延续分开，等待机器时不另开多个项目。每天主动口语 75–90 分钟，常规周五提前完成；当天例外及条件补练见单次调整。</p>${summary(es)}<p class="small muted">23:00–07:00 睡眠；${escape(fridayPolicyLabel())}。</p></section></div><div class="section-head"><h2>每天重点</h2><span class="small muted">完整日计划可逐日打开</span></div><div class="week-days">${dates.map(d=>`<article class="week-day-card"><h3>${fullDate(d)}</h3>${(m.days[d]?.priorities || ['当前范围内暂无计划']).slice(0,3).map(t=>`<p>${escape(t)}</p>`).join('')}${allDates.includes(d)?`<a href="${prefix}daily/${d}.html">打开日计划 ↗</a>`:''}</article>`).join('')}</div><section class="section"><div class="section-head"><h2>本周时间块</h2><span class="small muted">点击查看任务详情</span></div>${legend()}${weekCalendar(start)}</section>`;
  }
  function monthGrid(m) {
    const first=m.month+'-01', start=monday(first);
    const last=new Date(Date.UTC(Number(m.month.slice(0,4)),Number(m.month.slice(5,7)),0)).toISOString().slice(0,10);
    const count=Math.ceil((Number(last.slice(8))+(weekday(first)+6)%7)/7)*7;
    return `<div class="month-grid">${'一二三四五六日'.split('').map(x=>`<div class="month-weekday">周${x}</div>`).join('')}${Array.from({length:count},(_,i)=>{const d=addDays(start,i),planned=allDates.includes(d),mile=m.milestones.filter(x=>x.date===d),holiday=m.holidays.find(h=>h.date===d);return `<button class="month-cell ${!planned?'outside':''} ${d===date?'selected':''} ${d===localToday()?'today':''}" ${planned?`data-day="${d}"`:'disabled'}><span class="month-num">${Number(d.slice(8))}</span>${mile.map(x=>`<span class="milestone-label">${escape(x.title)}</span>`).join('')}${holiday?`<span class="month-note">${escape(holiday.label)}</span>`:''}${planned?`<span class="month-note">${escape((m.days[d].priorities || [])[0] || '')}</span>`:'<span class="month-note">暂无计划记录</span>'}</button>`;}).join('')}</div>`;
  }
  function deadlines(m) {
    return `<table class="deadline-table"><thead><tr><th>优先级</th><th>事项</th><th>日期与性质</th></tr></thead><tbody><tr><td>P0</td><td>三篇 ICLR 作者讨论</td><td>11/18 AoE，官方日期；精确时分待系统核验</td></tr><tr><td>P0</td><td>最终回复与修订收尾</td><td>11/18 18:00，内部执行截止</td></tr><tr><td>P0</td><td>TA 英语资格</td><td>实际资格录入截止待确认；下季度 2027/1/4 开课</td></tr><tr><td>P1</td><td>UW 注册问题</td><td>先核实真实截止；若阻碍注册或聘任立即上调</td></tr><tr><td>P1</td><td>Kumar 两项目周更新</td><td>每周二约 13:00–14:00；周一准备</td></tr><tr><td>P1</td><td>Bill 与 Noble 项目</td><td>周一 12:30–13:00；DIA 数据到达日期未知</td></tr><tr><td>P1</td><td>MoE 两项目 ICML 投稿</td><td>官方投稿截止待公布，不推定日期</td></tr><tr><td>P2</td><td>沟通与资料回复</td><td>11/9 前尽快清理为内部目标</td></tr></tbody></table>`;
  }
  function monthView() {
    const m=monthFor(date);
    return `${monthBudget(m)}${decisionGates(m)}<div class="phase-grid">${m.phases.map(p=>`<article class="phase ${date>=p.start&&date<=p.end?'active':''}"><div class="range">${shortDate(p.start)} — ${shortDate(p.end)}</div><h3>${escape(p.title)}</h3><p>${escape(p.goal)}</p></article>`).join('')}</div><section class="section"><div class="section-head"><h2>本月关键日期</h2><span class="small muted">点击日期查看详细日计划</span></div>${monthGrid(m)}</section><section class="section"><div class="section-head"><h2>Deadline 与轻重缓急</h2><a class="small" href="https://github.com/lylybig/lylybig.github.io/blob/main/planner/README.md">在 README 查看完整说明 ↗</a></div><div class="panel">${deadlines(m)}</div></section><section class="section"><div class="section-head"><h2>每条主线本月要推进什么</h2></div><div class="project-grid">${profile.projects.map(p=>`<article class="panel project-card"><h3>${p.url?`<a target="_blank" rel="noreferrer" href="${p.url}">${escape(p.name)} ↗</a>`:escape(p.name)}</h3><p>${escape(p.focus)}</p><div class="meta">${p.firstReplyTarget?`首轮回复内部目标 ${shortDate(p.firstReplyTarget)}`:'每周根据实际进度更新'}</div></article>`).join('')}</div></section><section class="section"><div class="weekly-top"><div class="panel"><h3>周计划入口</h3><ul class="goal-list">${Object.entries(m.weekly).map(([d,w])=>`<li><a href="${prefix}weekly/${d}.html">${shortDate(d)} 周 · ${escape(w.title)}</a></li>`).join('')}</ul></div><div class="panel"><h3>仍需确认的安排</h3><ul class="goal-list small muted">${m.assumptions.filter(x=>!x.includes('浏览器')).map(x=>`<li>${escape(x)}</li>`).join('')}</ul></div></div></section>`;
  }
  function render() { shell(view==='day'?dayView():view==='week'?weekView():monthView()); }
  function toast(message) { const el=document.getElementById('toast'); el.textContent=message;el.hidden=false;setTimeout(()=>{el.hidden=true;},3500); }
  function openEvent(id) {
    const e=events.find(x=>x.id===id);if(!e)return;selectedId=id;
    document.getElementById('dialog-inner').innerHTML=`<div class="eyebrow">${fullDate(e.date)} · ${e.start}–${e.end}</div><h2 id="dialog-heading">${escape(e.title)}</h2><p>${escape(e.detail || '按计划推进，记录真实结果与下一步。')}</p><h3>最小完成标准</h3><p>${escape(e.minimumOutcome||criteria(e))}</p>${e.estimate?`<p class="small muted">人的主动投入预算：${e.estimate.activeMinutes} 分钟 · ${escape(e.estimate.confidence)}。${['research','moe'].includes(e.category)?'训练返回时间尚未测定，不等于这个工作块长度。':''}</p>`:''}${e.resumeHint?`<h3>下次从这里继续</h3><p>${escape(e.resumeHint)}</p>`:''}${e.stretchOutcome?`<p class="small muted">${escape(e.stretchOutcome)}</p>`:''}<p class="small muted">${e.category==='fixed'?(e.oneOff?'用户确认的单次安排，仅限当天；不自动标记已经完成。':'按已确认的周例预留；实际变更以最新日历为准。'):'这是计划工作块，未反馈不代表已经完成。'}</p><div class="inline-actions">${isWork(e)?`<button class="btn primary" data-action="toggle-selected">${done(e.id)?'标记为未完成':'记录已完成'}</button>`:''}<button class="btn" data-action="close-dialog">关闭</button></div>`;
    document.getElementById('event-dialog').showModal();
  }
  function saveJournal() { const f=document.getElementById('journal-form');if(!f)return Promise.resolve();const fd=new FormData(f);progress.journals[date]={energy:fd.get('energy'),note:fd.get('note'),updatedAt:new Date().toISOString()};return persist(); }
  function exportProgress() { const blob=new Blob([JSON.stringify(progress,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`evening-review-${date}.json`;a.click();URL.revokeObjectURL(url); }
  root.addEventListener('click',event=>{
    const el=event.target.closest('button[data-view],[data-day],[data-event],[data-action]');if(!el)return;
    if(el.dataset.view){navigate(el.dataset.view);return;}
    if(el.dataset.day){navigate('day',el.dataset.day);window.scrollTo({top:0,behavior:'smooth'});return;}
    if(el.dataset.event){openEvent(el.dataset.event);return;}
    const action=el.dataset.action;
    if(action==='today')navigate(view,clamp(localToday()));
    if(action==='previous'||action==='next'){const n=action==='previous'?-1:1; if(view==='month'){const idx=months.findIndex(m=>m.month===date.slice(0,7));const next=months[idx+n];if(next)navigate(view,next.range.start);}else navigate(view,addDays(date,n*(view==='week'?7:1)));}
    if(action==='close-dialog')document.getElementById('event-dialog').close();
    if(action==='toggle-selected')completeTask(selectedId,!done(selectedId));
    if(action==='retry-local-sync'&&localMode){persist().then(()=>api('sync',{})).then(result=>{syncInfo=result.sync;refreshSaveStatus();pollSync();}).catch(error=>toast('重试未完成：'+error.message));}
    if(action==='quest-motion'){motionEnabled=!motionEnabled;try{localStorage.setItem('research-secretary-motion',motionEnabled?'on':'off');}catch{}const panel=document.querySelector('.quest-panel');if(panel)panel.dataset.motion=motionEnabled?'on':'off';el.textContent='动效'+(motionEnabled?'开启':'关闭');el.setAttribute('aria-pressed',String(motionEnabled));}
    if(action==='quest-next'){const next=rewards.measure(listEvents(date),progress.events).next;if(next){const input=document.querySelector('[data-complete="'+CSS.escape(next.id)+'"]');if(input){input.scrollIntoView({block:'center',behavior:motionEnabled&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto'});input.focus({preventScroll:true});}}}
    if(action==='export')exportProgress();
    if(action==='import')document.getElementById('progress-import').click();
  });
  root.addEventListener('change',event=>{
    if(event.target.matches('.date-input'))navigate(view,event.target.value);
    if(event.target.dataset.complete)completeTask(event.target.dataset.complete,event.target.checked);
    if(event.target.id==='progress-import'){
      const f=event.target.files?.[0];if(!f)return;if(f.size>2_000_000){toast('复盘文件过大，请检查文件。');return;}
      f.text().then(text=>{const next=JSON.parse(text);if(next.schemaVersion!==1||!next.events||!next.journals||typeof next.events!=='object'||typeof next.journals!=='object')throw Error('invalid');progress={schemaVersion:1,updatedAt:new Date().toISOString(),events:next.events,journals:next.journals};persist();render();toast(localMode?'复盘已载入；本地写入状态见页面上方。':'草稿已导入当前浏览器。');}).catch(()=>toast('无法导入：请使用本系统导出的复盘 JSON。'));
    }
  });
  root.addEventListener('submit',event=>{if(event.target.id==='journal-form'){event.preventDefault();submitJournal();}});
  root.addEventListener('input',event=>{if(event.target.closest('#journal-form'))saveJournal().catch(()=>{});});
  window.addEventListener('hashchange',()=>{readHash();render();});
  readHash();render();if(localMode)connectLocal();
})();
