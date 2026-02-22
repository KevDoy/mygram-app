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

  // ---- Desktop: move bubble elements into header bar ----
  const desktopHeader = document.getElementById("desktopHeader");
  const desktopProfileWrap = document.getElementById("desktopProfileWrap");
  const desktopNavsWrap = document.getElementById("desktopNavsWrap");

  // ---- Profile Bubble ----
  const profileBubble = document.getElementById("profileBubble");
  const profileZone = document.getElementById("profileZone");
  const bubblePic = profileBubble?.querySelector(".profile-bubble-pic");
  const bubbleIcon = profileBubble?.querySelector(".profile-bubble-icon");
  const bubbleName = profileBubble?.querySelector(".profile-bubble-name");

  // Create dismiss overlay
  const bubbleOverlay = document.createElement("div");
  bubbleOverlay.className = "profile-bubble-overlay";
  document.body.appendChild(bubbleOverlay);

  let currentView = "mygram";
  const isMobile = window.matchMedia("(max-width: 767.98px)").matches;

  // Track whether the bubble has been auto-collapsed by scrolling
  // Once collapsed by scroll, it only re-expands via tap
  let bubbleAutoCollapsed = false;

  // On mobile grid view, start the bubble expanded with the profile zone visible
  if (isMobile && profileBubble && profileZone) {
    profileBubble.classList.add("expanded");
    // Don't show overlay for initial expanded state
  }

  if (profileBubble) {
    profileBubble.addEventListener("click", (e) => {
      e.stopPropagation();
      // No interaction in palgram mode
      if (currentView === "palgram") return;
      // Don't toggle if they tapped a link inside expanded
      if (e.target.closest(".profile-bubble-link")) return;
      profileBubble.classList.toggle("expanded");
      // Only show overlay on mobile
      if (isMobile) {
        bubbleOverlay.classList.toggle("active", profileBubble.classList.contains("expanded"));
      }
    });

    bubbleOverlay.addEventListener("click", () => {
      profileBubble.classList.remove("expanded");
      bubbleOverlay.classList.remove("active");
    });
  }

  // ---- Mobile: auto-collapse bubble on scroll, collapse profile zone ----
  if (isMobile && profileBubble && profileZone) {
    let scrollTicking = false;

    window.addEventListener("scroll", () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        // Only act if we haven't already auto-collapsed
        if (bubbleAutoCollapsed) return;
        // Only act in mygram view with grid tab active
        if (currentView !== "mygram") return;
        const gridTab = document.getElementById("grid-tab");
        if (gridTab && !gridTab.classList.contains("active")) return;

        if (window.scrollY > 10) {
          // Auto-collapse the bubble
          profileBubble.classList.remove("expanded");
          bubbleOverlay.classList.remove("active");
          // Collapse the profile zone
          profileZone.classList.add("collapsed");
          bubbleAutoCollapsed = true;
        }
      });
    }, { passive: true });
  }

  // ---- Helper: update padding class for current tab ----
  function updateContentPadding() {
    if (!mygramContent || !isMobile) return;
    const gridTab = document.getElementById("grid-tab");
    const isGrid = gridTab && gridTab.classList.contains("active");
    if (isGrid) {
      mygramContent.classList.remove("view-needs-padding");
    } else {
      mygramContent.classList.add("view-needs-padding");
    }
  }

  // ---- Helper: update profile zone visibility for current tab ----
  function updateProfileZone() {
    if (!profileZone || !isMobile) return;
    const gridTab = document.getElementById("grid-tab");
    const isGrid = gridTab && gridTab.classList.contains("active");
    if (isGrid && currentView === "mygram" && !bubbleAutoCollapsed) {
      profileZone.classList.remove("collapsed");
      profileZone.style.display = "";
    } else {
      profileZone.classList.add("collapsed");
    }
  }

  // ---- Update bubble for current view ----
  function updateBubble(view) {
    if (!profileBubble) return;
    currentView = view;
    // Only collapse on mobile; desktop stays expanded
    if (isMobile) {
      profileBubble.classList.remove("expanded");
      bubbleOverlay.classList.remove("active");
    }
    if (view === "palgram") {
      profileBubble.classList.add("palgram-mode");
      // Show collapsed pill with "palgram" title on both mobile and desktop
      profileBubble.classList.remove("expanded");
      if (bubblePic) bubblePic.style.display = "none";
      if (bubbleIcon) bubbleIcon.style.display = "";
      if (bubbleName) bubbleName.textContent = "palgram";
      // Hide profile zone in palgram
      if (profileZone) profileZone.classList.add("collapsed");
    } else {
      profileBubble.classList.remove("palgram-mode");
      if (bubblePic) bubblePic.style.display = "";
      if (bubbleIcon) bubbleIcon.style.display = "none";
      if (bubbleName) bubbleName.textContent = profile?.username || "username";
      // On desktop, expand if at top of page
      if (!isMobile && window.scrollY <= 10) {
        profileBubble.classList.add("expanded");
      }
      updateProfileZone();
    }
    updateContentPadding();
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
      updateContentPadding();
      updateProfileZone();
    });
  });

  // Set initial padding state
  updateContentPadding();

  // ---- Bubble Nav (mygram/palgram toggle) ----
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

  // ---- Desktop: reparent bubbles into the header bar, always expanded ----
  if (!isMobile && desktopHeader) {
    // Move profile bubble into desktop header
    if (profileBubble && desktopProfileWrap) {
      desktopProfileWrap.appendChild(profileBubble);
      profileBubble.classList.add("expanded");
    }

    // Move both nav bubbles into the grouped navs wrapper
    if (bubbleViewNav && desktopNavsWrap) {
      desktopNavsWrap.appendChild(bubbleViewNav);
      bubbleViewNav.classList.add("expanded");
      bubbleViewNav.style.display = "";
    }

    if (bubbleNav && desktopNavsWrap) {
      desktopNavsWrap.appendChild(bubbleNav);
      bubbleNav.classList.add("expanded");
    }

    // ---- Sync body padding with fixed header height ----
    function syncHeaderPadding() {
      const h = desktopHeader.offsetHeight;
      document.body.style.paddingTop = h + "px";
    }
    // Initial sync (after a frame so the DOM has settled)
    requestAnimationFrame(syncHeaderPadding);

    // Re-sync when profile bubble transitions finish (expand/collapse changes height)
    if (profileBubble) {
      profileBubble.addEventListener("transitionend", syncHeaderPadding);
    }

    // On desktop, view bubble clicks switch tabs directly (no expand/collapse cycle)
    if (bubbleViewNav) {
      const viewBtnsDesktop = bubbleViewNav.querySelectorAll(".bubble-btn-view");
      viewBtnsDesktop.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopImmediatePropagation();
          const tabId = btn.dataset.viewTab;
          const tabEl = document.getElementById(tabId);
          if (tabEl) {
            const bsTab = new bootstrap.Tab(tabEl);
            bsTab.show();
          }
          viewBtnsDesktop.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          // Keep it expanded on desktop
          bubbleViewNav.classList.add("expanded");
        }, true); // capture phase to run before the mobile handler
      });
    }

    // On desktop, mygram/palgram clicks switch directly (no expand/collapse cycle)
    if (bubbleNav && bubbleGallery && bubblePalgram) {
      function desktopNavClick(targetView, targetBtn, otherBtn) {
        return (e) => {
          e.stopImmediatePropagation();
          switchView(targetView);
          targetBtn.classList.add("active");
          otherBtn.classList.remove("active");
          // Keep expanded on desktop
          bubbleNav.classList.add("expanded");
          // Re-show view nav if switching back to mygram
          if (bubbleViewNav) {
            bubbleViewNav.style.display = targetView === "palgram" ? "none" : "";
          }
          // Re-sync padding after view switch
          requestAnimationFrame(syncHeaderPadding);
        };
      }

      bubbleGallery.addEventListener("click", desktopNavClick("mygram", bubbleGallery, bubblePalgram), true);
      bubblePalgram.addEventListener("click", desktopNavClick("palgram", bubblePalgram, bubbleGallery), true);
    }

    // ---- Desktop scroll: collapse profile on scroll, re-expand at top ----
    let desktopScrollTicking = false;
    let desktopProfileCollapsed = false;

    window.addEventListener("scroll", () => {
      if (desktopScrollTicking) return;
      desktopScrollTicking = true;
      requestAnimationFrame(() => {
        desktopScrollTicking = false;
        if (!profileBubble) return;
        // Only manage profile collapse in mygram view
        if (currentView !== "mygram") return;

        if (window.scrollY > 10 && !desktopProfileCollapsed) {
          profileBubble.classList.remove("expanded");
          desktopProfileCollapsed = true;
          requestAnimationFrame(syncHeaderPadding);
        } else if (window.scrollY <= 10 && desktopProfileCollapsed) {
          profileBubble.classList.add("expanded");
          desktopProfileCollapsed = false;
          requestAnimationFrame(syncHeaderPadding);
        }
      });
    }, { passive: true });
  }

  // ---- Secret Palgram settings: 10-tap easter egg ----
  (function initSecretSettings() {
    const STORAGE_KEY = 'mygram_default_view';
    let tapCount = 0;
    let tapTimer = null;
    const TAP_RESET_MS = 2000; // reset counter after 2s of inactivity

    const overlay = document.getElementById('secretModalOverlay');
    const setBtn = document.getElementById('secretSetDefault');
    const resetBtn = document.getElementById('secretResetDefault');
    const closeBtn = document.getElementById('secretClose');
    const statusEl = document.getElementById('secretStatus');

    if (!overlay || !profileBubble) return;

    // Listen for taps on the palgram bubble title
    profileBubble.addEventListener('click', () => {
      // Only count taps when showing palgram title
      if (currentView !== 'palgram') return;
      tapCount++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, TAP_RESET_MS);
      if (tapCount >= 10) {
        tapCount = 0;
        clearTimeout(tapTimer);
        openSecretModal();
      }
    });

    function openSecretModal() {
      const hasDefault = localStorage.getItem(STORAGE_KEY) === 'palgram';
      // Update button visibility
      setBtn.classList.toggle('d-none', hasDefault);
      resetBtn.classList.toggle('d-none', !hasDefault);
      statusEl.classList.add('d-none');
      overlay.classList.remove('d-none');
    }

    function closeModal() {
      overlay.classList.add('d-none');
    }

    function showStatus(msg) {
      statusEl.textContent = msg;
      statusEl.classList.remove('d-none');
    }

    setBtn.addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY, 'palgram');
      showStatus('\u2713 Palgram is now the default view');
      setBtn.classList.add('d-none');
      resetBtn.classList.remove('d-none');
    });

    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      showStatus('\u2713 Default view reset to mygram');
      resetBtn.classList.add('d-none');
      setBtn.classList.remove('d-none');
    });

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  })();

  // ---- Auto-switch to palgram if ?view=palgram or localStorage default ----
  // Placed at the end so all switchView wrapping and DOM reparenting is complete.
  const urlParams = new URLSearchParams(window.location.search);
  const savedDefault = localStorage.getItem('mygram_default_view');
  if (urlParams.get('view') === 'palgram' || savedDefault === 'palgram') {
    switchView('palgram');
    // Sync bubble nav active states
    const bubbleGal = document.getElementById('bubbleGallery');
    const bubblePal = document.getElementById('bubblePalgram');
    if (bubbleGal) bubbleGal.classList.remove('active');
    if (bubblePal) bubblePal.classList.add('active');
  }
})();
