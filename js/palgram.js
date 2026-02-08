/**
 * palgram.js – Combined feed of your photos + friends' photos.
 *
 * Reads palgram/pals.json for a list of friend mygram URLs,
 * fetches each one's data/photos.json, merges all photos with
 * your own, and renders a single timeline sorted newest-first.
 */

// eslint-disable-next-line no-unused-vars
const PalgramModule = (() => {
  "use strict";

  const PALS_URL = "palgram/pals.json";
  let _allPhotos = [];
  let _initialised = false;

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function getMonthKey(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }

  function showToast(message) {
    const toast = document.getElementById("shareToast");
    const body = document.getElementById("shareToastBody");
    if (!toast || !body) return;
    body.textContent = message;
    const bsToast = new bootstrap.Toast(toast, { delay: 2000 });
    bsToast.show();
  }

  function slugFor(photo) {
    if (photo.slug) return photo.slug;
    return photo.filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function sharePhoto(photo) {
    const slug = slugFor(photo);
    const isLocal = !photo._palBaseUrl;
    const url = isLocal
      ? window.location.origin + window.location.pathname + "#photo=" + slug
      : photo._palBaseUrl + "#photo=" + slug;
    navigator.clipboard.writeText(url).then(() => {
      showToast("Link copied to clipboard");
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Link copied to clipboard");
    });
  }

  /**
   * Fetch a pal's photos.json and return enriched photo objects.
   * Each photo gets _palUsername, _palAvatar, _palBaseUrl attached.
   */
  async function fetchPal(palUrl) {
    // Normalise URL: ensure trailing slash
    const base = palUrl.endsWith("/") ? palUrl : palUrl + "/";
    const jsonUrl = base + "data/photos.json";

    try {
      const res = await fetch(jsonUrl, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profile = data.profile || {};
      const photos = data.photos || [];

      return photos.map((photo) => ({
        ...photo,
        _palUsername: profile.username || "unknown",
        _palAvatar: base + (profile.profilePhoto || "assets/profile.jpg"),
        _palBaseUrl: base,
      }));
    } catch (err) {
      console.warn("Palgram: could not fetch " + jsonUrl, err);
      return [];
    }
  }

  /** Create a timeline card for a merged photo entry */
  function createCard(photo, index) {
    const card = document.createElement("div");
    card.className = "timeline-card";

    // Determine image URL and avatar
    const isLocal = !photo._palBaseUrl;
    const imgSrc = isLocal
      ? "photos/web/" + photo.web
      : photo._palBaseUrl + "photos/web/" + photo.web;
    const avatar = isLocal
      ? (photo._palAvatar || "assets/profile.jpg")
      : photo._palAvatar;
    const username = photo._palUsername || "you";

    // Username: if pal, make it a tappable link to their app
    const usernameHtml = !isLocal
      ? `<a href="${photo._palBaseUrl}" target="_blank" rel="noopener" class="pal-username-link d-block">${username}</a>`
      : `<strong class="d-block">${username}</strong>`;

    card.innerHTML = `
      <div class="card-header">
        <img src="${avatar}" alt="" crossorigin="anonymous">
        <div>
          ${usernameHtml}
          ${photo.location ? `<small class="text-muted">${photo.location}</small>` : ""}
        </div>
      </div>
      <img
        class="card-img lazy palgram-photo"
        data-src="${imgSrc}"
        data-index="${index}"
        alt="${photo.caption || ""}"
        ${!isLocal ? 'crossorigin="anonymous"' : ""}
        style="cursor:pointer"
      >
      <div class="card-actions">
        <button class="btn-timeline-share" data-index="${index}" aria-label="Share">
          <i class="bi bi-send"></i>
        </button>
      </div>
      <div class="card-body">
        ${photo.caption ? `<p class="mb-1"><strong>${username}</strong> ${photo.caption}</p>` : ""}
        <p class="card-meta mb-0">${formatDate(photo.date)}</p>
      </div>
    `;

    return card;
  }

  function render() {
    const container = document.getElementById("palgramTimeline");
    if (!container) return;
    container.innerHTML = "";

    if (_allPhotos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-people"></i>
          <p class="h6">No Pal Posts Yet</p>
          <p class="small">Add friend URLs to <code>palgram/pals.json</code> and add your own photos.</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    let lastMonthKey = "";

    _allPhotos.forEach((photo, i) => {
      const monthKey = getMonthKey(photo.date);
      if (monthKey && monthKey !== lastMonthKey) {
        const divider = document.createElement("div");
        divider.className = "timeline-month-divider";
        divider.textContent = monthKey;
        fragment.appendChild(divider);
        lastMonthKey = monthKey;
      }
      fragment.appendChild(createCard(photo, i));
    });

    container.appendChild(fragment);

    // Click delegation: photo tap → lightbox, share button
    container.addEventListener("click", (e) => {
      // Share button
      const shareBtn = e.target.closest(".btn-timeline-share");
      if (shareBtn) {
        const idx = parseInt(shareBtn.dataset.index, 10);
        if (_allPhotos[idx]) sharePhoto(_allPhotos[idx]);
        return;
      }

      // Photo tap → open lightbox
      const photoEl = e.target.closest(".palgram-photo");
      if (photoEl) {
        const idx = parseInt(photoEl.dataset.index, 10);
        if (typeof LightboxModule !== "undefined" && _allPhotos[idx]) {
          LightboxModule.setPhotos(_allPhotos);
          LightboxModule.open(idx);
        }
        return;
      }
    });

    // Kick lazy loading for new images
    if (typeof LazyLoad !== "undefined") LazyLoad.refresh();
  }

  /**
   * Initialise the palgram feed.
   * @param {Array} ownPhotos - The user's own photos from photos.json
   * @param {Object} ownProfile - The user's own profile object
   */
  async function init(ownPhotos, ownProfile) {
    if (_initialised) return;
    _initialised = true;

    // Tag own photos so they render with local paths
    const own = (ownPhotos || []).map((p) => ({
      ...p,
      _palUsername: ownProfile.username || "you",
      _palAvatar: ownProfile.profilePhoto || "assets/profile.jpg",
      _palBaseUrl: "", // empty = local
    }));

    // Load pals config
    let pals = [];
    try {
      const res = await fetch(PALS_URL, { cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        pals = data.pals || [];
      }
    } catch (e) {
      console.warn("Palgram: could not load pals.json", e);
    }

    // Fetch all pals' photos in parallel
    const palResults = await Promise.all(pals.map((pal) => fetchPal(pal.url)));

    // Merge and sort newest-first
    _allPhotos = own.concat(palResults.flat());
    _allPhotos.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    render();
  }

  return { init };
})();
