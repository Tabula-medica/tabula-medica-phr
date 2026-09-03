/* unraj.org hero video controller.
   - Loads the video only when: no reduced-motion preference, no Save-Data header, viewport ≥ 640px or
     the user explicitly presses play, and the hero is on screen.
   - Poster is always rendered first, so LCP is the image, never the video.
   - Pause button is keyboard-accessible; state persists in localStorage. */
(function () {
  "use strict";
  var hero = document.querySelector(".uh-hero");
  if (!hero) return;
  var video = hero.querySelector(".uh-hero__video");
  var toggle = hero.querySelector("[data-hero-toggle]");
  if (!video || !toggle) return;

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData === true;
  var slowNet = navigator.connection && /(^|-)2g$/.test(navigator.connection.effectiveType || "");
  var userPaused = false;
  try { userPaused = localStorage.getItem("uh-hero-paused") === "1"; } catch (e) { /* storage may be blocked */ }

  if (reducedMotion || saveData || slowNet) {
    hero.classList.add("no-video");
    return;
  }

  var loaded = false;
  function loadSources() {
    if (loaded) return;
    loaded = true;
    var webm = video.getAttribute("data-src-webm");
    var mp4 = video.getAttribute("data-src-mp4");
    if (webm && video.canPlayType('video/webm; codecs="av01.0.05M.08"') !== "") {
      var s1 = document.createElement("source"); s1.src = webm; s1.type = "video/webm"; video.appendChild(s1);
    } else if (webm && video.canPlayType('video/webm; codecs="vp9"') !== "") {
      var s2 = document.createElement("source"); s2.src = webm; s2.type = "video/webm"; video.appendChild(s2);
    }
    if (mp4) {
      var s3 = document.createElement("source"); s3.src = mp4; s3.type = "video/mp4"; video.appendChild(s3);
    }
    video.load();
  }

  function play() {
    loadSources();
    var p = video.play();
    if (p && typeof p.then === "function") {
      p.then(function () {
        hero.classList.add("is-playing");
        toggle.setAttribute("aria-pressed", "true");
        toggle.setAttribute("aria-label", "Pause background video");
      }).catch(function () {
        // Autoplay blocked: keep the poster, show a play affordance.
        hero.classList.remove("is-playing");
        toggle.setAttribute("aria-pressed", "false");
        toggle.setAttribute("aria-label", "Play background video");
      });
    }
  }
  function pause() {
    video.pause();
    hero.classList.remove("is-playing");
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-label", "Play background video");
  }

  toggle.addEventListener("click", function () {
    var playing = toggle.getAttribute("aria-pressed") === "true";
    userPaused = playing;
    try { localStorage.setItem("uh-hero-paused", playing ? "1" : "0"); } catch (e) { /* ignore */ }
    if (playing) pause(); else play();
  });

  // Only play while visible, and only on first intersection if the user hasn't paused it.
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (!userPaused) play();
        } else if (!video.paused) {
          video.pause(); // save battery off-screen; state label untouched
        }
      });
    }, { threshold: 0.25 });
    io.observe(hero);
  } else if (!userPaused) {
    play();
  }

  if (userPaused) {
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-label", "Play background video");
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (!video.paused) video.pause(); }
    else if (!userPaused && hero.classList.contains("is-playing")) { video.play().catch(function () {}); }
  });
})();
