/**
 * app.js – Entry point. Loads photo data and initialises all modules.
 */

(async function () {
  "use strict";

  const DATA_URL = "data/photos.json";

  // ---- Load JSON ----
  let data = {};
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error("Failed to load photo data:", err);
    return;
  }

  const photos = data.photos || [];
  const profile = data.profile || {};

  // ---- Populate profile header from JSON ----
  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value || "";
    });
  }

  if (profile.username) {
    setText(".username", profile.username);
    setText(".username-sm", profile.username);
    // Update nav brand with username (truncated for mobile)
    const navUsername = document.querySelector(".nav-username");
    if (navUsername) {
      const MAX_NAV_CHARS = 18;
      navUsername.textContent = profile.username.length > MAX_NAV_CHARS
        ? profile.username.slice(0, MAX_NAV_CHARS) + "\u2026"
        : profile.username;
    }
  }
  if (profile.fullName) setText(".full-name", profile.fullName);
  if (profile.bio) setText(".bio-text", profile.bio);
  if (profile.bioLink) {
    document.querySelectorAll(".bio-link").forEach((el) => {
      el.href = profile.bioLink;
      el.textContent = profile.bioLink.replace(/^https?:\/\//, "");
    });
  }
  if (profile.profilePhoto) {
    document.querySelectorAll(".profile-pic, .lightbox-info .rounded-circle, .timeline-card .card-header img").forEach((el) => {
      // Only update static profile images, not lazy-loaded ones
      if (!el.classList.contains("lazy")) {
        el.src = profile.profilePhoto;
      }
    });
  }

  // ---- Update post counts ----
  const count = photos.length;
  const el1 = document.getElementById("post-count");
  const el2 = document.getElementById("post-count-mobile");
  if (el1) el1.textContent = count;
  if (el2) el2.textContent = count;

  // ---- Populate Open Graph / Twitter Card meta tags ----
  const ogTitle = profile.username ? profile.username + " — mygram" : "mygram";
  const ogDesc = profile.bio || "Photo portfolio";
  const ogUrl = window.location.origin + window.location.pathname;
  const ogImage = photos.length > 0 ? ogUrl + "photos/web/" + photos[0].web : "";

  function setMeta(attr, key, value) {
    const el = document.querySelector("meta[" + attr + '="' + key + '"]');
    if (el && value) el.setAttribute("content", value);
  }

  setMeta("property", "og:title", ogTitle);
  setMeta("property", "og:description", ogDesc);
  setMeta("property", "og:url", ogUrl);
  setMeta("property", "og:image", ogImage);
  setMeta("name", "twitter:title", ogTitle);
  setMeta("name", "twitter:description", ogDesc);
  setMeta("name", "twitter:image", ogImage);
  document.title = ogTitle;

  // ---- Initialise modules ----
  if (typeof GridModule !== "undefined") GridModule.init(photos);
  if (typeof TimelineModule !== "undefined") TimelineModule.init(photos, profile);
  if (typeof LightboxModule !== "undefined") LightboxModule.init(photos, profile);
  if (typeof LazyLoad !== "undefined") LazyLoad.observe();

  // ---- Palgram: lazy-init on first switch ----
  let palgramLoaded = false;

  // ---- Nav view switching (mygram ↔ palgram) ----
  const profileHeader = document.getElementById("profile-header");
  const viewTabsContainer = document.querySelector("#viewTabs")?.closest(".container");
  const mygramContent = document.getElementById("mygram-content");
  const palgramView = document.getElementById("palgram-view");

  document.querySelectorAll(".nav-view-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.dataset.view;

      // Update active nav link
      document.querySelectorAll(".nav-view-link").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      if (view === "palgram") {
        // Hide profile header and mygram tabs/content
        if (profileHeader) profileHeader.classList.add("d-none");
        if (viewTabsContainer) viewTabsContainer.classList.add("d-none");
        if (mygramContent) mygramContent.classList.add("d-none");
        if (palgramView) palgramView.classList.remove("d-none");

        // Lazy-load palgram data on first visit
        if (!palgramLoaded && typeof PalgramModule !== "undefined") {
          palgramLoaded = true;
          PalgramModule.init(photos, profile);
        } else if (typeof LazyLoad !== "undefined") {
          LazyLoad.refresh();
        }
      } else {
        // Show profile header and mygram tabs/content
        if (profileHeader) profileHeader.classList.remove("d-none");
        if (viewTabsContainer) viewTabsContainer.classList.remove("d-none");
        if (mygramContent) mygramContent.classList.remove("d-none");
        if (palgramView) palgramView.classList.add("d-none");

        // Restore lightbox to local photos
        if (typeof LightboxModule !== "undefined") LightboxModule.setPhotos(photos);
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // ---- Refresh lazy-load & scroll-to-top when switching tabs ----
  document.querySelectorAll('#viewTabs button[data-bs-toggle="tab"]').forEach((tab) => {
    tab.addEventListener("shown.bs.tab", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (typeof LazyLoad !== "undefined") LazyLoad.refresh();
    });
  });
})();
