import { state } from './store.js';
import { escapeHTML, formatCount, timestampToDate } from './utils.js';

const root = document.getElementById('app-root');
const modalRoot = document.getElementById('modal-root');
const SUBJECTS = ['All Subjects','Mathematics','Physics','Chemistry','Biology','ICT/Computer Science'];
let homeMode = 'for-you';
let activeSubject = 'All Subjects';
let applying = false;
let queued = false;

function routeName(){ return (location.hash || '#/home').replace(/^#\/?/,'').split('/')[0] || 'home'; }
function svg(name,size=21){
  const p={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    study:'<path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12.5V17c2.8 2 7.2 2 10 0v-4.5"/><path d="M21 10v6"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    trophy:'<path d="M8 3h8v5a4 4 0 0 1-8 0V3Z"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/>',
    flame:'<path d="M13 2s1 4-2 6c-2 1.4-3 3.2-3 5.2A4 4 0 0 0 12 17a4 4 0 0 0 4-4c0-1.5-.7-2.9-2-4 .2 2-1 3-2 3 .7-4-2-6-2-6"/><path d="M9 19h6"/>',
    question:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 0 1 4.6 1c0 2-2.4 2.2-2.4 4"/><path d="M12 18h.01"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.question}</svg>`;
}
function num(...vals){ for(const v of vals){ const n=Number(v); if(Number.isFinite(n)&&n>=0)return n; } return 0; }
function dateMs(v){ return timestampToDate(v)?.getTime() || 0; }
function normalizeSubject(value=''){
  const v=String(value||'').trim().toLowerCase();
  if(['math','maths','mathematics'].includes(v))return 'Mathematics';
  if(v.includes('physics'))return 'Physics';
  if(v.includes('chem'))return 'Chemistry';
  if(v.includes('bio'))return 'Biology';
  if(v.includes('computer')||v.includes('ict')||v.includes('coding')||v.includes('program'))return 'ICT/Computer Science';
  return value || 'General';
}
function ownQuestions(){
  const uid=String(state.user?.uid||'');
  if(!uid)return [];
  return state.posts.filter(post=>[post.authorId,post.userId,post.uid,post.ownerId,post.authorUid].map(v=>String(v||'')).includes(uid));
}
function metrics(){
  const p=state.profile||{};
  return {
    questions:ownQuestions().length,
    answers:num(p.answersCount,p.answerCount,p.answeredCount,p.totalAnswers),
    solved:num(p.solvedCount,p.questionsSolved,p.solvedQuestions),
    accepted:num(p.acceptedCount,p.acceptedAnswers,p.bestAnswerCount),
    points:num(p.points,p.reputation,p.score),
    followers:num(p.followersCount,p.followerCount),
    following:num(p.followingCount),
    streak:num(p.streakDays,p.studyStreak,p.streak)
  };
}
function filteredPosts(){
  let posts=[...state.posts];
  if(activeSubject!=='All Subjects')posts=posts.filter(p=>normalizeSubject(p.subject)===activeSubject);
  if(homeMode==='latest')return posts.sort((a,b)=>dateMs(b.createdAt)-dateMs(a.createdAt));
  if(homeMode==='unanswered')return posts.filter(p=>num(p.commentCount,p.answerCount)===0).sort((a,b)=>dateMs(b.createdAt)-dateMs(a.createdAt));
  if(homeMode==='following'){
    const p=state.profile||{};
    const ids=new Set([...(Array.isArray(p.followingIds)?p.followingIds:[]),...(Array.isArray(p.following)?p.following:[])].map(String));
    return ids.size?posts.filter(post=>ids.has(String(post.authorId||''))):[];
  }
  return posts.sort((a,b)=>{
    const score=x=>num(x.likeCount)*2+num(x.commentCount,x.answerCount)*4+(Date.now()-dateMs(x.createdAt)<86400000?6:0);
    return score(b)-score(a);
  });
}

function patchBrand(){
  const mobile=document.querySelector('.mobile-top-brand span');
  if(mobile && mobile.dataset.tfBrand!=='1'){
    mobile.dataset.tfBrand='1';
    mobile.innerHTML='<b>Tefsen</b><small>The Social Education Network</small>';
  }
  const desktop=document.querySelector('.topbar-brand span');
  if(desktop && desktop.dataset.tfBrand!=='1'){
    desktop.dataset.tfBrand='1';
    desktop.textContent='Tefsen';
  }
}
function applyTheme(){
  const theme=localStorage.getItem('tefsen_theme')||'dark';
  document.documentElement.dataset.tfTheme=theme;
  const btn=document.querySelector('[data-tf-theme]');
  if(btn){ btn.innerHTML=theme==='dark'?svg('sun',20):svg('moon',20); btn.setAttribute('aria-label',theme==='dark'?'Use light theme':'Use dark theme'); }
}
function patchTopbar(){
  patchBrand();
  const actions=document.querySelector('.topbar-actions');
  if(actions && !actions.querySelector('[data-tf-theme]')){
    const b=document.createElement('button'); b.type='button'; b.className='icon-button tf-theme-btn'; b.dataset.tfTheme='1';
    actions.prepend(b);
  }
  applyTheme();
  const search=document.querySelector('.global-search input');
  if(search){ search.placeholder='Search questions, people, subjects'; search.autocomplete='off'; }
}

function patchMobileNav(){
  const nav=document.querySelector('.mobile-bottom'); if(!nav)return;
  const r=routeName();
  const signature=`${r}:${state.unreadCount||0}`;
  if(nav.dataset.tfSignature===signature)return;
  nav.dataset.tfSignature=signature;
  nav.innerHTML=`
    <button type="button" class="${r==='home'?'active':''}" data-route="home" aria-label="Home">${svg('home')}<span class="tf-nav-label">Home</span></button>
    <button type="button" class="${r==='notifications'?'active':''}" data-route="notifications" aria-label="Alerts">${svg('bell')}<span class="tf-nav-label">Alerts</span>${state.unreadCount?`<i class="tf-nav-badge">${Math.min(99,state.unreadCount)}</i>`:''}</button>
    <button type="button" class="tf-ask-nav" data-action="compose" aria-label="Ask">${svg('plus',25)}<span class="tf-nav-label">Ask</span></button>
    <button type="button" class="${r==='study'?'active':''}" data-tf-route="study" aria-label="Study">${svg('study')}<span class="tf-nav-label">Study</span></button>
    <button type="button" class="${r==='profile'?'active':''}" data-route="profile" aria-label="Profile">${svg('user')}<span class="tf-nav-label">Profile</span></button>`;
}
function patchSidebar(){
  const sidebar=document.querySelector('.sidebar'); if(!sidebar)return;
  const nav=sidebar.querySelector('.nav-list'); if(!nav)return;
  nav.querySelector('[data-route="messages"]')?.remove();
  nav.querySelector('[data-route="saved"]')?.remove();
  const explore=nav.querySelector('[data-route="explore"]');
  if(explore){ explore.dataset.route='notifications'; explore.innerHTML=`<span class="nav-icon">${svg('bell',20)}</span><span>Alerts</span>`; }
  if(!nav.querySelector('[data-tf-route="study"]')){
    const b=document.createElement('button'); b.type='button'; b.className='nav-item'; b.dataset.tfRoute='study'; b.innerHTML=`<span class="nav-icon">${svg('study',20)}</span><span>Study</span>`; nav.appendChild(b);
  }
  nav.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',(b.dataset.route||b.dataset.tfRoute)===routeName()));
}

function emptyMarkup(){
  const following=homeMode==='following';
  const title=homeMode==='unanswered'?'No unanswered questions':following?'No followed questions yet':'No questions found';
  const text=following?'Following is not connected to the web data model yet. Browse For You or Latest for now.':activeSubject!=='All Subjects'?`No ${activeSubject} questions yet.`:'Be the first to ask an academic question.';
  return `<section class="tf-empty"><div class="tf-empty-icon">${svg('question',46)}</div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(text)}</p>${following?'<button class="btn btn-secondary" type="button" data-tf-feed="for-you">Back to For You</button>':`<button class="btn btn-primary" type="button" data-action="compose">${svg('plus',18)} Ask a question</button>`}</section>`;
}
function patchHome(){
  if(routeName()!=='home')return;
  const wrap=document.querySelector('.content-wrap'); if(!wrap)return;
  wrap.querySelectorAll('.quality-home-hero,.subject-filter-row,.quality-subjects').forEach(el=>el.remove());
  if(!wrap.querySelector('.tf-home-head'))wrap.insertAdjacentHTML('afterbegin',`<header class="tf-home-head"><div><h1>Home</h1><p>The Social Education Network</p></div><button class="tf-home-ask" type="button" data-action="compose">${svg('plus',18)} Ask Question</button></header>`);

  const tabs=wrap.querySelector('.feed-tabs');
  if(tabs){
    const defs=[['for-you','For You'],['latest','Latest'],['unanswered','Unanswered'],['following','Following']];
    [...tabs.querySelectorAll('button')].slice(0,4).forEach((b,i)=>{
      const [mode,label]=defs[i];
      b.removeAttribute('data-feed-tab'); b.dataset.tfFeed=mode; b.textContent=label; b.classList.toggle('active',homeMode===mode); b.setAttribute('aria-selected',String(homeMode===mode));
    });
    let subjects=wrap.querySelector('.tf-subjects');
    if(!subjects){ subjects=document.createElement('div'); subjects.className='tf-subjects'; tabs.insertAdjacentElement('afterend',subjects); }
    const sSig=activeSubject;
    if(subjects.dataset.sig!==sSig){ subjects.dataset.sig=sSig; subjects.innerHTML=SUBJECTS.map(s=>`<button type="button" class="${s===activeSubject?'active':''}" data-tf-subject="${escapeHTML(s)}">${s==='All Subjects'?svg('check',14):''}${escapeHTML(s)}</button>`).join(''); }
  }
  const composer=wrap.querySelector('.composer-mini');
  if(composer){
    const fake=composer.querySelector('.fake-input'); if(fake)fake.textContent='Ask an academic question…';
    const ask=composer.querySelector('.ask-btn'); if(ask)ask.setAttribute('aria-label','Ask question');
  }
  const feed=wrap.querySelector('.feed-list'); if(!feed)return;
  const cards=new Map([...feed.querySelectorAll('[data-post-id]')].map(c=>[String(c.dataset.postId),c]));
  if(!cards.size){
    const articles=[...feed.querySelectorAll('.post-card')];
    state.posts.forEach((post,i)=>{ if(articles[i])cards.set(String(post.id),articles[i]); });
  }
  [...cards.values()].forEach(c=>{c.hidden=true;});
  let shown=0;
  filteredPosts().forEach(post=>{ const c=cards.get(String(post.id)); if(c){c.hidden=false;feed.appendChild(c);shown++;} });
  feed.querySelector('.empty-state')?.setAttribute('hidden','');
  feed.querySelectorAll('.tf-empty').forEach(el=>el.remove());
  if(!shown)feed.insertAdjacentHTML('beforeend',emptyMarkup());
}

function patchComposer(){
  const form=document.querySelector('[data-compose-form]'); if(!form)return;
  const modal=form.closest('.modal'); if(modal)modal.classList.add('tf-question-modal');
  const h=modal?.querySelector('.modal-head h2'); if(h)h.textContent='Ask Academic Question';
  const subject=form.querySelector('[name="subject"]');
  if(subject && subject.tagName!=='SELECT'){
    const sel=document.createElement('select'); sel.name='subject'; sel.className='select';
    SUBJECTS.slice(1).forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;if(normalizeSubject(subject.value)===s)o.selected=true;sel.appendChild(o);});
    subject.replaceWith(sel);
  }
  const title=form.querySelector('[name="title"]'); if(title)title.placeholder='What do you need help understanding?';
  const content=form.querySelector('[name="content"]'); if(content)content.placeholder='Add details, equations, what you tried, and where you are stuck.';
  form.querySelector('[name="tags"]')?.closest('.field')?.classList.add('tf-hidden');
  const submit=form.querySelector('button[type="submit"]'); if(submit)submit.innerHTML=`${svg('plus',19)} Publish Question`;
}

function renderStudy(){
  if(routeName()!=='study')return;
  const wrap=document.querySelector('.content-wrap'); if(!wrap)return;
  const m=metrics();
  const recent=ownQuestions().filter(p=>Date.now()-dateMs(p.createdAt)<=7*86400000).length;
  const weekly=Math.min(5,recent+Math.min(m.answers,5));
  const counts=new Map(); ownQuestions().forEach(p=>{const s=normalizeSubject(p.subject);counts.set(s,(counts.get(s)||0)+1);});
  const focus=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  wrap.classList.add('wide');
  wrap.innerHTML=`<section class="tf-study">
    <header class="tf-study-head"><div><h1>Study Hub</h1><p>Your learning, organized</p></div><div class="tf-study-head-actions"><span class="tf-streak">${svg('flame',18)} ${m.streak} day${m.streak===1?'':'s'}</span><button class="tf-trophy" type="button" data-route="leaderboard" aria-label="Leaderboard">${svg('trophy',22)}</button></div></header>
    <section class="tf-goal"><h2>${svg('flame',23)} Weekly learning goal</h2><p><strong>${weekly}</strong> of 5 helpful contributions</p><div class="tf-goal-track"><span style="width:${weekly*20}%"></span></div><small>${weekly>=5?'Goal complete — keep learning!':`Ask or answer ${5-weekly} more time${5-weekly===1?'':'s'} to finish.`}</small></section>
    <div class="tf-stats"><article class="tf-stat"><span>${svg('question',22)}</span><strong>${formatCount(m.questions)}</strong><small>Asked</small></article><article class="tf-stat"><span>${svg('study',22)}</span><strong>${formatCount(m.answers)}</strong><small>Answered</small></article><article class="tf-stat"><span>${svg('check',22)}</span><strong>${formatCount(m.solved)}</strong><small>Solved</small></article><article class="tf-stat"><span>${svg('trophy',22)}</span><strong>${formatCount(m.accepted)}</strong><small>Accepted</small></article></div>
    <section class="tf-quick"><h2>Quick actions</h2><button class="tf-practice" type="button" data-tf-practice>${svg('study',20)} Start Practice Session</button><div class="tf-quick-row"><button type="button" data-action="compose">${svg('plus',18)} Ask</button><button type="button" data-route="notifications">${svg('bell',18)} Activity</button></div></section>
    <section class="tf-focus"><h2>Subject focus</h2>${focus.length?`<div class="tf-focus-list">${focus.map(([s,c])=>`<button type="button" data-tf-focus="${escapeHTML(s)}">${escapeHTML(s)} · ${c}</button>`).join('')}</div>`:'<p>Start asking or answering to build your subject map.</p>'}</section>
    <section class="tf-saved"><h2>Continue learning</h2><div class="tf-saved-empty">Saved questions are not enabled in the current web data model yet.</div></section>
  </section>`;
}

function patchProfile(){
  if(routeName()!=='profile')return;
  const wrap=document.querySelector('.content-wrap'); if(!wrap)return;
  const m=metrics();
  const stats=wrap.querySelector('.profile-stats');
  if(stats){ stats.innerHTML=`<span><b>${formatCount(m.points)}</b><small>Reputation</small></span><span><b>${formatCount(m.questions)}</b><small>Questions</small></span><span><b>${formatCount(m.answers)}</b><small>Answers</small></span><span><b>${formatCount(m.followers)}</b><small>Followers</small></span><span><b>${formatCount(m.following)}</b><small>Following</small></span>`; }
  const tabs=wrap.querySelector('.profile-tabs'); if(tabs)tabs.style.display='none';
  const feed=wrap.querySelector('.feed-list'); if(feed)feed.style.display='';
  wrap.querySelectorAll('.questions-asked-panel').forEach(el=>el.remove());
  if(feed && !wrap.querySelector('.tf-profile-questions-title'))feed.insertAdjacentHTML('beforebegin','<div class="tf-profile-questions-title"><h2>Questions Asked</h2></div>');
}
function patchAlerts(){
  if(routeName()!=='notifications')return;
  const head=document.querySelector('.page-head h1'); if(head)head.textContent='Notifications';
  const desc=document.querySelector('.page-head p'); if(desc)desc.textContent='Answers to your questions and community activity appear here.';
}

function openPractice(){
  modalRoot.innerHTML=`<div class="modal-backdrop" data-tf-practice-close><section class="modal tf-question-modal" role="dialog" aria-modal="true" style="max-width:520px"><header class="modal-head"><div><h2>Practice a subject</h2><p>Choose a subject, then ask a focused question.</p></div></header><div class="modal-body"><div class="tf-focus-list">${SUBJECTS.slice(1).map(s=>`<button type="button" data-tf-practice-subject="${escapeHTML(s)}">${escapeHTML(s)}</button>`).join('')}</div><button class="btn btn-ghost btn-block" type="button" data-tf-practice-close style="margin-top:16px">Cancel</button></div></section></div>`;
}
function openComposer(subject=''){
  modalRoot.innerHTML='';
  const trigger=document.querySelector('[data-action="compose"]'); if(!trigger)return;
  trigger.click();
  requestAnimationFrame(()=>{ patchComposer(); const s=document.querySelector('[data-compose-form] [name="subject"]'); if(s&&subject)s.value=subject; document.querySelector('[data-compose-form] [name="title"]')?.focus(); });
}

function apply(){
  if(applying)return; applying=true;
  try{ patchTopbar(); patchMobileNav(); patchSidebar(); patchComposer(); if(routeName()==='study')renderStudy(); else {patchHome();patchProfile();patchAlerts();} }
  finally{ applying=false; }
}
function queue(){ if(queued)return; queued=true; requestAnimationFrame(()=>{queued=false;apply();}); }

document.addEventListener('click',event=>{
  const feed=event.target.closest?.('[data-tf-feed]'); if(feed){event.preventDefault();event.stopImmediatePropagation();homeMode=feed.dataset.tfFeed||'for-you';queue();return;}
  const subject=event.target.closest?.('[data-tf-subject]'); if(subject){event.preventDefault();event.stopImmediatePropagation();activeSubject=subject.dataset.tfSubject||'All Subjects';queue();return;}
  const study=event.target.closest?.('[data-tf-route="study"]'); if(study){event.preventDefault();event.stopImmediatePropagation();location.hash='#/study';setTimeout(queue,0);return;}
  const focus=event.target.closest?.('[data-tf-focus]'); if(focus){activeSubject=focus.dataset.tfFocus||'All Subjects';homeMode='latest';location.hash='#/home';setTimeout(queue,0);return;}
  if(event.target.closest?.('[data-tf-practice]')){event.preventDefault();event.stopImmediatePropagation();openPractice();return;}
  const ps=event.target.closest?.('[data-tf-practice-subject]'); if(ps){event.preventDefault();event.stopImmediatePropagation();openComposer(ps.dataset.tfPracticeSubject||'');return;}
  const close=event.target.closest?.('[data-tf-practice-close]'); if(close&&(close===event.target||close.matches('button'))){event.preventDefault();modalRoot.innerHTML='';return;}
  const theme=event.target.closest?.('[data-tf-theme]'); if(theme){event.preventDefault();const next=document.documentElement.dataset.tfTheme==='light'?'dark':'light';localStorage.setItem('tefsen_theme',next);applyTheme();return;}
  const searchIcon=event.target.closest?.('.global-search .search-icon'); if(searchIcon&&matchMedia('(max-width:900px)').matches){event.preventDefault();document.querySelector('.topbar')?.classList.add('tf-search-open');const input=document.querySelector('.global-search input');if(input){input.style.display='block';setTimeout(()=>input.focus(),0);}return;}
},true);

document.addEventListener('keydown',event=>{ if(event.key==='Escape')document.querySelector('.topbar')?.classList.remove('tf-search-open'); });
window.addEventListener('hashchange',()=>setTimeout(queue,0));
window.addEventListener('resize',queue);
new MutationObserver(()=>{if(!applying)queue();}).observe(root,{childList:true,subtree:true});
queue();
