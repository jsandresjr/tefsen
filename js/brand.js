(()=>{"use strict";document.documentElement.classList.add("js");const header=document.getElementById("header"),bar=document.getElementById("reading-progress"),button=document.getElementById("menu-toggle"),nav=document.getElementById("nav"),reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;function refresh(){header?.classList.toggle("is-scrolled",scrollY>18);if(bar){const height=document.documentElement.scrollHeight-innerHeight;bar.style.width=(height>0?Math.min(100,scrollY/height*100):0)+"%"}}addEventListener("scroll",refresh,{passive:true});addEventListener("resize",refresh,{passive:true});refresh();function closeMenu(){nav?.classList.remove("open");button?.setAttribute("aria-expanded","false");button?.setAttribute("aria-label","Open navigation")}button?.addEventListener("click",()=>{const open=nav?.classList.toggle("open")??false;button.setAttribute("aria-expanded",String(open));button.setAttribute("aria-label",open?"Close navigation":"Open navigation")});nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});addEventListener("resize",()=>{if(innerWidth>760)closeMenu()},{passive:true});const items=[...document.querySelectorAll(".reveal")];if(!reduced&&"IntersectionObserver"in window){const obs=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");obs.unobserve(entry.target)}}),{rootMargin:"0px 0px -30px 0px",threshold:.05});items.forEach(el=>obs.observe(el))}else items.forEach(el=>el.classList.add("visible"));document.querySelectorAll("[data-year]").forEach(el=>el.textContent=String(new Date().getFullYear()));if(!reduced&&matchMedia("(pointer:fine)").matches){const hero=document.querySelector(".hero");hero?.addEventListener("pointermove",e=>{const r=hero.getBoundingClientRect();hero.style.setProperty("--mx",((e.clientX-r.left)/r.width-.5).toFixed(2));hero.style.setProperty("--my",((e.clientY-r.top)/r.height-.5).toFixed(2))},{passive:true})}})();
/* Founder portrait mouse-follow effect — homepage card and dedicated founder page.
   Motion is deliberately disabled for reduced-motion preferences and touch devices. */
(() => {
  const supportsFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!supportsFineHover || prefersReducedMotion) return;

  document.querySelectorAll(".portrait-card, .profile-photo").forEach((card) => {
    const reset = () => {
      card.classList.remove("is-pointer-active");
      card.style.setProperty("--portrait-x", "0px");
      card.style.setProperty("--portrait-y", "0px");
      card.style.setProperty("--portrait-tilt-x", "0deg");
      card.style.setProperty("--portrait-tilt-y", "0deg");
      card.style.setProperty("--portrait-light-x", "50%");
      card.style.setProperty("--portrait-light-y", "50%");
    };

    card.addEventListener("pointerenter", () => card.classList.add("is-pointer-active"));
    card.addEventListener("pointermove", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      card.style.setProperty("--portrait-x", ((0.5 - x) * 16).toFixed(2) + "px");
      card.style.setProperty("--portrait-y", ((0.5 - y) * 12).toFixed(2) + "px");
      card.style.setProperty("--portrait-tilt-x", ((0.5 - y) * 3.5).toFixed(2) + "deg");
      card.style.setProperty("--portrait-tilt-y", ((x - 0.5) * 3.5).toFixed(2) + "deg");
      card.style.setProperty("--portrait-light-x", (x * 100).toFixed(2) + "%");
      card.style.setProperty("--portrait-light-y", (y * 100).toFixed(2) + "%");
    }, {passive: true});
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
  });
})();
