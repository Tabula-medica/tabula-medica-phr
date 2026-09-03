/**
 * HeroVideo — React + Tailwind version of the unraj.org Seedance hero.
 * Styling mirrors the Tabula Medica landing hero (navy gradient, teal→sky→indigo accent, blue CTA).
 * Drop into any Vite/Next/React app; no external deps beyond React.
 *
 * <HeroVideo
 *   poster="/media/01-hero-loop/01-hero-loop.jpg"
 *   webm="/media/01-hero-loop/01-hero-loop.webm"
 *   mp4="/media/01-hero-loop/01-hero-loop.mp4"
 * />
 */
import { useEffect, useRef, useState } from "react";

export interface HeroVideoProps {
  poster: string;
  mp4: string;
  webm?: string;
  eyebrow?: string;
  title?: string;
  titleAccent?: string;
  lede?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  disclosure?: string;
}

const STORAGE_KEY = "uh-hero-paused";

export function HeroVideo({
  poster,
  mp4,
  webm,
  eyebrow = "Rajiv Aggarwal, MD · Family physician · Founder",
  title = "Records that follow you.",
  titleAccent = "Care you can afford.",
  lede = "Thirty-eight years in family medicine, now building patient-owned health records and real access to care for the 40 million Americans without coverage.",
  primaryCta = { label: "See what I'm building", href: "#work" },
  secondaryCta = { label: "About Dr. Aggarwal", href: "#about" },
  disclosure = "Illustrative video created with AI-generated imagery. No patient data or patient likenesses were used.",
}: HeroVideoProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoAllowed, setVideoAllowed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  // Decide once on mount whether video is appropriate for this visitor.
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const saveData = conn?.saveData === true;
    const slow = /(^|-)2g$/.test(conn?.effectiveType ?? "");
    let paused = false;
    try {
      paused = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    setUserPaused(paused);
    setVideoAllowed(!(reduced || saveData || slow));
  }, []);

  // Play only while on screen and not user-paused; pause when hidden.
  useEffect(() => {
    if (!videoAllowed) return;
    const el = sectionRef.current;
    const video = videoRef.current;
    if (!el || !video) return;

    const tryPlay = () => {
      if (userPaused) return;
      video
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) tryPlay();
          else if (!video.paused) video.pause();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);

    const onVis = () => {
      if (document.hidden) {
        if (!video.paused) video.pause();
      } else tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [videoAllowed, userPaused]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !userPaused;
    setUserPaused(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (next) {
      video.pause();
      setPlaying(false);
    } else {
      video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <>
      <section
        ref={sectionRef}
        aria-labelledby="uh-hero-title"
        className="relative isolate overflow-hidden min-h-[min(88vh,720px)] grid items-center text-white"
      >
        {/* media */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0c1a3a] to-[#072e3a]" />
          <img
            src={poster}
            alt=""
            width={1280}
            height={720}
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {videoAllowed && (
            <video
              ref={videoRef}
              muted
              playsInline
              loop
              preload="metadata"
              poster={poster}
              disablePictureInPicture
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${playing ? "opacity-100" : "opacity-0"}`}
            >
              {webm && <source src={webm} type="video/webm" />}
              <source src={mp4} type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,13,31,.88)_0%,rgba(6,13,31,.62)_55%,rgba(6,13,31,.35)_100%),linear-gradient(0deg,rgba(6,13,31,.6)_0%,rgba(6,13,31,0)_40%)]" />
        </div>

        {/* content */}
        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-10 py-16 sm:py-28 grid gap-5">
          <p className="inline-flex w-fit items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs font-medium text-white/75 m-0">
            {eyebrow}
          </p>
          <h1
            id="uh-hero-title"
            className="m-0 max-w-[16ch] text-4xl sm:text-5xl md:text-[3.5rem] font-extrabold leading-[1.06] tracking-[-0.03em]"
          >
            {title}
            <br />
            <span className="bg-gradient-to-r from-teal-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              {titleAccent}
            </span>
          </h1>
          <p className="m-0 max-w-xl text-lg leading-relaxed text-blue-100/60">{lede}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a
              href={primaryCta.href}
              className="inline-flex h-[52px] items-center justify-center rounded-xl px-8 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 shadow-xl shadow-blue-600/35 hover:from-blue-600/90 hover:to-blue-500/90 transition-all duration-200 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sky-300 focus-visible:outline-offset-[3px]"
            >
              {primaryCta.label}
            </a>
            <a
              href={secondaryCta.href}
              className="inline-flex h-[52px] items-center justify-center rounded-xl px-8 text-base font-semibold text-white border border-white/20 bg-white/[0.04] hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sky-300 focus-visible:outline-offset-[3px]"
            >
              {secondaryCta.label}
            </a>
          </div>
        </div>

        {videoAllowed && (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={!userPaused}
            aria-label={userPaused ? "Play background video" : "Pause background video"}
            className="absolute right-4 bottom-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-[#060d1f]/55 text-white backdrop-blur focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sky-300"
          >
            {userPaused ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor" d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z" />
              </svg>
            )}
          </button>
        )}
      </section>
      <p className="mx-auto mt-3 max-w-6xl px-5 sm:px-10 text-xs text-slate-500">{disclosure}</p>
    </>
  );
}

export default HeroVideo;
