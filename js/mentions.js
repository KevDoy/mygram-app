/**
 * mentions.js – Parses markdown-style caption links into clickable HTML.
 *
 * Supports [@handle](url) syntax in photo captions. The display text
 * can be anything, but the intended use-case is tagging friends:
 *   "Great day with [@JimBob](https://jimbob.github.io/mygram/)"
 */

// eslint-disable-next-line no-unused-vars
const MentionsModule = (() => {
  "use strict";

  /** Escape HTML special characters to prevent XSS */
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /** Basic URL validation – only allow http(s) links */
  function isSafeUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Convert a plain-text caption into safe HTML, turning
   * markdown-style [text](url) links into anchor tags.
   * All other text is HTML-escaped.
   * @param {string} text - Raw caption text
   * @returns {string} Safe HTML string
   */
  function linkify(text) {
    if (!text) return "";
    // Match [display text](url)
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let result = "";
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      // Append escaped text before the match
      result += escapeHtml(text.slice(last, m.index));
      const display = m[1];
      const url = m[2];
      if (isSafeUrl(url)) {
        result += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="caption-mention">${escapeHtml(display)}</a>`;
      } else {
        // Not a safe URL – render as plain text
        result += escapeHtml(m[0]);
      }
      last = re.lastIndex;
    }
    result += escapeHtml(text.slice(last));
    return result;
  }

  return { linkify };
})();
