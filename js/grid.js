/**
 * grid.js – Renders the 3-column photo grid with 1:1 crop previews.
 * Uses srcset for responsive image serving (360 / 640 / 1080).
 */

// eslint-disable-next-line no-unused-vars
const GridModule = (() => {
  "use strict";

  const THUMB_DIR = "photos/thumbnails/";
  let _photos = [];

  function createGridItem(photo, index) {
    const col = document.createElement("div");
    col.className = "col-4 grid-item";
    col.setAttribute("data-index", index);

    const img = document.createElement("img");
    // Default src (smallest for fast mobile loads)
    img.setAttribute("data-src", THUMB_DIR + "360/" + photo.thumbnail);
    // Responsive srcset: browser picks the best size
    img.setAttribute(
      "data-srcset",
      THUMB_DIR + "360/" + photo.thumbnail + " 360w, " +
      THUMB_DIR + "640/" + photo.thumbnail + " 640w, " +
      THUMB_DIR + photo.thumbnail + " 1080w"
    );
    // Each grid column is ~33vw
    img.setAttribute("sizes", "(max-width: 767px) 33vw, 312px");
    img.setAttribute("alt", photo.caption || "");
    img.className = "lazy";

    // Hover overlay (shows location or caption snippet)
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = photo.location
      ? `<i class="bi bi-geo-alt-fill me-1"></i>${photo.location}`
      : "";

    col.appendChild(img);
    col.appendChild(overlay);

    // Media badges (carousel / video)
    if (typeof CarouselFactory !== "undefined") {
      const media = CarouselFactory.getMedia(photo);
      if (media.length > 1) {
        const badge = document.createElement("div");
        badge.className = "grid-badge";
        badge.innerHTML = '<i class="bi bi-copy"></i>';
        col.appendChild(badge);
      } else if (CarouselFactory.isVideo(photo)) {
        const badge = document.createElement("div");
        badge.className = "grid-badge";
        badge.innerHTML = '<i class="bi bi-play-btn-fill"></i>';
        col.appendChild(badge);
      }
    }

    return col;
  }

  function init(photos) {
    _photos = photos;
    const grid = document.getElementById("photoGrid");
    if (!grid) return;

    // Empty state
    if (photos.length === 0) {
      grid.innerHTML = `
        <div class="col-12 empty-state">
          <i class="bi bi-camera"></i>
          <p class="h6">No Posts Yet</p>
          <p class="small">Add photos to <code>photos/originals/</code> and run the processing script.</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    photos.forEach((photo, i) => {
      fragment.appendChild(createGridItem(photo, i));
    });
    grid.appendChild(fragment);

    // Grid item click → open lightbox
    grid.addEventListener("click", (e) => {
      const item = e.target.closest(".grid-item");
      if (!item) return;
      const idx = parseInt(item.dataset.index, 10);
      if (typeof LightboxModule !== "undefined") {
        LightboxModule.open(idx);
      }
    });
  }

  return { init };
})();
