/**
 * lazyload.js – IntersectionObserver-based lazy loading for images.
 */

// eslint-disable-next-line no-unused-vars
const LazyLoad = (() => {
  "use strict";

  let observer = null;

  function onIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      const src = img.getAttribute("data-src");
      if (!src) return;

      // Apply srcset if present (responsive thumbnails)
      const srcset = img.getAttribute("data-srcset");
      if (srcset) {
        img.srcset = srcset;
        img.removeAttribute("data-srcset");
      }

      img.src = src;
      img.removeAttribute("data-src");
      img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
      observer.unobserve(img);
    });
  }

  function observe() {
    observer = new IntersectionObserver(onIntersect, {
      rootMargin: "200px 0px", // start loading 200px before visible
    });

    document.querySelectorAll("img.lazy[data-src]").forEach((img) => {
      observer.observe(img);
    });
  }

  // Re-observe new images (e.g. after tab switch)
  function refresh() {
    if (!observer) return;
    document.querySelectorAll("img.lazy[data-src]").forEach((img) => {
      observer.observe(img);
    });
  }

  return { observe, refresh };
})();
