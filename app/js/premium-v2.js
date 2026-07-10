// Tefsen Premium V2 — interaction, accessibility and product polish.
// Progressive enhancement only: core Firebase/data behavior remains owned by app.js.

const PRIMARY_ROUTES = new Set(['home','explore','notifications','profile']);
const RETIRED_ROUTE = 'messages';
let lastRoute = '';
let observerQueued = false;

function routeName(){
  return location.hash.replace(/^#\/?/,'').split('/')[0].trim().toLowerCase() || 'home';
}

function retireMessagesExperience(root=document){
  root.querySelectorAll('[data-route="messages"]').forEach((el)=>el.remove());
  root.querySelectorAll('button,a').forEach((el)=>{
    const label=(el.textContent||'').trim().toLowerCase();
    if(label==='messages' && (el.closest('.sidebar')||el.closest('.topbar-actions')||el.closest('.mobile-bottom'))){
      el.remove();
    }
  });
  if(routeName()===RETIRED_ROUTE){
    history.replaceState(null,'',`${location.pathname}${location.search}#/home`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

function labelNavigation(root=document){
  root.querySelectorAll('[data-route]').forEach((el)=>{
    const route=el.getAttribute('data-route')||'';
    if(!route || route.includes('/')) return;
    if(!el.getAttribute('aria-label')){
      const text=(el.textContent||'').trim();
      if(text) el.setAttribute('aria-label',text);
    }
    if(PRIMARY_ROUTES.has(route) && routeName()===route){
      el.setAttribute('aria-current','page');
    }else{
      el.removeAttribute('aria-current');
    }
  });
}

function improvePostCards(root=document){
  root.querySelectorAll('.post-card').forEach((card,index)=>{
    card.setAttribute('role','article');
    if(!card.hasAttribute('tabindex')) card.setAttribute('tabindex','0');
    if(!card.getAttribute('aria-label')){
      const title=card.querySelector('.post-body h3')?.textContent?.trim();
      card.setAttribute('aria-label',title?`Discussion: ${title}`:`Tefsen discussion ${index+1}`);
    }
  });

  root.querySelectorAll('.post-image').forEach((img)=>{
    img.setAttribute('loading','lazy');
    img.setAttribute('decoding','async');
  });
}

function improveForms(root=document){
  root.querySelectorAll('input,textarea,select').forEach((field)=>{
    if(!field.getAttribute('aria-label') && !field.id){
      const placeholder=field.getAttribute('placeholder');
      if(placeholder) field.setAttribute('aria-label',placeholder);
    }
  });

  root.querySelectorAll('form').forEach((form)=>{
    if(form.dataset.premiumSubmitGuard==='1') return;
    form.dataset.premiumSubmitGuard='1';
    form.addEventListener('submit',()=>{
      const button=form.querySelector('button[type="submit"]');
      if(!button) return;
      button.dataset.originalText=button.textContent||'';
      button.setAttribute('aria-busy','true');
      setTimeout(()=>button.removeAttribute('aria-busy'),4000);
    });
  });
}

function improveExternalLinks(root=document){
  root.querySelectorAll('a[target="_blank"]').forEach((link)=>{
    const rel=new Set((link.getAttribute('rel')||'').split(/\s+/).filter(Boolean));
    rel.add('noopener');rel.add('noreferrer');
    link.setAttribute('rel',[...rel].join(' '));
  });
}

function addSkipLink(){
  if(document.querySelector('.premium-skip-link')) return;
  const link=document.createElement('a');
  link.className='premium-skip-link';
  link.href='#app-main-content';
  link.textContent='Skip to main content';
  link.style.cssText='position:fixed;left:12px;top:-80px;z-index:9999;padding:10px 14px;border-radius:10px;background:#fff;color:#06111f;font-weight:800;transition:top .2s';
  link.addEventListener('focus',()=>{link.style.top='12px'});
  link.addEventListener('blur',()=>{link.style.top='-80px'});
  document.body.prepend(link);
}

function markMainContent(root=document){
  const main=root.querySelector('.main-area');
  if(main && !main.id){
    main.id='app-main-content';
    main.setAttribute('tabindex','-1');
  }
}

function announceRoute(){
  const current=routeName();
  if(current===lastRoute) return;
  lastRoute=current;
  document.title=`${current.charAt(0).toUpperCase()+current.slice(1)} — Tefsen`;
}

function applyPremiumV2(root=document){
  retireMessagesExperience(root);
  labelNavigation(root);
  improvePostCards(root);
  improveForms(root);
  improveExternalLinks(root);
  markMainContent(root);
  addSkipLink();
  announceRoute();
  document.documentElement.classList.add('tefsen-premium-v2');
}

const observer=new MutationObserver(()=>{
  if(observerQueued) return;
  observerQueued=true;
  requestAnimationFrame(()=>{
    observerQueued=false;
    applyPremiumV2();
  });
});

observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>applyPremiumV2());
document.addEventListener('DOMContentLoaded',()=>applyPremiumV2(),{once:true});
applyPremiumV2();
