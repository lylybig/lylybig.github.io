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
  const isWork = e => !['rest', 'commute', 'buffer'].includes(e.category);
  const typeName = {research:'科研', moe:'MoE 项目', fixed:'课程与会议', english:'英语', rest:'恢复', deadline:'关键节点', admin:'行政与复盘', commute:'通勤', buffer:'缓冲'};
  const hours = count => (count / 60).toFixed(1).replace(/\.0$/, '');
  let progress = structuredClone(data.progress);
  try { const saved = JSON.parse(localStorage.getItem(key)); if (saved?.schemaVersion === 1 && (!progress.updatedAt || saved.updatedAt > progress.updatedAt)) progress = saved; } catch (_) {}
  progress.events ||= {}; progress.journals ||= {};
  let date = clamp(prefix === './' ? localToday() : (root.dataset.date || localToday()));
  let view = root.dataset.view || 'day';
  let selectedId = null;
  const done = id => typeof progress.events[id] === 'boolean' ? progress.events[id] : Boolean(progress.events[id]?.done);
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
    try { localStorage.setItem(key, JSON.stringify(progress)); return true; } catch (_) { toast('浏览器无法保存，请导出复盘备份。'); return false; }
  }
  function readHash() { const q = new URLSearchParams(location.hash.slice(1)); const d = q.get('date'), v = q.get('view'); if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) date = clamp(d); if (['day','week','month'].includes(v)) view = v; }
  function navigate(v, d = date) { view = v; date = clamp(d); history.replaceState(null, '', `#view=${view}&date=${date}`); render(); window.scrollTo(0, 0); }
  function summary(es) {
    const research = es.filter(e => ['research','moe','deadline'].includes(e.category)).reduce((n,e) => n + duration(e), 0);
    const fixed = es.filter(e => e.category === 'fixed').reduce((n,e) => n + duration(e), 0);
    const english = es.filter(e => e.category === 'english').reduce((n,e) => n + duration(e), 0);
    return `<div class="summary-strip"><span><strong>${hours(research)}</strong>h 科研与成果</span><span><strong>${hours(fixed)}</strong>h 课程与会议</span><span><strong>${hours(english)}</strong>h 英语练习</span></div>`;
  }
  function legend() { return `<div class="legend">${[['research','科研'],['moe','MoE'],['fixed','固定安排'],['english','英语'],['rest','休息'],['deadline','关键节点']].map(([k,t])=>`<span><i class="${k}"></i>${t}</span>`).join('')}</div>`; }
  function shell(content) {
    const m = monthFor(date);
    const titles = {day:fullDate(date), week:`${shortDate(monday(date))} — ${shortDate(addDays(monday(date),6))}`, month:`${date.slice(0,4)} 年 ${Number(date.slice(5,7))} 月`};
    const subtitles = {day:'把最重要的事做清楚，为意外和恢复留出空间。', week:'先看本周交付，再看每天把时间给了什么。', month:'用阶段目标组织忙碌，让科研、TA 资格与休息各有位置。'};
    root.innerHTML = `<div class="shell"><aside class="sidebar"><div><div class="brand"><span class="brand-mark">L</span><span>科研秘书</span></div><div class="side-label">YOUR PLANNING SPACE</div><nav class="side-nav" aria-label="计划视图">${[['day','日计划'],['week','周计划'],['month','月计划']].map(([k,t])=>`<button class="nav-item ${view===k?'active':''}" data-view="${k}">${t}</button>`).join('')}</nav><div class="side-label">当前主线</div><div class="side-project"><i class="dot deadline"></i>ICLR 三篇 rebuttal</div><div class="side-project"><i class="dot moe"></i>MoE-LLM / Agent-RL</div><div class="side-project"><i class="dot"></i>Noble / DIA</div><div class="side-project"><i class="dot english"></i>TA 英语资格</div></div><div class="side-bottom"><strong>认真推进，也好好休息</strong><p class="muted">23:00–07:00 睡眠<br>周五 18:00 后完整休息</p><p style="margin-top:12px"><a href="${prefix}README.md">README 与全部计划</a></p></div></aside><main class="main"><header class="hero"><div><div class="eyebrow">Liang's Research Secretary</div><h1>${titles[view]}</h1><p>${subtitles[view]}</p></div><span class="status-pill">${date<='2026-11-18'?'Rebuttal 冲刺期':'科研稳定推进期'}</span></header><div class="rules"><span>◷ 西雅图时间</span><span>☾ 23:00–07:00</span><span>✧ 周五 18:00 后休息</span><span>计划更新 ${escape(m.updatedAt)}</span></div><div class="toolbar"><div class="segments" role="group" aria-label="切换计划">${[['day','日'],['week','周'],['month','月']].map(([k,t])=>`<button data-view="${k}" class="${view===k?'active':''}" aria-pressed="${view===k}">${t}</button>`).join('')}</div><div class="date-tools"><button class="btn icon" data-action="previous" aria-label="上一个日期范围">‹</button><button class="btn" data-action="today">今天</button><button class="btn icon" data-action="next" aria-label="下一个日期范围">›</button><input class="date-input" type="date" aria-label="选择计划日期" min="${minDate}" max="${maxDate}" value="${date}"></div></div>${content}<footer class="footer"><span>计划 ≠ 已完成 · 实际进度以晚间汇报和复盘为准</span><div class="source-links"><a href="https://github.com/lylybig/lylybig.github.io/tree/main/planner" target="_blank" rel="noreferrer">GitHub 仓库 ↗</a><a href="${prefix}monthly/${m.month}.html">本月 HTML</a><button class="btn" data-action="export">导出复盘</button><button class="btn" data-action="import">导入复盘</button></div></footer><input id="progress-import" type="file" accept="application/json,.json" hidden></main></div><dialog id="event-dialog" aria-labelledby="dialog-heading"><div class="dialog-inner" id="dialog-inner"></div></dialog><div id="toast" class="toast" role="status" hidden></div>`;
  }
  function priorityCards() {
    const d = monthFor(date).days[date];
    return `<div class="overview-grid">${(d?.priorities || []).map((p,i)=>`<div class="priority-card"><span class="priority-num">${i+1}</span><div><strong>${escape(p)}</strong><p>完成后记录实际成果，遇到阻塞及时缩小范围。</p></div></div>`).join('')}</div>`;
  }
  function journalPanel() {
    const j = progress.journals[date] || {};
    return `<section class="panel"><h3>睡前汇报</h3><p class="small muted">用几句话就好：完成了什么、推进了什么、哪里卡住、今天累不累。</p><form class="journal-form" id="journal-form"><label>精力状态<select name="energy" aria-label="今天的精力"><option value="">尚未反馈</option>${[['1','很累，需要恢复'],['2','偏累'],['3','一般'],['4','不错'],['5','状态很好']].map(([v,t])=>`<option value="${v}" ${j.energy===v?'selected':''}>${t}</option>`).join('')}</select></label><label>今天的真实进度<textarea name="note" placeholder="例如：GAUGE 覆盖实验跑完了，消融还卡在配置；英语练了 20 分钟。">${escape(j.note || '')}</textarea></label><button class="btn primary" type="submit">保存晚间复盘</button></form><p class="small muted" style="margin-top:10px">浏览器里的记录只保存在本机。导出复盘后发给秘书，或在睡前直接向秘书汇报，才能进入仓库并用于重新排程。</p></section>`;
  }
  function dayView() {
    const es = listEvents(date), work = es.filter(isWork), d = monthFor(date).days[date];
    const agenda = es.map(e=>`<div class="day-row"><time>${e.start}<br>— ${e.end}</time><button class="day-event ${done(e.id)?'done':''}" data-event="${e.id}" data-category="${e.category}"><strong>${done(e.id)?'✓ ':''}${escape(e.title)}</strong>${e.detail?`<p>${escape(e.detail)}</p>`:''}<span class="evidence">${e.category==='fixed'?'固定安排 · 未来实例按真实日历校准':typeName[e.category] || '计划工作块'}</span></button></div>`).join('');
    const checks = work.map(e=>`<label class="task-check"><input type="checkbox" data-complete="${e.id}" ${done(e.id)?'checked':''}><span>${escape(e.title)}<br><small class="muted">${e.start}–${e.end}</small></span></label>`).join('');
    const backlog = profile.backlog.filter(b=>b.due>=date || date<='2026-11-09');
    return `${priorityCards()}${summary(es)}${date===localToday()?'<div class="notice">从今天剩余的时间开始。过去的工作块不默认完成，也不要求你今晚全部补做。</div>':''}<div class="section-head"><h2>今天的时间安排</h2><span class="small muted">${escape(d?.feedback || '暂无反馈')} · ${work.filter(e=>done(e.id)).length}/${work.length} 项已勾选</span></div><div class="day-layout"><div class="day-agenda">${agenda || '<div class="empty">该日尚未生成计划。</div>'}</div><aside class="aside-stack"><section class="panel"><h3>成果与完成标准</h3><p class="small muted">点击时间块查看完整说明与完成标准。</p>${checks}</section>${journalPanel()}${backlog.length?`<section class="panel"><h3>行政与待确认事项</h3>${backlog.slice(0,6).map(b=>`<div style="margin-top:12px"><strong class="small">${escape(b.title)}</strong><p class="small muted">${escape(b.detail)}</p></div>`).join('')}</section>`:''}<section class="panel"><h3>今天怎样算有推进</h3><p class="small muted">一项经过核验的结果、一条被排除的假设、一段更清楚的回应，都值得记录。未完成的任务会结合精力和真实截止重新分配。</p></section></aside></div>`;
  }
  function eventButton(e) {
    const top = (minute(e.start)-420)/60*80, height = duration(e)/60*80;
    return `<button class="event ${duration(e)<25?'short':''} ${done(e.id)?'done':''}" style="top:${top+2}px;height:${Math.max(16,height-4)}px" data-event="${e.id}" data-category="${e.category}" title="${escape(`${e.start}–${e.end} ${e.title}`)}"><span class="event-time">${e.start}–${e.end}</span><strong>${escape(e.title)}</strong>${duration(e)>=50&&e.detail?`<span class="event-detail">${escape(e.detail)}</span>`:''}</button>`;
  }
  function weekCalendar(start) {
    const dates = Array.from({length:7},(_,i)=>addDays(start,i));
    const header = `<div class="week-headers"><div></div>${dates.map(d=>`<button class="day-header ${d===localToday()?'today':''} ${d===date?'selected':''}" data-day="${d}"><span class="weekday">周${'日一二三四五六'[weekday(d)]}</span><span class="day-number">${Number(d.slice(8))}</span></button>`).join('')}</div>`;
    const axis = `<div class="time-axis" style="height:1280px">${Array.from({length:17},(_,i)=>`<span class="time-label" style="top:${i*80}px">${i+7}</span>`).join('')}</div>`;
    const cols = dates.map(d=>`<div class="day-column" style="height:1280px">${listEvents(d).map(eventButton).join('') || '<div class="week-empty">尚无计划</div>'}</div>`).join('');
    const mobile = dates.map(d=>`<div class="mobile-day"><h3><button class="btn" data-day="${d}">${fullDate(d)}</button></h3>${listEvents(d).map(e=>`<div class="mobile-event"><time>${e.start}</time><button data-event="${e.id}">${escape(e.title)}</button></div>`).join('') || '<p class="small muted">尚无计划</p>'}</div>`).join('');
    return `<div class="calendar-wrap"><div class="calendar-top"><span class="calendar-title">${shortDate(start)} — ${shortDate(addDays(start,6))}</span><span class="small muted">America/Los_Angeles</span></div><div class="desktop-week">${header}<div class="week-body">${axis}${cols}</div></div><div class="mobile-agenda">${mobile}</div></div>`;
  }
  function weekView() {
    const start = monday(date), m = monthFor(date), info = m.weekly[start] || {title:'本周计划',goals:[],note:'请结合最新进度补充。'};
    const dates = Array.from({length:7},(_,i)=>addDays(start,i));
    const es = dates.flatMap(listEvents);
    return `<div class="weekly-top"><section class="panel"><div class="eyebrow">本周交付</div><h2 style="margin:7px 0 14px">${escape(info.title)}</h2><ul class="goal-list">${info.goals.map(g=>`<li>${escape(g)}</li>`).join('')}</ul><p class="small muted" style="margin-top:13px">${escape(info.note)}</p></section><section class="panel"><h3>这周的安排原则</h3><p class="small muted">周日准备 Bill，周一整理 Kumar 两项目更新。周二和周四先扣除课程与会议，科研任务随剩余完整时间安排。</p>${summary(es)}<p class="small muted">23:00–07:00 睡眠；周五 18:00 后完整休息。</p></section></div><div class="section-head"><h2>每天重点</h2><span class="small muted">完整日计划可逐日打开</span></div><div class="week-days">${dates.map(d=>`<article class="week-day-card"><h3>${fullDate(d)}</h3>${(m.days[d]?.priorities || ['当前范围内暂无计划']).slice(0,3).map(t=>`<p>${escape(t)}</p>`).join('')}${allDates.includes(d)?`<a href="${prefix}daily/${d}.html">打开日计划 ↗</a>`:''}</article>`).join('')}</div><section class="section"><div class="section-head"><h2>本周时间块</h2><span class="small muted">点击查看任务详情</span></div>${legend()}${weekCalendar(start)}</section>`;
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
    return `<div class="phase-grid">${m.phases.map(p=>`<article class="phase ${date>=p.start&&date<=p.end?'active':''}"><div class="range">${shortDate(p.start)} — ${shortDate(p.end)}</div><h3>${escape(p.title)}</h3><p>${escape(p.goal)}</p></article>`).join('')}</div><section class="section"><div class="section-head"><h2>本月关键日期</h2><span class="small muted">点击日期查看详细日计划</span></div>${monthGrid(m)}</section><section class="section"><div class="section-head"><h2>Deadline 与轻重缓急</h2><a class="small" href="${prefix}README.md">在 README 查看完整说明 ↗</a></div><div class="panel">${deadlines(m)}</div></section><section class="section"><div class="section-head"><h2>每条主线本月要推进什么</h2></div><div class="project-grid">${profile.projects.map(p=>`<article class="panel project-card"><h3>${p.url?`<a target="_blank" rel="noreferrer" href="${p.url}">${escape(p.name)} ↗</a>`:escape(p.name)}</h3><p>${escape(p.focus)}</p><div class="meta">${p.firstReplyTarget?`首轮回复内部目标 ${shortDate(p.firstReplyTarget)}`:'每周根据实际进度更新'}</div></article>`).join('')}</div></section><section class="section"><div class="weekly-top"><div class="panel"><h3>周计划入口</h3><ul class="goal-list">${Object.entries(m.weekly).map(([d,w])=>`<li><a href="${prefix}weekly/${d}.html">${shortDate(d)} 周 · ${escape(w.title)}</a></li>`).join('')}</ul></div><div class="panel"><h3>仍需确认的安排</h3><ul class="goal-list small muted">${m.assumptions.filter(x=>!x.includes('浏览器')).map(x=>`<li>${escape(x)}</li>`).join('')}</ul></div></div></section>`;
  }
  function render() { shell(view==='day'?dayView():view==='week'?weekView():monthView()); }
  function toast(message) { const el=document.getElementById('toast'); el.textContent=message;el.hidden=false;setTimeout(()=>{el.hidden=true;},3500); }
  function openEvent(id) {
    const e=events.find(x=>x.id===id);if(!e)return;selectedId=id;
    document.getElementById('dialog-inner').innerHTML=`<div class="eyebrow">${fullDate(e.date)} · ${e.start}–${e.end}</div><h2 id="dialog-heading">${escape(e.title)}</h2><p>${escape(e.detail || '按计划推进，记录真实结果与下一步。')}</p><h3>完成标准</h3><p>${escape(criteria(e))}</p><p class="small muted">${e.category==='fixed'?'按已确认的周例预留；实际变更以最新日历为准。':'这是计划工作块，未反馈不代表已经完成。'}</p><div class="inline-actions">${isWork(e)?`<button class="btn primary" data-action="toggle-selected">${done(e.id)?'标记为未完成':'记录已完成'}</button>`:''}<button class="btn" data-action="close-dialog">关闭</button></div>`;
    document.getElementById('event-dialog').showModal();
  }
  function saveJournal() { const f=document.getElementById('journal-form');if(!f)return;const fd=new FormData(f);progress.journals[date]={energy:fd.get('energy'),note:fd.get('note'),updatedAt:new Date().toISOString()};persist(); }
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
    if(action==='toggle-selected'){progress.events[selectedId]={done:!done(selectedId),updatedAt:new Date().toISOString()};persist();render();}
    if(action==='export')exportProgress();
    if(action==='import')document.getElementById('progress-import').click();
  });
  root.addEventListener('change',event=>{
    if(event.target.matches('.date-input'))navigate(view,event.target.value);
    if(event.target.dataset.complete){progress.events[event.target.dataset.complete]={done:event.target.checked,updatedAt:new Date().toISOString()};persist();render();}
    if(event.target.id==='progress-import'){
      const f=event.target.files?.[0];if(!f)return;if(f.size>2_000_000){toast('复盘文件过大，请检查文件。');return;}
      f.text().then(text=>{const next=JSON.parse(text);if(next.schemaVersion!==1||!next.events||!next.journals||typeof next.events!=='object'||typeof next.journals!=='object')throw Error('invalid');progress={schemaVersion:1,updatedAt:new Date().toISOString(),events:next.events,journals:next.journals};persist();render();toast('复盘已导入当前浏览器，请记得同步给秘书。');}).catch(()=>toast('无法导入：请使用本系统导出的复盘 JSON。'));
    }
  });
  root.addEventListener('submit',event=>{if(event.target.id==='journal-form'){event.preventDefault();saveJournal();toast('已保存在当前浏览器。睡前也可以直接向秘书汇报。');}});
  root.addEventListener('input',event=>{if(event.target.closest('#journal-form'))saveJournal();});
  window.addEventListener('hashchange',()=>{readHash();render();});
  readHash();render();
})();
