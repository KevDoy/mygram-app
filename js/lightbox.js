/**
 * lightbox.js – Full-screen photo viewer with deep-linking and share.
 *
 * URL scheme:  #photo=<slug>
 * On open/navigate the hash updates. On page load if hash is present
 * the lightbox opens automatically.
 */

// eslint-disable-next-line no-unused-vars
const LightboxModule = (() => {
  "use strict";

  const WEB_DIR = "photos/web/";
  let _photos = [];
  let _currentIndex = 0;
  let _modal = null;
  let _suppressHashChange = false;
  let _profile = {};
  let _postPageOpen = false;

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /** Derive a slug at runtime (fallback if slug field missing) */
  function slugFor(photo) {
    if (photo.slug) return photo.slug;
    return photo.filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /** Find photo index by slug */
  function indexBySlug(slug) {
    return _photos.findIndex((p) => slugFor(p) === slug);
  }

  /** Update address-bar hash without triggering hashchange handler */
  function setHash(slug) {
    _suppressHashChange = true;
    history.replaceState(null, "", "#photo=" + slug);
    // Reset flag on next tick so future hashchange events work
    requestAnimationFrame(() => (_suppressHashChange = false));
  }

  function clearHash() {
    _suppressHashChange = true;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    requestAnimationFrame(() => (_suppressHashChange = false));
  }

  function show(index) {
    if (index < 0 || index >= _photos.length) return;
    _currentIndex = index;
    const photo = _photos[index];
    const isLocal = !photo._palBaseUrl;

    // Image source (local vs pal)
    const media = (typeof CarouselFactory !== "undefined") ? CarouselFactory.getMedia(photo) : [{ type: "image", web: photo.web, thumbnail: photo.thumbnail }];
    const photoEl = document.getElementById("lightboxPhoto");
    const mediaWrap = photoEl.parentElement;

    // Clean up previous carousel / video
    const prevCarousel = mediaWrap.querySelector(".media-carousel");
    if (prevCarousel) prevCarousel.remove();
    const prevVideo = mediaWrap.querySelector("video");
    if (prevVideo) { prevVideo.pause(); prevVideo.remove(); }

    const baseUrl = isLocal ? "" : photo._palBaseUrl;

    if (media.length > 1 && typeof CarouselFactory !== "undefined") {
      // Multi-photo carousel
      photoEl.classList.add("d-none");
      const carousel = CarouselFactory.create(media, {
        baseUrl,
        alt: photo.caption || "",
        className: "lightbox-carousel",
        imgClass: "img-fluid lightbox-photo"
      });
      mediaWrap.appendChild(carousel);
    } else if (media[0] && media[0].type === "video") {
      // Video post
      photoEl.classList.add("d-none");
      const video = document.createElement("video");
      video.src = (baseUrl ? baseUrl + "photos/web/" : WEB_DIR) + media[0].web;
      if (media[0].poster) video.poster = (baseUrl ? baseUrl + "photos/web/" : WEB_DIR) + media[0].poster;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.className = "img-fluid lightbox-photo";
      if (!isLocal) video.setAttribute("crossorigin", "anonymous");
      mediaWrap.appendChild(video);
    } else {
      // Single image (existing behavior)
      photoEl.classList.remove("d-none");
      const imgSrc = isLocal
        ? WEB_DIR + photo.web
        : photo._palBaseUrl + "photos/web/" + photo.web;
      photoEl.src = imgSrc;
      photoEl.alt = photo.caption || "";
      if (!isLocal) photoEl.setAttribute("crossorigin", "anonymous");
      else photoEl.removeAttribute("crossorigin");
    }

    // Update lightbox header (avatar + username)
    const avatarEl = document.querySelector(".lightbox-info .rounded-circle");
    const usernameEl = document.querySelector(".lightbox-info .username-sm");
    if (avatarEl) {
      avatarEl.src = photo._palAvatar || _profile.profilePhoto || "assets/profile.jpg";
      if (!isLocal) avatarEl.setAttribute("crossorigin", "anonymous");
      else avatarEl.removeAttribute("crossorigin");
    }
    if (usernameEl) {
      usernameEl.textContent = photo._palUsername || _profile.username || "username";
    }

    const captionEl = document.getElementById("lightboxCaption");
    if (typeof MentionsModule !== "undefined" && photo.caption) {
      captionEl.innerHTML = MentionsModule.linkify(photo.caption);
    } else {
      captionEl.textContent = photo.caption || "";
    }
    document.getElementById("lightboxDate").textContent = formatDate(photo.date);

    // Build metadata block
    const metaParts = [];
    if (photo.camera) metaParts.push(`<i class="bi bi-camera me-1"></i>${photo.camera}`);
    if (photo.lens) metaParts.push(`<i class="bi bi-aperture me-1"></i>${photo.lens}`);
    if (photo.settings) metaParts.push(`<i class="bi bi-sliders me-1"></i>${photo.settings}`);
    if (photo.location) metaParts.push(`<i class="bi bi-geo-alt me-1"></i>${photo.location}`);
    document.getElementById("lightboxMeta").innerHTML = metaParts.join("<br>");

    // "View on pal's app" button
    const viewPalBtn = document.getElementById("lightboxViewPal");
    if (viewPalBtn) {
      if (!isLocal && photo._palBaseUrl) {
        viewPalBtn.href = photo._palBaseUrl + "#photo=" + slugFor(photo);
        viewPalBtn.innerHTML = `<i class="bi bi-box-arrow-up-right me-1"></i>View on ${photo._palUsername}'s app`;
        viewPalBtn.classList.remove("d-none");
      } else {
        viewPalBtn.classList.add("d-none");
      }
    }

    // Toggle nav button visibility
    document.getElementById("lightboxPrev").style.display = index > 0 ? "" : "none";
    document.getElementById("lightboxNext").style.display = index < _photos.length - 1 ? "" : "none";

    // Update URL hash (only for local photos)
    if (isLocal) {
      setHash(slugFor(photo));
    } else {
      clearHash();
    }

    // Preload adjacent photos
    preload(index - 1);
    preload(index + 1);
  }

  /** Preload a photo by index (no-op if out of range) */
  function preload(index) {
    if (index < 0 || index >= _photos.length) return;
    const photo = _photos[index];
    const isLocal = !photo._palBaseUrl;
    const img = new Image();
    img.src = isLocal
      ? WEB_DIR + photo.web
      : photo._palBaseUrl + "photos/web/" + photo.web;
  }

  /** Check if viewport is mobile-sized */
  function isMobile() {
    return window.innerWidth < 768;
  }

  /** Populate the mobile post page with photo data */
  function showPostPage(index) {
    if (index < 0 || index >= _photos.length) return;
    _currentIndex = index;
    const photo = _photos[index];
    const isLocal = !photo._palBaseUrl;
    const media = (typeof CarouselFactory !== "undefined") ? CarouselFactory.getMedia(photo) : [{ type: "image", web: photo.web, thumbnail: photo.thumbnail }];

    const postPage = document.getElementById("postPage");
    const photoEl = document.getElementById("postPagePhoto");
    const photoWrap = document.querySelector(".post-page-photo-wrap");

    // Clean up previous carousel / video in post page
    const prevCarousel = photoWrap.querySelector(".media-carousel");
    if (prevCarousel) prevCarousel.remove();
    const prevVideo = photoWrap.querySelector("video");
    if (prevVideo) { prevVideo.pause(); prevVideo.remove(); }

    const baseUrl = isLocal ? "" : photo._palBaseUrl;

    if (media.length > 1 && typeof CarouselFactory !== "undefined") {
      photoEl.classList.add("d-none");
      const carousel = CarouselFactory.create(media, {
        baseUrl,
        alt: photo.caption || "",
        className: "post-page-carousel",
        imgClass: "post-page-photo"
      });
      photoWrap.appendChild(carousel);
    } else if (media[0] && media[0].type === "video") {
      photoEl.classList.add("d-none");
      const video = document.createElement("video");
      video.src = (baseUrl ? baseUrl + "photos/web/" : WEB_DIR) + media[0].web;
      if (media[0].poster) video.poster = (baseUrl ? baseUrl + "photos/web/" : WEB_DIR) + media[0].poster;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.className = "post-page-photo";
      if (!isLocal) video.setAttribute("crossorigin", "anonymous");
      photoWrap.appendChild(video);
    } else {
      photoEl.classList.remove("d-none");
      const imgSrc = isLocal
        ? WEB_DIR + photo.web
        : photo._palBaseUrl + "photos/web/" + photo.web;
      photoEl.src = imgSrc;
      photoEl.alt = photo.caption || "";
      if (!isLocal) photoEl.setAttribute("crossorigin", "anonymous");
      else photoEl.removeAttribute("crossorigin");
    }

    // Avatar + username in header
    const avatarEl = postPage.querySelector(".post-page-avatar");
    if (avatarEl) {
      avatarEl.src = photo._palAvatar || _profile.profilePhoto || "assets/profile.jpg";
      if (!isLocal) avatarEl.setAttribute("crossorigin", "anonymous");
      else avatarEl.removeAttribute("crossorigin");
    }
    const headerUsername = postPage.querySelector(".post-page-username");
    if (headerUsername) {
      headerUsername.textContent = photo._palUsername || _profile.username || "username";
    }
    const captionUsername = postPage.querySelector(".post-page-username-caption");
    if (captionUsername) {
      captionUsername.textContent = photo._palUsername || _profile.username || "username";
    }

    const captionEl = document.getElementById("postPageCaption");
    const captionWrap = document.getElementById("postPageCaptionWrap");
    if (photo.caption) {
      if (typeof MentionsModule !== "undefined") {
        captionEl.innerHTML = MentionsModule.linkify(photo.caption);
      } else {
        captionEl.textContent = photo.caption;
      }
      if (captionWrap) captionWrap.classList.remove("d-none");
    } else {
      captionEl.textContent = "";
      if (captionWrap) captionWrap.classList.add("d-none");
    }

    document.getElementById("postPageDate").textContent = formatDate(photo.date);

    // Metadata
    const metaParts = [];
    if (photo.camera) metaParts.push(`<i class="bi bi-camera me-1"></i>${photo.camera}`);
    if (photo.lens) metaParts.push(`<i class="bi bi-aperture me-1"></i>${photo.lens}`);
    if (photo.settings) metaParts.push(`<i class="bi bi-sliders me-1"></i>${photo.settings}`);
    if (photo.location) metaParts.push(`<i class="bi bi-geo-alt me-1"></i>${photo.location}`);
    document.getElementById("postPageMeta").innerHTML = metaParts.join("<br>");

    // View pal button
    const viewPalBtn = document.getElementById("postPageViewPal");
    if (viewPalBtn) {
      if (!isLocal && photo._palBaseUrl) {
        viewPalBtn.href = photo._palBaseUrl + "#photo=" + slugFor(photo);
        viewPalBtn.innerHTML = `<i class="bi bi-box-arrow-up-right me-1"></i>View on ${photo._palUsername}'s app`;
        viewPalBtn.classList.remove("d-none");
      } else {
        viewPalBtn.classList.add("d-none");
      }
    }

    // Update hash with replaceState (don't push new history entry)
    if (isLocal) {
      setHash(slugFor(photo));
    } else {
      clearHash();
    }

    // Preload adjacent
    preload(index - 1);
    preload(index + 1);
  }

  /** Open mobile post page with slide-in animation */
  function openPostPage(index, { fromHash = false } = {}) {
    const postPage = document.getElementById("postPage");
    postPage.classList.remove("d-none", "closing", "opening");
    void postPage.offsetWidth; // force reflow for animation restart
    postPage.classList.add("opening");
    postPage.addEventListener("animationend", function handler() {
      postPage.removeEventListener("animationend", handler);
      postPage.classList.remove("opening");
    });

    showPostPage(index);
    _postPageOpen = true;
    document.body.style.overflow = "hidden";

    const photo = _photos[index];
    const slug = slugFor(photo);
    if (fromHash) {
      // Deep-linked: set a clean base state, then push hash
      history.replaceState(null, "", window.location.pathname + window.location.search);
      history.pushState({ postPage: true }, "", "#photo=" + slug);
    } else {
      history.pushState({ postPage: true }, "", "#photo=" + slug);
    }
  }

  /** Close mobile post page with slide-out animation */
  function closePostPage() {
    _postPageOpen = false;
    document.body.style.overflow = "";
    const postPage = document.getElementById("postPage");
    // Pause any playing videos
    postPage.querySelectorAll("video").forEach(v => v.pause());
    postPage.classList.remove("opening");
    postPage.classList.add("closing");
    postPage.addEventListener("animationend", function handler() {
      postPage.removeEventListener("animationend", handler);
      postPage.classList.add("d-none");
      postPage.classList.remove("closing");
    });
  }

  function open(index, opts = {}) {
    if (isMobile()) {
      openPostPage(index, opts);
    } else {
      show(index);
      _modal.show();
    }
  }

  /** Copy current photo URL to clipboard and show toast */
  function share() {
    const photo = _photos[_currentIndex];
    const isLocal = !photo._palBaseUrl;
    const url = isLocal
      ? window.location.origin + window.location.pathname + "#photo=" + slugFor(photo)
      : photo._palBaseUrl + "#photo=" + slugFor(photo);
    navigator.clipboard.writeText(url).then(() => {
      showToast("Link copied to clipboard");
    }).catch(() => {
      // Fallback for older browsers / non-HTTPS
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

  /** Open photo from URL hash if present */
  function checkHash() {
    const hash = window.location.hash;
    if (!hash.startsWith("#photo=")) return;
    const slug = hash.replace("#photo=", "");
    const idx = indexBySlug(slug);
    if (idx !== -1) open(idx, { fromHash: true });
  }

  function setPhotos(photos) {
    _photos = photos;
  }

  function init(photos, profile) {
    _photos = photos;
    _profile = profile || {};
    const modalEl = document.getElementById("lightboxModal");
    _modal = new bootstrap.Modal(modalEl);

    document.getElementById("lightboxPrev").addEventListener("click", () => show(_currentIndex - 1));
    document.getElementById("lightboxNext").addEventListener("click", () => show(_currentIndex + 1));

    // Share button
    const shareBtn = document.getElementById("lightboxShare");
    if (shareBtn) shareBtn.addEventListener("click", share);

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (!modalEl.classList.contains("show")) return;
      if (e.key === "ArrowLeft") show(_currentIndex - 1);
      if (e.key === "ArrowRight") show(_currentIndex + 1);
    });

    // Clear hash when modal is closed
    modalEl.addEventListener("hidden.bs.modal", clearHash);

    // ---- Swipe gesture support (mobile) ----
    let _touchStartX = 0;
    let _touchStartY = 0;
    let _touchDeltaX = 0;
    let _touchMoved = false;
    let _swiping = false;
    const SWIPE_THRESHOLD = 50;

    const photoContainer = modalEl.querySelector(".lightbox-photo-container");
    if (photoContainer) {
      photoContainer.addEventListener("touchstart", (e) => {
        // Skip if interacting with a carousel or video element
        if (e.target.closest('.media-carousel') || e.target.tagName === 'VIDEO') return;
        _touchStartX = e.changedTouches[0].screenX;
        _touchStartY = e.changedTouches[0].screenY;
        _touchDeltaX = 0;
        _touchMoved = false;
        _swiping = false;
      }, { passive: true });

      photoContainer.addEventListener("touchmove", (e) => {
        if (_pinching) return;
        _touchMoved = true;
        if (!_immersive) return;
        const dx = e.changedTouches[0].screenX - _touchStartX;
        const dy = e.changedTouches[0].screenY - _touchStartY;
        // Lock into horizontal swipe once dominant direction established
        if (!_swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          _swiping = true;
        }
        if (_swiping) {
          _touchDeltaX = dx;
          const photoEl = document.getElementById("lightboxPhoto");
          photoEl.style.transition = "none";
          photoEl.style.transform = `translateX(${dx}px)`;
          photoEl.style.opacity = Math.max(0.4, 1 - Math.abs(dx) / 500);
        }
      }, { passive: true });

      photoContainer.addEventListener("touchend", (e) => {
        if (_pinching) return;
        if (!_touchMoved) return;
        const dx = e.changedTouches[0].screenX - _touchStartX;
        const dy = e.changedTouches[0].screenY - _touchStartY;

        // Immersive: animated horizontal swipe
        if (_immersive && _swiping && Math.abs(_touchDeltaX) > SWIPE_THRESHOLD) {
          const photoEl = document.getElementById("lightboxPhoto");
          const goNext = _touchDeltaX < 0;
          const nextIdx = goNext ? _currentIndex + 1 : _currentIndex - 1;
          if (nextIdx < 0 || nextIdx >= _photos.length) {
            // Snap back — no more photos in this direction
            photoEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
            photoEl.style.transform = "";
            photoEl.style.opacity = "";
            setTimeout(() => { photoEl.style.transition = ""; }, 200);
          } else {
            // Slide current photo off-screen
            const exitX = goNext ? "-100vw" : "100vw";
            photoEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
            photoEl.style.transform = `translateX(${exitX})`;
            photoEl.style.opacity = "0";
            setTimeout(() => {
              photoEl.style.transition = "none";
              // Position new photo from opposite side
              photoEl.style.transform = `translateX(${goNext ? "100vw" : "-100vw"})`;
              photoEl.style.opacity = "0";
              show(nextIdx);
              // Trigger reflow then animate in
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  photoEl.style.transition = "transform 0.25s ease, opacity 0.25s ease";
                  photoEl.style.transform = "";
                  photoEl.style.opacity = "";
                  setTimeout(() => { photoEl.style.transition = ""; }, 250);
                });
              });
            }, 200);
          }
          _swiping = false;
          return;
        }

        // Non-immersive: simple swipe threshold
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) show(_currentIndex + 1);
          else show(_currentIndex - 1);
        }

        // Reset immersive drag state if swipe wasn't completed
        if (_immersive && _swiping) {
          const photoEl = document.getElementById("lightboxPhoto");
          photoEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
          photoEl.style.transform = "";
          photoEl.style.opacity = "";
          setTimeout(() => { photoEl.style.transition = ""; }, 200);
        }
        _swiping = false;
      }, { passive: true });
    }

    // ---- Immersive landscape mode ----
    let _immersive = false;
    const orientationQuery = window.matchMedia("(orientation: landscape)");

    function enterImmersive() {
      if (_immersive) return;
      _immersive = true;
      modalEl.classList.add("lightbox-immersive");
    }

    function exitImmersive() {
      if (!_immersive) return;
      _immersive = false;
      modalEl.classList.remove("lightbox-immersive");
    }

    function handleOrientationChange(e) {
      if (!modalEl.classList.contains("show")) return;
      // Only activate on mobile-sized screens (coarse pointer = touch device)
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      if (!isTouch) return;
      if (e.matches) {
        enterImmersive();
      } else {
        exitImmersive();
      }
    }

    orientationQuery.addEventListener("change", handleOrientationChange);

    // Exit immersive when lightbox closes
    modalEl.addEventListener("hidden.bs.modal", () => {
      exitImmersive();
      // Clean up any playing videos in the lightbox
      const mediaWrap = modalEl.querySelector(".lightbox-photo-container");
      if (mediaWrap) {
        mediaWrap.querySelectorAll("video").forEach(v => v.pause());
      }
    });

    // Swipe-down to close in immersive mode
    // (reuses _touchStart* from the unified handler above)
    let _immSwipeDownDelta = 0;
    let _immSwipeDownTracking = false;
    const SWIPE_DOWN_THRESHOLD = 80;

    // ---- Pinch-to-zoom in immersive mode ----
    let _pinching = false;
    let _pinchStartDist = 0;
    let _pinchScale = 1;
    let _pinchMidX = 0;
    let _pinchMidY = 0;

    function pinchDist(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    if (photoContainer) {
      // Detect pinch start on touchstart (2 fingers)
      photoContainer.addEventListener("touchstart", (e) => {
        if (!_immersive) return;
        if (e.touches.length === 2) {
          _pinching = true;
          _swiping = false;
          _immSwipeDownTracking = false;
          _pinchStartDist = pinchDist(e.touches[0], e.touches[1]);
          _pinchScale = 1;
          _pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          _pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        }
      }, { passive: true });

      photoContainer.addEventListener("touchmove", (e) => {
        // Pinch zoom
        if (_immersive && _pinching && e.touches.length === 2) {
          const dist = pinchDist(e.touches[0], e.touches[1]);
          _pinchScale = Math.max(1, dist / _pinchStartDist);
          // Clamp to reasonable max
          _pinchScale = Math.min(_pinchScale, 4);
          const photoEl = document.getElementById("lightboxPhoto");
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const rect = photoEl.getBoundingClientRect();
          // Transform origin relative to photo element center
          const ox = midX - rect.left - rect.width / 2;
          const oy = midY - rect.top - rect.height / 2;
          photoEl.style.transition = "none";
          photoEl.style.transform = `scale(${_pinchScale})`;
          photoEl.style.transformOrigin = `${((midX - rect.left) / rect.width) * 100}% ${((midY - rect.top) / rect.height) * 100}%`;
          return;
        }

        // Swipe-down (only single-finger, non-pinch)
        if (!_immersive || _swiping || _pinching) return;
        const dy = e.changedTouches[0].screenY - _touchStartY;
        const dx = Math.abs(e.changedTouches[0].screenX - _touchStartX);
        // Only track downward-dominant drags
        if (dy > 10 && dy > dx) {
          _immSwipeDownTracking = true;
          _immSwipeDownDelta = dy;
          const opacity = Math.max(0.3, 1 - dy / 300);
          const photoEl = document.getElementById("lightboxPhoto");
          photoEl.style.transition = "none";
          photoEl.style.transform = `translateY(${dy}px)`;
          photoEl.style.opacity = opacity;
        }
      }, { passive: true });

      photoContainer.addEventListener("touchend", (e) => {
        // Pinch release — animate back to scale(1)
        if (_immersive && _pinching) {
          // Only reset when all fingers are lifted
          if (e.touches.length === 0) {
            _pinching = false;
            const photoEl = document.getElementById("lightboxPhoto");
            photoEl.style.transition = "transform 0.3s cubic-bezier(0.2, 0, 0, 1), transform-origin 0.3s ease";
            photoEl.style.transform = "scale(1)";
            setTimeout(() => {
              photoEl.style.transition = "";
              photoEl.style.transformOrigin = "";
            }, 300);
          }
          return;
        }

        // Swipe-down close
        if (!_immersive || !_immSwipeDownTracking) return;
        _immSwipeDownTracking = false;
        const photoEl = document.getElementById("lightboxPhoto");

        if (_immSwipeDownDelta > SWIPE_DOWN_THRESHOLD) {
          photoEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
          photoEl.style.transform = "translateY(100vh)";
          photoEl.style.opacity = "0";
          setTimeout(() => {
            _modal.hide();
            photoEl.style.transform = "";
            photoEl.style.opacity = "";
            photoEl.style.transition = "";
          }, 200);
        } else {
          photoEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
          photoEl.style.transform = "";
          photoEl.style.opacity = "";
          setTimeout(() => { photoEl.style.transition = ""; }, 200);
        }
        _immSwipeDownDelta = 0;
      }, { passive: true });
    }

    // Listen for back/forward navigation
    window.addEventListener("hashchange", () => {
      if (_suppressHashChange) return;
      const hash = window.location.hash;
      if (hash.startsWith("#photo=")) {
        const slug = hash.replace("#photo=", "");
        const idx = indexBySlug(slug);
        if (idx !== -1) {
          if (_postPageOpen) {
            showPostPage(idx);
          } else if (modalEl.classList.contains("show")) {
            show(idx);
          } else {
            open(idx);
          }
        }
      } else {
        if (_postPageOpen) {
          closePostPage();
        } else if (modalEl.classList.contains("show")) {
          _modal.hide();
        }
      }
    });

    // ---- Mobile Post Page event listeners ----
    const postPageBackBtn = document.getElementById("postPageBack");
    if (postPageBackBtn) {
      postPageBackBtn.addEventListener("click", () => history.back());
    }

    const postPageShareBtn = document.getElementById("postPageShare");
    if (postPageShareBtn) {
      postPageShareBtn.addEventListener("click", share);
    }

    // Swipe gestures on mobile post page photo
    const postPagePhotoWrap = document.querySelector(".post-page-photo-wrap");
    if (postPagePhotoWrap) {
      let ppTouchStartX = 0;
      let ppTouchStartY = 0;
      let ppTouchDeltaX = 0;
      let ppSwiping = false;

      postPagePhotoWrap.addEventListener("touchstart", (e) => {
        // Skip if interacting with a carousel or video element
        if (e.target.closest('.media-carousel') || e.target.tagName === 'VIDEO') return;
        ppTouchStartX = e.changedTouches[0].screenX;
        ppTouchStartY = e.changedTouches[0].screenY;
        ppTouchDeltaX = 0;
        ppSwiping = false;
      }, { passive: true });

      postPagePhotoWrap.addEventListener("touchmove", (e) => {
        const dx = e.changedTouches[0].screenX - ppTouchStartX;
        const dy = e.changedTouches[0].screenY - ppTouchStartY;
        if (!ppSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          ppSwiping = true;
        }
        if (ppSwiping) {
          ppTouchDeltaX = dx;
          const ppPhotoEl = document.getElementById("postPagePhoto");
          ppPhotoEl.style.transition = "none";
          ppPhotoEl.style.transform = `translateX(${dx}px)`;
          ppPhotoEl.style.opacity = Math.max(0.4, 1 - Math.abs(dx) / 500);
        }
      }, { passive: true });

      postPagePhotoWrap.addEventListener("touchend", () => {
        if (!ppSwiping) return;
        const ppPhotoEl = document.getElementById("postPagePhoto");
        if (Math.abs(ppTouchDeltaX) > SWIPE_THRESHOLD) {
          const goNext = ppTouchDeltaX < 0;
          const nextIdx = goNext ? _currentIndex + 1 : _currentIndex - 1;
          if (nextIdx < 0 || nextIdx >= _photos.length) {
            ppPhotoEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
            ppPhotoEl.style.transform = "";
            ppPhotoEl.style.opacity = "";
            setTimeout(() => { ppPhotoEl.style.transition = ""; }, 200);
          } else {
            const exitX = goNext ? "-100vw" : "100vw";
            ppPhotoEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
            ppPhotoEl.style.transform = `translateX(${exitX})`;
            ppPhotoEl.style.opacity = "0";
            setTimeout(() => {
              ppPhotoEl.style.transition = "none";
              ppPhotoEl.style.transform = `translateX(${goNext ? "100vw" : "-100vw"})`;
              ppPhotoEl.style.opacity = "0";
              showPostPage(nextIdx);
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  ppPhotoEl.style.transition = "transform 0.25s ease, opacity 0.25s ease";
                  ppPhotoEl.style.transform = "";
                  ppPhotoEl.style.opacity = "";
                  setTimeout(() => { ppPhotoEl.style.transition = ""; }, 250);
                });
              });
            }, 200);
          }
        } else {
          ppPhotoEl.style.transition = "transform 0.2s ease, opacity 0.2s ease";
          ppPhotoEl.style.transform = "";
          ppPhotoEl.style.opacity = "";
          setTimeout(() => { ppPhotoEl.style.transition = ""; }, 200);
        }
        ppSwiping = false;
      }, { passive: true });
    }

    // ---- History back (popstate) for mobile post page ----
    window.addEventListener("popstate", () => {
      if (_postPageOpen) {
        closePostPage();
      }
    });

    // Deep-link on page load
    checkHash();
  }

  return { init, open, setPhotos };
})();
