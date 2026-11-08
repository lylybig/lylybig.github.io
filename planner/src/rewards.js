(() => {
  'use strict';
  const levels=[['准备出发',0],['迈出一步',30],['渐入节奏',90],['稳步推进',180],['积少成多',300],['今日深耕',480],['收好成果',720]];
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const completed=(state,id)=>typeof state[id]==='boolean'?state[id]:Boolean(state[id]?.done);
  function measure(events,state={}){
    const work=events.filter(e=>!['rest','break','commute','buffer'].includes(e.category));
    const finished=work.filter(e=>completed(state,e.id));
    const core=work.filter(e=>e.commitment!=='continuation'),coreFinished=core.filter(e=>completed(state,e.id));
    const size=e=>Math.max(0,minutes(e.end)-minutes(e.start));
    const xp=finished.reduce((n,e)=>n+size(e),0),totalMinutes=core.reduce((n,e)=>n+size(e),0),coreXp=coreFinished.reduce((n,e)=>n+size(e),0);
    let index=0;for(let i=1;i<levels.length;i++)if(xp>=levels[i][1])index=i;
    return {xp,totalMinutes,count:finished.length,total:work.length,coreCount:coreFinished.length,coreTotal:core.length,coreComplete:core.length>0&&coreFinished.length===core.length,percent:totalMinutes?Math.round(coreXp/totalMinutes*100):0,level:index+1,levelName:levels[index][0],nextLevel:levels[index+1]?.[1]??null,next:core.find(e=>!completed(state,e.id))||work.find(e=>!completed(state,e.id))||null,badges:[{name:'首项点亮',icon:'✦',unlocked:finished.length>0},{name:'一小时积累',icon:'◷',unlocked:xp>=60},{name:'核心半程',icon:'❋',unlocked:totalMinutes>0&&coreXp>=totalMinutes/2},{name:'核心收齐',icon:'⚑',unlocked:core.length>0&&coreFinished.length===core.length}]};
  }
  function encourage(event,summary){
    if(summary.coreComplete&&event.commitment!=='continuation')return {title:'核心计划收齐了 ✨',message:'今天的核心工作块已经点亮。收好真实成果和阻塞；延续块用于同题深入，不增加必须完成的新成果。'};
    if(event.category==='fixed')return {title:'固定安排，也收好一关',message:'课程和会议也占用精力。这一块收尾了，记下需要跟进的下一步就好。'};
    if(event.project==='english'&&!/口语|讲解/.test(event.title||''))return {title:'英语任务，又推进一块',message:'这份课程任务有了推进。把修改和问题收好，一点点把表达练扎实。'};
    const messages={
      english:['今天又开口练了一次。清楚表达，就是这样一点点练出来的。','这次练习值得收好。下一次开口，会多一份熟悉。'],
      gauge:['GAUGE 又有一小块进展被收好了。结果、发现和阻塞，都可以成为下一步的依据。','一块工作有了收尾。把证据和缺口记清楚，就是有价值的推进。'],
      resnet:['这块分析收好了。结论更准确、边界更清楚，也是一种扎实的成果。','又推进了一小步。先收好这一块，再去看下一块。'],
      noisy:['一个定义、一段例子、一条边界，都会让论文更容易被理解。收好这一步。','技术工作常常靠这样的细小推进。今天这一块已经有了记录。'],
      noble:['这块工作收好了。数据、配置和错误分析，都在为后续训练铺路。','有结果就记录结果，有阻塞就记清阻塞。这一段投入值得留痕。'],
      'moe-llm':['这一块推进值得记进周报。结果的解释和下一步决定，同样重要。','又收好一个工作块。让结果说话，下一轮会更有方向。'],
      'moe-agent':['环境、奖励、评估，每弄清一块，项目就多一份把握。','这段工作有了收尾。把结果和问题记下来，再开启下一关。']
    };
    const bank=messages[event.project]||['这一小步完成了，值得给自己一个肯定。我们继续把重要的事一块块做好。','收好这份进展。今天的推进不必轰轰烈烈，有记录、有下一步就很好。','完成一块，就少一块悬着的待办。先看清下一步，再继续。'];
    const seed=Array.from(event.id).reduce((n,c)=>n+c.charCodeAt(0),0);
    return {title:summary.count===1?'第一小关，点亮了 ✨':'又收好一小步 ✨',message:bank[seed%bank.length]};
  }
  window.PLANNER_REWARDS={measure,encourage};
})();
