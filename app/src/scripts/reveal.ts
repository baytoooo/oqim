// Scroll reveals. Base.astro adds html.rv before the page paints (only when motion is allowed and
// IntersectionObserver exists) and takes it off again after 3 s if this script never ran. Here every
// [data-reveal] element gets .is-in once it is on screen; global.css animates it in from there.

declare global {
  interface Window {
    __rv?: boolean;
  }
}

window.__rv = true;

const root = document.documentElement;
if (root.classList.contains("rv") && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        // 8% of the element, or a good part of the screen for elements taller than it
        if (e.intersectionRatio >= 0.08 || e.intersectionRect.height >= window.innerHeight * 0.25) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: [0, 0.08, 0.25] },
  );
  for (const el of document.querySelectorAll("[data-reveal]")) io.observe(el);
}

export {};
