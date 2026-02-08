/**
 * timeline.js – Renders a vertical feed of photos (Instagram-style cards).
 */

// eslint-disable-next-line no-unused-vars
const TimelineModule = (() => {
  "use strict";

  const WEB_DIR = "photos/web/";
  let _photos = [];
  let _username = "username";

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
    const url = window.location.origin + window.location.pathname + "#photo=" + slugFor(photo);
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

  function showToast(message) {
    const toast = document.getElementById("shareToast");
    const body = document.getElementById("shareToastBody");
    if (!toast || !body) return;
    body.textContent = message;
    const bsToast = new bootstrap.Toast(toast, { delay: 2000 });
    bsToast.show();
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function createCard(photo, index) {
    const card = document.createElement("div");
    card.className = "timeline-card";

    card.innerHTML = `
      <div class="card-header">
        <img src="assets/profile.jpg" alt="">
        <div>
          <strong class="d-block username-sm">${_username}</strong>
          ${photo.location ? `<small class="text-muted">${photo.location}</small>` : ""}
        </div>
      </div>
      <img
        class="card-img lazy"
        data-src="${WEB_DIR}${photo.web}"
        alt="${photo.caption || ""}"
      >
      <div class="card-actions">
        <button class="btn-timeline-share" data-index="${index}" aria-label="Share">
          <i class="bi bi-send"></i>
        </button>
      </div>
      <div class="card-body">
        ${photo.caption ? `<p class="mb-1"><strong class="username-sm">${_username}</strong> ${photo.caption}</p>` : ""}
        <p class="card-meta mb-0">${formatDate(photo.date)}</p>
        ${photo.camera ? `<p class="card-meta mb-0">${photo.camera}</p>` : ""}
      </div>
    `;

    return card;
  }

  function init(photos, profile) {
    _photos = photos;
    if (profile && profile.username) _username = profile.username;
    const timeline = document.getElementById("photoTimeline");
    if (!timeline) return;

    // Empty state
    if (photos.length === 0) {
      timeline.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-camera"></i>
          <p class="h6">No Posts Yet</p>
          <p class="small">Add photos to <code>photos/originals/</code> and run the processing script.</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    let lastMonthKey = "";

    photos.forEach((photo, i) => {
      // Insert month/year divider when the month changes
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
    timeline.appendChild(fragment);

    // Share button click delegation
    timeline.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-timeline-share");
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      if (_photos[idx]) sharePhoto(_photos[idx]);
    });
  }

  /** Return e.g. "February 2026" from an ISO date string */
  function getMonthKey(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }

  return { init };
})();
