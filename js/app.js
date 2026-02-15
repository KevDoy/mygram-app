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
  const albums = data.albums || [];

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
  if (typeof AlbumsModule !== "undefined") AlbumsModule.init(photos, albums);
  if (typeof LazyLoad !== "undefined") LazyLoad.observe();

  // ---- Palgram: lazy-init on first switch ----
  let palgramLoaded = false;

  // ---- Nav view switching (mygram ↔ palgram) ----
  const profileHeader = document.getElementById("profile-header");
  const viewTabsContainer = document.querySelector("#viewTabs")?.closest(".container");
  const mygramContent = document.getElementById("mygram-content");
  const palgramView = document.getElementById("palgram-view");

  // ---- Mobile Profile Bubble ----
  const profileBubble = document.getElementById("profileBubble");
  const bubblePic = profileBubble?.querySelector(".profile-bubble-pic");
  const bubbleIcon = profileBubble?.querySelector(".profile-bubble-icon");
  const bubbleName = profileBubble?.querySelector(".profile-bubble-name");

  // Create dismiss overlay
  const bubbleOverlay = document.createElement("div");
  bubbleOverlay.className = "profile-bubble-overlay";
  document.body.appendChild(bubbleOverlay);

  let currentView = "mygram";

  if (profileBubble) {
    profileBubble.addEventListener("click", (e) => {
      e.stopPropagation();
      // No interaction in palgram mode
      if (currentView === "palgram") return;
      // Don't toggle if they tapped a link inside expanded
      if (e.target.closest(".profile-bubble-link")) return;
      profileBubble.classList.toggle("expanded");
      bubbleOverlay.classList.toggle("active", profileBubble.classList.contains("expanded"));
    });

    bubbleOverlay.addEventListener("click", () => {
      profileBubble.classList.remove("expanded");
      bubbleOverlay.classList.remove("active");
    });
  }

  // ---- Update bubble for current view ----
  function updateBubble(view) {
    if (!profileBubble) return;
    currentView = view;
    profileBubble.classList.remove("expanded");
    bubbleOverlay.classList.remove("active");
    if (view === "palgram") {
      profileBubble.classList.add("palgram-mode");
      if (bubblePic) bubblePic.style.display = "none";
      if (bubbleIcon) bubbleIcon.style.display = "";
      if (bubbleName) bubbleName.textContent = "palgram";
    } else {
      profileBubble.classList.remove("palgram-mode");
      if (bubblePic) bubblePic.style.display = "";
      if (bubbleIcon) bubbleIcon.style.display = "none";
      if (bubbleName) bubbleName.textContent = profile?.username || "username";
    }
  }

  // ---- Shared view-switching function ----
  function switchView(view) {
    // Update desktop nav links
    document.querySelectorAll(".nav-view-link").forEach((l) => {
      l.classList.toggle("active", l.dataset.view === view);
    });

    // Update bubble content
    updateBubble(view);

    if (view === "palgram") {
      if (profileHeader) profileHeader.classList.add("d-none");
      if (viewTabsContainer) viewTabsContainer.classList.add("d-none");
      if (mygramContent) mygramContent.classList.add("d-none");
      if (palgramView) palgramView.classList.remove("d-none");
      if (!palgramLoaded && typeof PalgramModule !== "undefined") {
        palgramLoaded = true;
        PalgramModule.init(photos, profile);
      } else if (typeof LazyLoad !== "undefined") {
        LazyLoad.refresh();
      }
    } else {
      if (profileHeader) profileHeader.classList.remove("d-none");
      if (viewTabsContainer) viewTabsContainer.classList.remove("d-none");
      if (mygramContent) mygramContent.classList.remove("d-none");
      if (palgramView) palgramView.classList.add("d-none");
      if (typeof LightboxModule !== "undefined") LightboxModule.setPhotos(photos);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Desktop nav links
  document.querySelectorAll(".nav-view-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      switchView(link.dataset.view);
    });
  });

  // ---- Refresh lazy-load & scroll-to-top when switching tabs ----
  document.querySelectorAll('#viewTabs button[data-bs-toggle="tab"]').forEach((tab) => {
    tab.addEventListener("shown.bs.tab", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (typeof LazyLoad !== "undefined") LazyLoad.refresh();
    });
  });

  // ---- Mobile Bubble Nav ----
  const bubbleNav = document.getElementById("bubbleNav");
  const bubbleGallery = document.getElementById("bubbleGallery");
  const bubblePalgram = document.getElementById("bubblePalgram");

  if (bubbleNav && bubbleGallery && bubblePalgram) {
    // Collapsed: tap the visible (active) icon → expand
    // Expanded: tap either icon → switch to that view & collapse

    function handleBubbleClick(targetView, targetBtn, otherBtn) {
      if (!bubbleNav.classList.contains("expanded")) {
        // Only the active button is visible when collapsed; expand
        bubbleNav.classList.add("expanded");
      } else {
        // Switch to the tapped view
        switchView(targetView);
        targetBtn.classList.add("active");
        otherBtn.classList.remove("active");
        bubbleNav.classList.remove("expanded");
      }
    }

    bubbleGallery.addEventListener("click", () => {
      handleBubbleClick("mygram", bubbleGallery, bubblePalgram);
    });

    bubblePalgram.addEventListener("click", () => {
      handleBubbleClick("palgram", bubblePalgram, bubbleGallery);
    });

    // Close bubble if user taps outside
    document.addEventListener("click", (e) => {
      if (bubbleNav.classList.contains("expanded") && !bubbleNav.contains(e.target)) {
        bubbleNav.classList.remove("expanded");
      }
    });
  }


  // ---- Mobile View Bubble Nav (right side: grid / timeline / albums) ----
  const bubbleViewNav = document.getElementById("bubbleViewNav");
  if (bubbleViewNav) {
    const viewBtns = bubbleViewNav.querySelectorAll(".bubble-btn-view");

    viewBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!bubbleViewNav.classList.contains("expanded")) {
          // Only the active button is visible; expand to show all
          bubbleViewNav.classList.add("expanded");
        } else {
          // Activate the corresponding Bootstrap tab
          const tabId = btn.dataset.viewTab;
          const tabEl = document.getElementById(tabId);
          if (tabEl) {
            const bsTab = new bootstrap.Tab(tabEl);
            bsTab.show();
          }
          // Update active state on bubble buttons
          viewBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          bubbleViewNav.classList.remove("expanded");
        }
      });
    });

    // Close if user taps outside
    document.addEventListener("click", (e) => {
      if (bubbleViewNav.classList.contains("expanded") && !bubbleViewNav.contains(e.target)) {
        bubbleViewNav.classList.remove("expanded");
      }
    });

    // Hide view bubble when palgram is active, show when mygram
    const origSwitchView = switchView;
    switchView = function (view) {
      origSwitchView(view);
      if (view === "palgram") {
        bubbleViewNav.style.display = "none";
      } else {
        bubbleViewNav.style.display = "";
      }
    };
  }
})();
