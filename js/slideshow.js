/**
 * slideshow.js – Fullscreen slideshow with crossfade between photos in random order.
 * Tapping the screen shows the bubble nav for 5 seconds before fading it back out.
 */

// eslint-disable-next-line no-unused-vars
const SlideshowModule = (() => {
  "use strict";

  const INTERVAL_MS = 5000; // time each photo is shown
  const FADE_MS = 1200;     // crossfade duration (keep in sync with CSS transition)
  const NAV_SHOW_MS = 5000; // how long bubble nav stays visible after a tap

  let _photos = [];
  let _order = [];     // shuffled indices
  let _pos = 0;        // current position in _order
  let _timer = null;
  let _running = false;

  // DOM refs (set in init)
  let _overlay = null;
  let _imgA = null;
  let _imgB = null;

  // Bubble nav show/hide
  let _navTimer = null;
  let _bubbleNav = null;
  let _bubbleViewNav = null;
  let _profileBubble = null;

  /** Fisher-Yates shuffle (in-place) */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Build a fresh random order of all photo indices */
  function resetOrder() {
    _order = _photos.map((_, i) => i);
    shuffle(_order);
    _pos = 0;
  }

  /** Get the web-size image path for a photo */
  function imgSrc(photo) {
    return "photos/web/" + photo.web;
  }

  /** Advance to the next photo with a crossfade */
  function advance() {
    _pos++;
    if (_pos >= _order.length) resetOrder();

    const nextPhoto = _photos[_order[_pos]];
    // Determine which img is currently visible
    const isAActive = _imgA.classList.contains("slideshow-img-active");
    const incoming = isAActive ? _imgB : _imgA;
    const outgoing = isAActive ? _imgA : _imgB;

    // Preload the next image before fading
    incoming.src = imgSrc(nextPhoto);
    incoming.onload = () => {
      incoming.classList.add("slideshow-img-active");
      outgoing.classList.remove("slideshow-img-active");
    };
    // If cached, onload fires synchronously in some browsers.
    // As a fallback, trigger after a short tick if already complete.
    if (incoming.complete && incoming.naturalWidth) {
      incoming.classList.add("slideshow-img-active");
      outgoing.classList.remove("slideshow-img-active");
    }
  }

  /** Show the bubble navs temporarily */
  function flashNavs() {
    if (_bubbleNav) {
      _bubbleNav.classList.add("slideshow-nav-visible");
    }
    if (_bubbleViewNav) {
      _bubbleViewNav.classList.add("slideshow-nav-visible");
    }
    if (_profileBubble) {
      _profileBubble.classList.add("slideshow-nav-visible");
    }
    clearTimeout(_navTimer);
    _navTimer = setTimeout(hideNavs, NAV_SHOW_MS);
  }

  function hideNavs() {
    if (_bubbleNav) _bubbleNav.classList.remove("slideshow-nav-visible");
    if (_bubbleViewNav) _bubbleViewNav.classList.remove("slideshow-nav-visible");
    if (_profileBubble) _profileBubble.classList.remove("slideshow-nav-visible");
  }

  function onOverlayClick(e) {
    // If the click is on a bubble nav element, let it handle its own click
    if (_bubbleNav && _bubbleNav.contains(e.target)) return;
    if (_bubbleViewNav && _bubbleViewNav.contains(e.target)) return;
    if (_profileBubble && _profileBubble.contains(e.target)) return;
    flashNavs();
  }

  // ---- Public API ----

  function init(photos) {
    _photos = photos;
    _overlay = document.getElementById("slideshowOverlay");
    _imgA = document.getElementById("slideshowImgA");
    _imgB = document.getElementById("slideshowImgB");
  }

  function start() {
    if (!_overlay || _photos.length === 0) return;
    _running = true;
    resetOrder();

    // Show the first photo immediately on imgA
    _imgA.src = imgSrc(_photos[_order[0]]);
    _imgA.classList.add("slideshow-img-active");
    _imgB.classList.remove("slideshow-img-active");
    _imgB.src = "";

    _overlay.classList.remove("d-none");

    // Cache bubble nav references for show/hide on tap
    _bubbleNav = document.getElementById("bubbleNav");
    _bubbleViewNav = document.getElementById("bubbleViewNav");
    _profileBubble = document.getElementById("profileBubble");

    // Start advancing
    _timer = setInterval(advance, INTERVAL_MS);

    // Tap to show nav overlay
    _overlay.addEventListener("click", onOverlayClick);

    // Hide navs initially (they'll appear on tap)
    hideNavs();
  }

  function stop() {
    _running = false;
    clearInterval(_timer);
    _timer = null;
    clearTimeout(_navTimer);
    _navTimer = null;

    if (_overlay) {
      _overlay.classList.add("d-none");
      _overlay.removeEventListener("click", onOverlayClick);
    }

    // Ensure navs are visible again when exiting
    if (_bubbleNav) _bubbleNav.classList.remove("slideshow-nav-visible");
    if (_bubbleViewNav) _bubbleViewNav.classList.remove("slideshow-nav-visible");
    if (_profileBubble) _profileBubble.classList.remove("slideshow-nav-visible");
  }

  function isRunning() {
    return _running;
  }

  return { init, start, stop, isRunning };
})();
