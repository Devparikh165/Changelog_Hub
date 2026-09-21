/*!
 * Changelog "What's new" widget — drop-in script for any website.
 *
 *   <script src="https://updates.example.com/widget.js" defer></script>
 *
 * Options (data attributes on the script tag):
 *   data-trigger="#my-bell"   use your own button instead of the floating one;
 *                             the unread count is written to its data-unread attribute
 *   data-position="left"      floating button / panel side (default "right")
 *   data-origin="https://…"   where the changelog app lives (default: the script's origin)
 *
 * JS API: window.ChangelogWidget.open() / .close()
 *
 * The panel is an iframe of <origin>/embed, so the host page's CSS can't break it and
 * the widget can't read the host page. The two talk only through origin-checked postMessage.
 */
(function () {
  "use strict";
  if (window.ChangelogWidget) return;

  var script = document.currentScript;
  var origin = (script && script.dataset.origin) || new URL(script.src).origin;
  var side = script && script.dataset.position === "left" ? "left" : "right";
  var triggerSelector = script && script.dataset.trigger;

  var host = document.createElement("div");
  host.setAttribute("data-changelog-widget", "");
  var root = host.attachShadow({ mode: "open" });

  root.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    ".bell{position:fixed;bottom:24px;" + side + ":24px;z-index:2147483000;width:48px;height:48px;border-radius:999px;border:0;" +
    "background:#262626;color:#fafafa;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18)}" +
    ".bell:focus-visible{outline:3px solid #a3a3a3;outline-offset:2px}" +
    ".badge{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#ef4444;" +
    "color:#fff;font:600 11px/18px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;box-sizing:border-box}" +
    ".backdrop{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.32);opacity:0;transition:opacity .2s;pointer-events:none}" +
    ".panel{position:fixed;top:12px;" + side + ":12px;z-index:2147483002;width:min(420px,calc(100vw - 24px));height:calc(100vh - 24px);height:calc(100dvh - 24px);border:0;" +
    "border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.25);background:transparent;opacity:0;visibility:hidden;" +
    "transform:translateX(" + (side === "right" ? "" : "-") + "24px);transition:opacity .2s,transform .2s,visibility .2s}" +
    ":host([data-open]) .panel{opacity:1;visibility:visible;transform:none}" +
    ":host([data-open]) .backdrop{opacity:1;pointer-events:auto}" +
    "@media (prefers-reduced-motion:reduce){.panel,.backdrop{transition:none}}" +
    "[hidden]{display:none!important}" +
    "</style>" +
    (triggerSelector
      ? ""
      : '<button class="bell" type="button" aria-label="What\'s new" aria-haspopup="dialog">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/>' +
        '<path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>' +
        '<span class="badge" hidden></span></button>') +
    '<div class="backdrop"></div>' +
    '<iframe class="panel" title="What\'s new" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>';

  var frame = root.querySelector(".panel");
  var bell = root.querySelector(".bell");
  var badge = root.querySelector(".badge");
  var backdrop = root.querySelector(".backdrop");
  var lastFocus = null;
  var ready = false; // the iframe announces itself with its first unread message
  var pendingOpen = false;
  frame.src = origin + "/embed";

  function customTriggers() {
    return triggerSelector ? document.querySelectorAll(triggerSelector) : [];
  }

  function setUnread(count) {
    var text = count > 9 ? "9+" : String(count);
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = text;
    }
    if (bell) bell.setAttribute("aria-label", count ? "What's new, " + count + " unread" : "What's new");
    customTriggers().forEach(function (el) {
      if (count) el.setAttribute("data-unread", text);
      else el.removeAttribute("data-unread");
    });
  }

  function open() {
    if (host.hasAttribute("data-open")) return;
    lastFocus = document.activeElement;
    host.setAttribute("data-open", "");
    if (ready) frame.contentWindow.postMessage({ type: "changelog:open" }, origin);
    else pendingOpen = true;
    setUnread(0);
    frame.focus();
  }

  function close() {
    if (!host.hasAttribute("data-open")) return;
    host.removeAttribute("data-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === "changelog:unread") {
      ready = true;
      if (pendingOpen) {
        pendingOpen = false;
        frame.contentWindow.postMessage({ type: "changelog:open" }, origin);
      } else if (!host.hasAttribute("data-open")) {
        setUnread(Number(event.data.count) || 0);
      }
    }
    if (event.data.type === "changelog:close") close();
  });

  if (bell) bell.addEventListener("click", open);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
  document.addEventListener("click", function (e) {
    if (triggerSelector && e.target.closest && e.target.closest(triggerSelector)) {
      e.preventDefault();
      open();
    }
  });

  (document.body || document.documentElement).appendChild(host);
  window.ChangelogWidget = { open: open, close: close };
})();
