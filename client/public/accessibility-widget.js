/*!
 * Tabula Medica — Self-hosted Accessibility Widget
 * v1.0.0 · vanilla JS, zero dependencies, ZERO external network calls.
 *
 * Why self-hosted: no third-party script reads the page (safe for PHI/HIPAA surfaces),
 * no new sub-processor on the vendor register, no recurring license. Drop-in on any site.
 *
 * Integration: copy this file to the site's public root and add before </body>:
 *   <script src="/accessibility-widget.js" defer></script>
 * Optional config via a global before the tag:
 *   <script>window.TM_A11Y = { position: 'right', color: '#0d4a2e' };</script>
 *
 * All adjustments are applied via a scoped <style> + data-attributes on <html>, and
 * persisted in localStorage. Nothing here transmits data anywhere.
 */
(function () {
  'use strict';
  if (window.__tmA11yLoaded) return;
  window.__tmA11yLoaded = true;

  var CFG = Object.assign({ position: 'right', color: '#0d4a2e', accent: '#2FAE7E' }, window.TM_A11Y || {});
  var KEY = 'tm-a11y-state-v1';
  var root = document.documentElement;

  // ---- state ----------------------------------------------------------------
  var DEFAULT = {
    fontScale: 0, lineHeight: 0, letterSpacing: 0, readableFont: false,
    contrast: '',            // '', 'high', 'dark', 'light'
    saturation: '',          // '', 'low', 'high', 'grayscale'
    invert: false,
    highlightLinks: false, highlightHeadings: false, bigCursor: false,
    hideImages: false, pauseMotion: false, readingGuide: false, readingMask: false,
    keyboardNav: false,
  };
  var state = load();

  function load() {
    try { return Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULT); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  // ---- styles ---------------------------------------------------------------
  var css = [
    /* adjustments applied to the host page, scoped by data-attrs on <html> */
    'html[data-tm-font="1"] body *{font-size:calc(1em * 1.12)!important}',
    'html[data-tm-font="2"] body *{font-size:calc(1em * 1.24)!important}',
    'html[data-tm-font="3"] body *{font-size:calc(1em * 1.4)!important}',
    'html[data-tm-lh="1"] body *{line-height:1.7!important}',
    'html[data-tm-lh="2"] body *{line-height:2.1!important}',
    'html[data-tm-ls="1"] body *{letter-spacing:.06em!important}',
    'html[data-tm-ls="2"] body *{letter-spacing:.12em!important}',
    'html[data-tm-font-readable="1"] body *{font-family:Verdana,Tahoma,Arial,sans-serif!important;word-spacing:.12em!important}',
    'html[data-tm-contrast="high"] body{background:#000!important}',
    'html[data-tm-contrast="high"] body *{background-color:transparent!important;color:#fff!important;border-color:#fff!important}',
    'html[data-tm-contrast="high"] body a,html[data-tm-contrast="high"] body a *{color:#ff0!important}',
    'html[data-tm-contrast="dark"]{filter:invert(0)}',
    'html[data-tm-contrast="dark"] body{background:#0b0f14!important;color:#e8eef5!important}',
    'html[data-tm-contrast="dark"] body *{background-color:transparent!important;color:#e8eef5!important;border-color:#33404d!important}',
    'html[data-tm-contrast="light"] body{background:#fff!important;color:#111!important}',
    'html[data-tm-contrast="light"] body *{background-color:transparent!important;color:#111!important}',
    'html[data-tm-sat="low"] body{filter:saturate(.5)}',
    'html[data-tm-sat="high"] body{filter:saturate(1.8)}',
    'html[data-tm-sat="grayscale"] body{filter:grayscale(1)}',
    'html[data-tm-invert="1"] body{filter:invert(1) hue-rotate(180deg)}',
    'html[data-tm-invert="1"] body img,html[data-tm-invert="1"] body video{filter:invert(1) hue-rotate(180deg)}',
    'html[data-tm-links="1"] body a{outline:2px solid #ffd400!important;background:#000!important;color:#ffd400!important;text-decoration:underline!important}',
    'html[data-tm-headings="1"] body :is(h1,h2,h3,h4,h5,h6){outline:2px dashed ' + CFG.accent + '!important;outline-offset:2px}',
    'html[data-tm-cursor="1"],html[data-tm-cursor="1"] body *{cursor:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' stroke=\'%23fff\' stroke-width=\'1\' d=\'M4 2l16 8-6 2-2 6z\'/%3E%3C/svg%3E") 4 4,auto!important}',
    'html[data-tm-noimg="1"] body img,html[data-tm-noimg="1"] body picture,html[data-tm-noimg="1"] body svg:not(.tm-a11y svg){visibility:hidden!important}',
    'html[data-tm-motion="1"] body *,html[data-tm-motion="1"] body *::before,html[data-tm-motion="1"] body *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}',
    'html[data-tm-kbd="1"] body :is(a,button,input,select,textarea,[tabindex]):focus{outline:3px solid ' + CFG.accent + '!important;outline-offset:2px!important}',

    /* widget chrome (namespaced, high z-index, unaffected by host adjustments) */
    '.tm-a11y,.tm-a11y *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif!important;filter:none!important}',
    '.tm-a11y-btn{position:fixed;bottom:20px;z-index:2147483646;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:' + CFG.color + ';color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:0}',
    '.tm-a11y-btn svg{width:30px;height:30px;fill:#fff}',
    '.tm-a11y-btn:focus-visible{outline:3px solid #ffd400;outline-offset:3px}',
    '.tm-a11y-right{right:20px}.tm-a11y-left{left:20px}',
    '.tm-a11y-panel{position:fixed;top:0;bottom:0;width:360px;max-width:92vw;z-index:2147483647;background:#fff;color:#111;box-shadow:0 0 40px rgba(0,0,0,.4);overflow-y:auto;transform:translateX(110%);transition:transform .25s ease;padding:0 0 24px}',
    '.tm-a11y-panel.tm-open{transform:none}',
    '.tm-a11y-panel.tm-right{right:0}.tm-a11y-panel.tm-left{left:0;transform:translateX(-110%)}',
    '.tm-a11y-hd{position:sticky;top:0;background:' + CFG.color + ';color:#fff;padding:16px 18px;display:flex;align-items:center;justify-content:space-between}',
    '.tm-a11y-hd h2{margin:0;font-size:17px;font-weight:700}',
    '.tm-a11y-x{background:transparent;border:none;color:#fff;font-size:26px;line-height:1;cursor:pointer;padding:4px 8px}',
    '.tm-a11y-sec{padding:14px 18px 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#667;font-weight:700}',
    '.tm-a11y-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 18px}',
    '.tm-a11y-tile{border:2px solid #d8dee6;border-radius:10px;background:#f7f9fb;padding:10px 8px;cursor:pointer;font-size:13px;font-weight:600;color:#1a2430;text-align:center;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}',
    '.tm-a11y-tile[aria-pressed="true"]{border-color:' + CFG.accent + ';background:#e9f7f0;color:' + CFG.color + '}',
    '.tm-a11y-tile .ic{font-size:20px}',
    '.tm-a11y-step{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-top:1px solid #eef1f4}',
    '.tm-a11y-step span{font-size:14px;font-weight:600;color:#1a2430}',
    '.tm-a11y-step .btns{display:flex;gap:6px}',
    '.tm-a11y-step button{width:34px;height:34px;border-radius:8px;border:2px solid #d8dee6;background:#fff;font-size:18px;font-weight:700;cursor:pointer;color:' + CFG.color + '}',
    '.tm-a11y-step b{min-width:22px;text-align:center;display:inline-block}',
    '.tm-a11y-foot{padding:16px 18px 0;display:flex;gap:10px}',
    '.tm-a11y-foot button{flex:1;padding:11px;border-radius:10px;border:2px solid ' + CFG.color + ';background:#fff;color:' + CFG.color + ';font-weight:700;cursor:pointer;font-size:14px}',
    '.tm-a11y-foot button.tm-primary{background:' + CFG.color + ';color:#fff}',
    '.tm-a11y-note{padding:12px 18px 0;font-size:11px;color:#8894a3;line-height:1.5}',
    '.tm-a11y-guide{position:fixed;left:0;right:0;height:44px;background:rgba(255,212,0,.18);border-top:2px solid #ffd400;border-bottom:2px solid #ffd400;pointer-events:none;z-index:2147483640;display:none}',
    '.tm-a11y-mask-t,.tm-a11y-mask-b{position:fixed;left:0;right:0;background:rgba(0,0,0,.7);pointer-events:none;z-index:2147483639;display:none}',
    '@media (prefers-reduced-motion:reduce){.tm-a11y-panel{transition:none}}',
  ].join('\n');

  var styleEl = document.createElement('style');
  styleEl.id = 'tm-a11y-style';
  styleEl.textContent = css;
  (document.head || document.documentElement).appendChild(styleEl);

  // ---- apply state to <html> -------------------------------------------------
  function applyAttr(name, val) { if (val) root.setAttribute(name, val); else root.removeAttribute(name); }
  function apply() {
    applyAttr('data-tm-font', state.fontScale || '');
    applyAttr('data-tm-lh', state.lineHeight || '');
    applyAttr('data-tm-ls', state.letterSpacing || '');
    applyAttr('data-tm-font-readable', state.readableFont ? '1' : '');
    applyAttr('data-tm-contrast', state.contrast);
    applyAttr('data-tm-sat', state.saturation);
    applyAttr('data-tm-invert', state.invert ? '1' : '');
    applyAttr('data-tm-links', state.highlightLinks ? '1' : '');
    applyAttr('data-tm-headings', state.highlightHeadings ? '1' : '');
    applyAttr('data-tm-cursor', state.bigCursor ? '1' : '');
    applyAttr('data-tm-noimg', state.hideImages ? '1' : '');
    applyAttr('data-tm-motion', state.pauseMotion ? '1' : '');
    applyAttr('data-tm-kbd', state.keyboardNav ? '1' : '');
    if (guideEl) guideEl.style.display = state.readingGuide ? 'block' : 'none';
    if (maskT) { maskT.style.display = maskB.style.display = state.readingMask ? 'block' : 'none'; }
    save();
    if (panel) syncControls();
  }

  // ---- build UI --------------------------------------------------------------
  var A11Y_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="M21 8.5c0 .6-.4 1-1 1-1.9.1-3.8-.3-5.6-.9v3.1l1.9 6.6c.2.6-.2 1.2-.8 1.4-.6.2-1.2-.2-1.4-.8L12 14l-1.6 5.9c-.2.6-.8 1-1.4.8-.6-.2-1-.8-.8-1.4L10 12.7V9.6C8.2 10.2 6.3 10.6 4.4 10.5c-.6 0-1-.4-1-1s.4-1 1-1c2.5.1 5.1-.4 7.6-1.5 2.5 1.1 5.1 1.6 7.6 1.5.5 0 .8.4.8 1z"/></svg>';

  var btn = document.createElement('button');
  btn.className = 'tm-a11y tm-a11y-btn tm-a11y-' + (CFG.position === 'left' ? 'left' : 'right');
  btn.setAttribute('aria-label', 'Open accessibility menu');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = A11Y_ICON;

  var guideEl = document.createElement('div'); guideEl.className = 'tm-a11y tm-a11y-guide';
  var maskT = document.createElement('div'); maskT.className = 'tm-a11y tm-a11y-mask-t';
  var maskB = document.createElement('div'); maskB.className = 'tm-a11y tm-a11y-mask-b';

  var panel = document.createElement('div');
  panel.className = 'tm-a11y tm-a11y-panel tm-' + (CFG.position === 'left' ? 'left' : 'right');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Accessibility adjustments');

  // profiles = one-click bundles of the granular toggles
  var PROFILES = [
    { id: 'seizure', ic: '🌀', label: 'Seizure Safe', set: { saturation: 'grayscale', pauseMotion: true } },
    { id: 'vision', ic: '🔍', label: 'Low Vision', set: { fontScale: 2, contrast: 'high', highlightLinks: true } },
    { id: 'adhd', ic: '🎯', label: 'ADHD Friendly', set: { readingMask: true, pauseMotion: true, highlightLinks: true } },
    { id: 'cognitive', ic: '📖', label: 'Reading Help', set: { readableFont: true, letterSpacing: 1, highlightHeadings: true, readingGuide: true } },
    { id: 'keyboard', ic: '⌨️', label: 'Keyboard Nav', set: { keyboardNav: true } },
    { id: 'older', ic: '👵', label: 'Older Adults', set: { fontScale: 2, bigCursor: true, contrast: 'high' } },
  ];
  var TOGGLES = [
    { k: 'highlightLinks', ic: '🔗', label: 'Highlight Links' },
    { k: 'highlightHeadings', ic: '🔤', label: 'Highlight Titles' },
    { k: 'readableFont', ic: '🅰️', label: 'Readable Font' },
    { k: 'bigCursor', ic: '🖱️', label: 'Big Cursor' },
    { k: 'pauseMotion', ic: '⏸️', label: 'Pause Animations' },
    { k: 'hideImages', ic: '🖼️', label: 'Hide Images' },
    { k: 'readingGuide', ic: '📏', label: 'Reading Guide' },
    { k: 'readingMask', ic: '🕶️', label: 'Reading Mask' },
    { k: 'invert', ic: '🔃', label: 'Invert Colors' },
    { k: 'keyboardNav', ic: '⌨️', label: 'Focus Outlines' },
  ];
  var CONTRASTS = [['', 'Default'], ['high', 'High'], ['dark', 'Dark'], ['light', 'Light']];
  var SATS = [['', 'Normal'], ['low', 'Low'], ['high', 'High'], ['grayscale', 'Gray']];

  function tiles(list, kind) {
    return '<div class="tm-a11y-grid">' + list.map(function (o) {
      if (kind === 'profile') return '<button class="tm-a11y-tile" data-profile="' + o.id + '"><span class="ic">' + o.ic + '</span>' + o.label + '</button>';
      return '<button class="tm-a11y-tile" data-toggle="' + o.k + '"><span class="ic">' + o.ic + '</span>' + o.label + '</button>';
    }).join('') + '</div>';
  }
  function chipRow(name, arr) {
    return '<div class="tm-a11y-grid">' + arr.map(function (c) {
      return '<button class="tm-a11y-tile" data-' + name + '="' + c[0] + '">' + c[1] + '</button>';
    }).join('') + '</div>';
  }
  function stepper(k, label) {
    return '<div class="tm-a11y-step"><span>' + label + '</span><div class="btns">' +
      '<button data-dec="' + k + '" aria-label="Decrease ' + label + '">−</button>' +
      '<b data-val="' + k + '">0</b>' +
      '<button data-inc="' + k + '" aria-label="Increase ' + label + '">+</button></div></div>';
  }

  panel.innerHTML =
    '<div class="tm-a11y-hd"><h2>Accessibility</h2><button class="tm-a11y-x" aria-label="Close accessibility menu">×</button></div>' +
    '<div class="tm-a11y-sec">Accessibility Profiles</div>' + tiles(PROFILES, 'profile') +
    '<div class="tm-a11y-sec">Content Adjustments</div>' +
      stepper('fontScale', 'Text Size') + stepper('lineHeight', 'Line Spacing') + stepper('letterSpacing', 'Letter Spacing') +
    '<div class="tm-a11y-sec">Color Adjustments</div>' + chipRow('contrast', CONTRASTS) + chipRow('sat', SATS) +
    '<div class="tm-a11y-sec">Navigation & Orientation</div>' + tiles(TOGGLES, 'toggle') +
    '<div class="tm-a11y-foot"><button class="tm-reset">Reset all</button><button class="tm-primary tm-hide">Hide menu</button></div>' +
    '<div class="tm-a11y-note">This tool adjusts how this site displays for you. Your settings are saved only in this browser and are never sent anywhere. It supplements — and does not replace — the site\'s built-in accessibility.</div>';

  // ---- wire up ---------------------------------------------------------------
  function open() {
    panel.classList.add('tm-open'); btn.setAttribute('aria-expanded', 'true');
    var first = panel.querySelector('.tm-a11y-x'); if (first) first.focus();
    document.addEventListener('keydown', onKey);
  }
  function close() {
    panel.classList.remove('tm-open'); btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey); btn.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // simple focus trap
      var f = panel.querySelectorAll('button'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  btn.addEventListener('click', open);

  panel.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.classList.contains('tm-a11y-x') || t.classList.contains('tm-hide')) return close();
    if (t.classList.contains('tm-reset')) { state = Object.assign({}, DEFAULT); apply(); announce('All accessibility settings reset'); return; }
    if (t.dataset.profile) { applyProfile(t.dataset.profile); return; }
    if (t.dataset.toggle) { state[t.dataset.toggle] = !state[t.dataset.toggle]; apply(); return; }
    if (t.dataset.contrast !== undefined && t.hasAttribute('data-contrast')) { state.contrast = state.contrast === t.dataset.contrast ? '' : t.dataset.contrast; if (state.contrast) state.invert = false; apply(); return; }
    if (t.hasAttribute('data-sat')) { state.saturation = state.saturation === t.dataset.sat ? '' : t.dataset.sat; apply(); return; }
    if (t.dataset.inc) { step(t.dataset.inc, 1); return; }
    if (t.dataset.dec) { step(t.dataset.dec, -1); return; }
  });

  function step(k, d) { state[k] = Math.max(0, Math.min(3, (state[k] || 0) + d)); apply(); }
  function applyProfile(id) {
    var p = PROFILES.find(function (x) { return x.id === id; }); if (!p) return;
    // toggle: if already fully applied, clear those keys; else apply the bundle
    var on = Object.keys(p.set).every(function (k) { return String(state[k]) === String(p.set[k]); });
    Object.keys(p.set).forEach(function (k) { state[k] = on ? DEFAULT[k] : p.set[k]; });
    apply(); announce((on ? 'Disabled ' : 'Enabled ') + p.label + ' profile');
  }

  function syncControls() {
    panel.querySelectorAll('[data-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', !!state[b.dataset.toggle]); });
    panel.querySelectorAll('[data-profile]').forEach(function (b) {
      var p = PROFILES.find(function (x) { return x.id === b.dataset.profile; });
      var on = p && Object.keys(p.set).every(function (k) { return String(state[k]) === String(p.set[k]); });
      b.setAttribute('aria-pressed', !!on);
    });
    panel.querySelectorAll('[data-contrast]').forEach(function (b) { b.setAttribute('aria-pressed', state.contrast === b.dataset.contrast && b.dataset.contrast !== ''); });
    panel.querySelectorAll('[data-sat]').forEach(function (b) { b.setAttribute('aria-pressed', state.saturation === b.dataset.sat && b.dataset.sat !== ''); });
    panel.querySelectorAll('[data-val]').forEach(function (b) { b.textContent = state[b.dataset.val] || 0; });
  }

  // reading guide + mask follow the pointer
  document.addEventListener('mousemove', function (e) {
    if (state.readingGuide) { guideEl.style.top = (e.clientY - 22) + 'px'; }
    if (state.readingMask) {
      maskT.style.top = '0'; maskT.style.height = Math.max(0, e.clientY - 60) + 'px';
      maskB.style.top = (e.clientY + 60) + 'px'; maskB.style.bottom = '0';
    }
  }, { passive: true });

  // live-region for screen-reader announcements
  var live = document.createElement('div');
  live.setAttribute('aria-live', 'polite'); live.className = 'tm-a11y';
  live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
  function announce(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 50); }

  function mount() {
    var b = document.body || document.documentElement;
    b.appendChild(btn); b.appendChild(panel); b.appendChild(guideEl); b.appendChild(maskT); b.appendChild(maskB); b.appendChild(live);
    apply();
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
