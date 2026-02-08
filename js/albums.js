/**
 * albums.js – Renders album grid and album detail views.
 *
 * Albums are stored in photos.json under an "albums" array.
 * Each album has: id, title, cover (filename), description,
 * and photos (array of filenames).
 */

// eslint-disable-next-line no-unused-vars
const AlbumsModule = (() => {
  "use strict";

  const THUMB_DIR = "photos/thumbnails/";
  let _albums = [];
  let _allPhotos = [];
  let _currentAlbum = null;

  /** Find a photo object by filename */
  function findPhoto(filename) {
    return _allPhotos.find((p) => p.filename === filename);
  }

  /** Get thumbnail src for a filename */
  function thumbSrc(filename) {
    const photo = findPhoto(filename);
    if (photo && photo.thumbnail) return THUMB_DIR + "360/" + photo.thumbnail;
    if (photo && photo.web) return "photos/web/" + photo.web;
    return "";
  }

  /** Render the albums grid (list of all albums) */
  function renderGrid() {
    const container = document.getElementById("albumsGrid");
    if (!container) return;
    container.innerHTML = "";

    // Show/hide back button
    const backBtn = document.getElementById("albumsBackBtn");
    if (backBtn) backBtn.classList.add("d-none");

    if (_albums.length === 0) {
      container.innerHTML = `
        <div class="col-12 empty-state">
          <i class="bi bi-collection"></i>
          <p class="h6">No Albums Yet</p>
          <p class="small">Create albums in the Admin page.</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    _albums.forEach((album, i) => {
      const coverSrc = album.cover ? thumbSrc(album.cover) : "";
      const photoCount = (album.photos || []).length;

      const col = document.createElement("div");
      col.className = "col-6 album-grid-item";
      col.setAttribute("data-album-index", i);
      col.innerHTML = `
        <div class="album-cover-wrap">
          ${coverSrc
            ? `<img class="album-cover lazy" data-src="${coverSrc}" alt="${album.title || ""}">`
            : `<div class="album-cover-placeholder"><i class="bi bi-collection"></i></div>`
          }
          <div class="album-cover-overlay">
            <span class="album-title">${album.title || "Untitled"}</span>
            <span class="album-count">${photoCount} photo${photoCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      `;
      fragment.appendChild(col);
    });

    container.appendChild(fragment);
    if (typeof LazyLoad !== "undefined") LazyLoad.refresh();
  }

  /** Render a single album's photos in detail view */
  function renderDetail(albumIndex) {
    const album = _albums[albumIndex];
    if (!album) return;
    _currentAlbum = albumIndex;

    const container = document.getElementById("albumsGrid");
    if (!container) return;
    container.innerHTML = "";

    // Show back button with album title
    const backBtn = document.getElementById("albumsBackBtn");
    if (backBtn) {
      backBtn.classList.remove("d-none");
      const titleEl = document.getElementById("albumDetailTitle");
      if (titleEl) titleEl.textContent = album.title || "Untitled";
    }

    const filenames = album.photos || [];
    if (filenames.length === 0) {
      container.innerHTML = `
        <div class="col-12 empty-state">
          <i class="bi bi-image"></i>
          <p class="h6">No Photos in This Album</p>
          <p class="small">Add photos to this album in the Admin page.</p>
        </div>`;
      return;
    }

    // Build array of resolved photo objects for this album
    const albumPhotos = filenames
      .map((fn) => findPhoto(fn))
      .filter(Boolean);

    const fragment = document.createDocumentFragment();
    albumPhotos.forEach((photo, i) => {
      const src = photo.thumbnail
        ? THUMB_DIR + "360/" + photo.thumbnail
        : (photo.web ? "photos/web/" + photo.web : "");

      const col = document.createElement("div");
      col.className = "col-4 grid-item album-photo-item";
      col.setAttribute("data-album-photo-index", i);
      col.innerHTML = `
        <img class="lazy" data-src="${src}"
             data-srcset="${photo.thumbnail ? THUMB_DIR + '360/' + photo.thumbnail + ' 360w, ' + THUMB_DIR + '640/' + photo.thumbnail + ' 640w, ' + THUMB_DIR + photo.thumbnail + ' 1080w' : ''}"
             sizes="(max-width: 767px) 33vw, 312px"
             alt="${photo.caption || ""}">
        <div class="overlay">
          ${photo.location ? `<i class="bi bi-geo-alt-fill me-1"></i>${photo.location}` : ""}
        </div>
      `;
      fragment.appendChild(col);
    });

    container.appendChild(fragment);
    if (typeof LazyLoad !== "undefined") LazyLoad.refresh();

    // Wire clicks → lightbox scoped to album photos
    container.addEventListener("click", handleDetailClick);

    // Store album photos for lightbox
    container._albumPhotos = albumPhotos;
  }

  function handleDetailClick(e) {
    const item = e.target.closest(".album-photo-item");
    if (!item) return;
    const idx = parseInt(item.dataset.albumPhotoIndex, 10);
    const container = document.getElementById("albumsGrid");
    const albumPhotos = container._albumPhotos || [];
    if (typeof LightboxModule !== "undefined" && albumPhotos.length > 0) {
      LightboxModule.setPhotos(albumPhotos);
      LightboxModule.open(idx);
    }
  }

  /** Handle hash-based deep linking for albums */
  function checkHash() {
    const hash = window.location.hash;
    if (!hash.startsWith("#album=")) return false;
    const albumId = hash.replace("#album=", "");
    const idx = _albums.findIndex((a) => a.id === albumId);
    if (idx !== -1) {
      renderDetail(idx);
      return true;
    }
    return false;
  }

  function init(photos, albums) {
    _allPhotos = photos || [];
    _albums = albums || [];
    _currentAlbum = null;

    const container = document.getElementById("albumsGrid");
    if (!container) return;

    // Album grid click → open album detail
    container.addEventListener("click", (e) => {
      const item = e.target.closest(".album-grid-item");
      if (!item) return;
      const idx = parseInt(item.dataset.albumIndex, 10);
      renderDetail(idx);
      // Update hash
      if (_albums[idx] && _albums[idx].id) {
        history.replaceState(null, "", "#album=" + _albums[idx].id);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Back button
    const backBtn = document.getElementById("albumsBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        _currentAlbum = null;
        renderGrid();
        history.replaceState(null, "", window.location.pathname + window.location.search);
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Restore lightbox to all photos
        if (typeof LightboxModule !== "undefined") {
          LightboxModule.setPhotos(_allPhotos);
        }
      });
    }

    // Render initial state
    if (!checkHash()) {
      renderGrid();
    }
  }

  return { init, renderGrid };
})();
