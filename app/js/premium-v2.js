import { auth, db } from './firebase-client.js';
import { updateUserProfile } from './services/data-service.js';
import {
  deleteDoc, doc, getDoc, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

// Tefsen Premium V2 — interaction, accessibility and product polish.
// Progressive enhancement only: core Firebase/data behavior remains owned by app.js.

const PRIMARY_ROUTES = new Set(['home','explore','profile']);
const RETIRED_ROUTES = new Set(['messages','notifications','saved']);
let lastRoute = '';
let observerQueued = false;
let usernameSyncUid = '';
let usernameSyncPromise = null;

function routeName(){
  return location.hash.replace(/^#\/?/,'').split('/')[0].trim().toLowerCase() || 'home';
}

function showRuleToast(message, tone='info'){
  let toast=document.querySelector('[data-rules-toast]');
  if(!toast){
    toast=document.createElement('div');
    toast.dataset.rulesToast='1';
    toast.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10000;max-width:min(92vw,520px);padding:12px 16px;border-radius:14px;background:#0b1726;color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 50px rgba(0,0,0,.35);font:600 14px/1.4 system-ui,sans-serif;text-align:center';
    document.body.appendChild(toast);
  }
  toast.textContent=message;
  toast.style.opacity='1';
  toast.style.borderColor=tone==='error'?'rgba(255,95,95,.45)':'rgba(255,255,255,.14)';
  clearTimeout(showRuleToast.timer);
  showRuleToast.timer=setTimeout(()=>{ toast.style.opacity='0'; },3200);
}

function sanitizeUsername(value=''){
  return String(value||'')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g,'')
    .replace(/^[._-]+|[._-]+$/g,'')
    .slice(0,40);
}

function fallbackUsername(user){
  const emailBase=sanitizeUsername(String(user?.email||'').split('@')[0]);
  return emailBase || `user-${String(user?.uid||'').slice(0,8).toLowerCase()}`;
}

async function getUsernameOwner(username){
  if(!username) return null;
  const snap=await getDoc(doc(db,'usernames',username));
  return snap.exists()?snap.data():null;
}

async function writeUsernameMapping(user, username, previousUsername=''){
  const clean=sanitizeUsername(username) || fallbackUsername(user);
  const email=String(user?.email||'').trim();
  if(!user?.uid || !email) throw new Error('Your signed-in account needs an email before a username can be saved.');

  const mappingRef=doc(db,'usernames',clean);
  const owner=await getDoc(mappingRef);
  if(owner.exists() && String(owner.data()?.uid||'')!==String(user.uid)){
    const error=new Error('That username is already taken.');
    error.code='username-taken';
    throw error;
  }

  await setDoc(mappingRef,{
    uid:String(user.uid),
    email,
    username:clean,
    updatedAt:serverTimestamp(),
    ...(owner.exists()?{}:{createdAt:serverTimestamp()})
  },{merge:true});

  const old=sanitizeUsername(previousUsername);
  if(old && old!==clean){
    const oldRef=doc(db,'usernames',old);
    const oldSnap=await getDoc(oldRef).catch(()=>null);
    if(oldSnap?.exists?.() && String(oldSnap.data()?.uid||'')===String(user.uid)){
      await deleteDoc(oldRef).catch(()=>{});
    }
  }
  return clean;
}

async function ensureCurrentUsernameMapping(){
  const user=auth?.currentUser;
  if(!user?.uid || !user.email) return;
  if(usernameSyncUid===user.uid) return usernameSyncPromise;

  usernameSyncUid=user.uid;
  usernameSyncPromise=(async()=>{
    const userRef=doc(db,'users',user.uid);
    const snap=await getDoc(userRef);
    if(!snap.exists()) return;
    const data=snap.data()||{};
    const preferred=sanitizeUsername(data.username)||fallbackUsername(user);
    let candidate=preferred;
    const existing=await getUsernameOwner(candidate);
    if(existing && String(existing.uid||'')!==String(user.uid)){
      candidate=sanitizeUsername(`${preferred}-${String(user.uid).slice(0,6)}`);
    }
    const saved=await writeUsernameMapping(user,candidate,data.username||'');
    if(saved!==sanitizeUsername(data.username||'')){
      await setDoc(userRef,{username:saved,updatedAt:serverTimestamp()},{merge:true});
    }
  })().catch((error)=>{
    console.warn('Username mapping sync skipped:',error);
    usernameSyncUid='';
  });
  return usernameSyncPromise;
}

function retireUnsupportedAppFeatures(root=document){
  root.querySelectorAll('[data-route]').forEach((el)=>{
    const route=(el.getAttribute('data-route')||'').split('/')[0].trim().toLowerCase();
    if(RETIRED_ROUTES.has(route)) el.remove();
  });

  // Current app rules still do not expose saved posts or private messages to Web.
  root.querySelectorAll('[data-save],[data-message-user]').forEach((el)=>el.remove());
  root.querySelectorAll('[data-feed-tab="saved"]').forEach((el)=>el.remove());

  root.querySelectorAll('.widget-link').forEach((el)=>{
    const text=(el.textContent||'').trim().toLowerCase();
    if(text.includes('saved item') || text.includes('knowledge for later')) el.remove();
  });

  if(RETIRED_ROUTES.has(routeName())){
    history.replaceState(null,'',`${location.pathname}${location.search}#/home`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

function enhanceProfilePhotoEditor(root=document){
  root.querySelectorAll('[data-profile-form]').forEach((form)=>{
    if(form.dataset.profilePhotoEnhanced==='1') return;
    form.dataset.profilePhotoEnhanced='1';

    const field=document.createElement('div');
    field.className='field';
    field.innerHTML=`
      <label>Profile photo</label>
      <input class="input" type="file" name="profileImage" accept="image/*">
      <small class="form-help">JPG, PNG or WebP · under 5 MB · syncs with the Tefsen app</small>`;
    form.prepend(field);
  });
}

function setFollowButton(button,active){
  if(!button) return;
  button.textContent=active?'Following':'Follow';
  button.classList.toggle('btn-primary',!active);
  button.classList.toggle('btn-secondary',active);
  button.classList.toggle('is-following',active);
  button.setAttribute('aria-pressed',String(active));
}

async function hydrateFollowButtons(root=document){
  const user=auth?.currentUser;
  if(!user?.uid) return;
  const buttons=[...root.querySelectorAll('[data-follow-user]')];
  await Promise.all(buttons.map(async(button)=>{
    const target=String(button.dataset.followUser||'').trim();
    if(!target || target===user.uid) return;
    const key=`${user.uid}:${target}`;
    if(button.dataset.followHydratedFor===key) return;
    button.dataset.followHydratedFor=key;
    try{
      const snap=await getDoc(doc(db,'users',user.uid,'following',target));
      setFollowButton(button,snap.exists());
    }catch(error){
      console.warn('Follow state unavailable:',error);
      delete button.dataset.followHydratedFor;
    }
  }));
}

async function toggleFollowButton(button){
  const user=auth?.currentUser;
  const target=String(button?.dataset?.followUser||'').trim();
  if(!user?.uid || !target || target===user.uid) return;

  button.disabled=true;
  try{
    const followRef=doc(db,'users',user.uid,'following',target);
    const snap=await getDoc(followRef);
    const next=!snap.exists();
    if(next){
      await setDoc(followRef,{
        followerUid:String(user.uid),
        targetUserId:target,
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
    }else{
      await deleteDoc(followRef);
    }
    setFollowButton(button,next);
    button.dataset.followHydratedFor=`${user.uid}:${target}`;
    showRuleToast(next?'Following student':'Unfollowed student');
  }catch(error){
    console.error(error);
    showRuleToast('Could not update follow status. Check Firebase rules.','error');
  }finally{
    button.disabled=false;
  }
}

async function handleRuleBackedClick(event){
  const follow=event.target.closest?.('[data-follow-user]');
  if(!follow) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  await toggleFollowButton(follow);
}

async function handleProfileSubmitCapture(event){
  const form=event.target.closest?.('[data-profile-form]');
  const user=auth?.currentUser;
  if(!form || !user?.uid) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const submit=form.querySelector('button[type="submit"]');
  const oldText=submit?.textContent||'Save profile';
  if(submit){ submit.disabled=true; submit.textContent='Saving…'; }

  const fd=new FormData(form);
  const fullName=String(fd.get('fullName')||'').trim();
  const requested=sanitizeUsername(fd.get('username'))||fallbackUsername(user);
  const bio=String(fd.get('bio')||'').trim();
  const usernameInput=form.querySelector('input[name="username"]');
  usernameInput?.setCustomValidity('');

  try{
    const userRef=doc(db,'users',user.uid);
    const currentSnap=await getDoc(userRef);
    const current=currentSnap.exists()?currentSnap.data():{};
    const owner=await getUsernameOwner(requested);
    if(owner && String(owner.uid||'')!==String(user.uid)){
      const error=new Error('That username is already taken.');
      error.code='username-taken';
      throw error;
    }

    const updated=await updateUserProfile('firebase',user.uid,{fullName,username:requested,bio});
    const savedUsername=await writeUsernameMapping(user,requested,current.username||'');
    if(savedUsername!==requested){
      await setDoc(userRef,{username:savedUsername,updatedAt:serverTimestamp()},{merge:true});
    }
    usernameSyncUid=user.uid;
    usernameSyncPromise=Promise.resolve();
    showRuleToast('Profile updated and synced with Tefsen app');
    setTimeout(()=>location.reload(),500);
    return updated;
  }catch(error){
    console.error(error);
    if(error?.code==='username-taken'){
      usernameInput?.setCustomValidity('That username is already taken.');
      usernameInput?.reportValidity();
    }else{
      showRuleToast(error?.message||'Could not save profile.','error');
    }
  }finally{
    if(submit){ submit.disabled=false; submit.textContent=oldText; }
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
    rel.add('noopener');
    rel.add('noreferrer');
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
  retireUnsupportedAppFeatures(root);
  enhanceProfilePhotoEditor(root);
  labelNavigation(root);
  improvePostCards(root);
  improveForms(root);
  improveExternalLinks(root);
  markMainContent(root);
  addSkipLink();
  announceRoute();
  void hydrateFollowButtons(root);
  void ensureCurrentUsernameMapping();
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
document.addEventListener('click',handleRuleBackedClick,true);
document.addEventListener('submit',handleProfileSubmitCapture,true);
applyPremiumV2();