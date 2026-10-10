(()=>{"use strict";document.documentElement.classList.add("js");const header=document.getElementById("header"),bar=document.getElementById("reading-progress"),button=document.getElementById("menu-toggle"),nav=document.getElementById("nav"),reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;function refresh(){header?.classList.toggle("is-scrolled",scrollY>18);if(bar){const height=document.documentElement.scrollHeight-innerHeight;bar.style.width=(height>0?Math.min(100,scrollY/height*100):0)+"%"}}addEventListener("scroll",refresh,{passive:true});addEventListener("resize",refresh,{passive:true});refresh();function closeMenu(){nav?.classList.remove("open");button?.setAttribute("aria-expanded","false");button?.setAttribute("aria-label","Open navigation")}button?.addEventListener("click",()=>{const open=nav?.classList.toggle("open")??false;button.setAttribute("aria-expanded",String(open));button.setAttribute("aria-label",open?"Close navigation":"Open navigation")});nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});addEventListener("resize",()=>{if(innerWidth>760)closeMenu()},{passive:true});const items=[...document.querySelectorAll(".reveal")];if(!reduced&&"IntersectionObserver"in window){const obs=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");obs.unobserve(entry.target)}}),{rootMargin:"0px 0px -30px 0px",threshold:.05});items.forEach(el=>obs.observe(el))}else items.forEach(el=>el.classList.add("visible"));document.querySelectorAll("[data-year]").forEach(el=>el.textContent=String(new Date().getFullYear()));if(!reduced&&matchMedia("(pointer:fine)").matches){const hero=document.querySelector(".hero");hero?.addEventListener("pointermove",e=>{const r=hero.getBoundingClientRect();hero.style.setProperty("--mx",((e.clientX-r.left)/r.width-.5).toFixed(2));hero.style.setProperty("--my",((e.clientY-r.top)/r.height-.5).toFixed(2))},{passive:true})}})();
/* Color spot follows the mouse over the founder's grayscale photo on both pages.
   The full-color image is a visually aligned, accessibility-hidden copy of the
   existing original photograph. A CSS radial mask reveals only the cursor area.
   If scripts or masking are unavailable, the base portrait simply stays grayscale. */
(() => {
  const hover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supportsMask = window.CSS && typeof CSS.supports === "function" &&
    (CSS.supports("mask-image", "radial-gradient(circle at center, black, transparent)") ||
     CSS.supports("-webkit-mask-image", "radial-gradient(circle at center, black, transparent)"));
  if (!hover || reduceMotion || !supportsMask) return;

  document.querySelectorAll(".portrait-card, .profile-photo").forEach((card) => {
    const base = card.querySelector(":scope > img:not(.founder-color-layer)");
    if (!base || card.querySelector(":scope > .founder-color-layer")) return;

    const color = base.cloneNode(false);
    color.classList.add("founder-color-layer");
    color.setAttribute("aria-hidden", "true");
    color.alt = "";
    color.removeAttribute("fetchpriority");
    color.decoding = "async";
    base.insertAdjacentElement("afterend", color);

    const follow = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      card.style.setProperty("--reveal-x", x.toFixed(1) + "px");
      card.style.setProperty("--reveal-y", y.toFixed(1) + "px");
    };

    const reset = () => card.classList.remove("is-revealing");
    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      follow(event);
      card.classList.add("is-revealing");
    });
    card.addEventListener("pointermove", follow, {passive:true});
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
  });
})();
