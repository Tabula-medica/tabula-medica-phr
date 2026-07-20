import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GOLD = "#D4AF37";
const NAVY = "#0A0B1A";

const TRADITIONS = ["Hinduism", "Islam", "Buddhism", "Christianity", "Judaism", "Sikhism", "Bahá'í", "Taoism"];

const SCENES = [
  { duration: 2500 },  // hook
  { duration: 3500 },  // traditions grid
  { duration: 3500 },  // app demo
  { duration: 4000 },  // CTA
] as const;

const TOTAL = SCENES.reduce((a, s) => a + s.duration, 0);

function useVideoTiming() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = performance.now();
    let scene = 0;
    let sceneBoundary = SCENES[0].duration;

    const tick = (now: number) => {
      const t = now - startRef.current!;
      setElapsed(t);
      if (t >= sceneBoundary && scene < SCENES.length - 1) {
        scene++;
        sceneBoundary += SCENES[scene].duration;
        setSceneIndex(scene);
      }
      if (t < TOTAL) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { sceneIndex, elapsed };
}

function GoldDot() {
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: GOLD,
        boxShadow: `0 0 12px ${GOLD}aa`,
      }}
    />
  );
}

function Scene0() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, padding: "0 32px", textAlign: "center" }}>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, type: "spring", damping: 12 }}
        style={{
          width: 64, height: 64, borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD}44 0%, transparent 70%)`,
          border: `2px solid ${GOLD}88`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28,
        }}
      >
        🕯️
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", fontFamily: "sans-serif", margin: 0 }}
      >
        NoorJyoti
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.55 }}
        style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.15 }}
      >
        Every tradition.<br />One sanctuary.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontFamily: "sans-serif", margin: 0 }}
      >
        Sacred scriptures · AI voices · 8+ faiths
      </motion.p>
    </div>
  );
}

function Scene1() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 24px", gap: 20 }}>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", color: "rgba(255,255,255,0.75)", textAlign: "center", margin: 0 }}
      >
        "Truth is one — the sages call it by many names."
      </motion.p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
        width: "100%",
        maxWidth: 320,
      }}>
        {TRADITIONS.map((t, i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.35, type: "spring", damping: 14 }}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${GOLD}44`,
              borderRadius: 10,
              padding: "8px 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontFamily: "sans-serif",
              color: "rgba(255,255,255,0.8)",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {t}
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        style={{ height: 1, width: 120, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
      />
    </div>
  );
}

function Scene2() {
  const lines = [
    "📖  Bhagavad Gita — Chapter 2",
    "🎵  Calm Female Voice · English",
    "⏸  ━━━━●━━━━━━━━  2:14 / 8:30",
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 24px", gap: 20 }}>
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "sans-serif", margin: 0 }}
      >
        Now listening
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{
          width: "100%",
          maxWidth: 300,
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${GOLD}55`,
          borderRadius: 16,
          padding: "20px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.18, duration: 0.35 }}
            style={{
              margin: 0,
              fontFamily: "monospace",
              fontSize: 12,
              color: i === 0 ? "#fff" : "rgba(255,255,255,0.6)",
            }}
          >
            {line}
          </motion.p>
        ))}
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.4 }}
        style={{ fontFamily: "Georgia, serif", fontSize: 14, fontStyle: "italic", color: "rgba(255,255,255,0.65)", textAlign: "center", margin: 0, lineHeight: 1.5 }}
      >
        "The soul is never born nor dies at any time…"
      </motion.p>
    </div>
  );
}

function Scene3() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px", gap: 24, textAlign: "center" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", damping: 10 }}
        style={{
          width: 72, height: 72, borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD}66 0%, ${GOLD}11 70%)`,
          border: `2px solid ${GOLD}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
          boxShadow: `0 0 40px ${GOLD}55`,
        }}
      >
        🕯️
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.2 }}
      >
        Begin your<br />sacred journey
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.4 }}
        style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "sans-serif", margin: 0 }}
      >
        Free · Web &amp; Mobile · 8 traditions
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.45 }}
        style={{
          background: GOLD,
          color: NAVY,
          fontFamily: "sans-serif",
          fontWeight: 700,
          fontSize: 14,
          padding: "12px 32px",
          borderRadius: 100,
          letterSpacing: "0.05em",
        }}
      >
        noorjyoti.com
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        style={{ display: "flex", gap: 8, alignItems: "center" }}
      >
        <GoldDot />
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "sans-serif" }}>Follow for daily wisdom</span>
        <GoldDot />
      </motion.div>
    </div>
  );
}

const SCENE_COMPONENTS = [Scene0, Scene1, Scene2, Scene3];

export default function SocialVideoPage() {
  const { sceneIndex } = useVideoTiming();
  const [key, setKey] = useState(0);

  const restart = () => setKey(k => k + 1);

  const SceneComp = SCENE_COMPONENTS[sceneIndex];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#111",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "sans-serif", margin: 0 }}>
        Social media video — 1:1 format (Instagram / TikTok)
      </p>

      {/* Phone frame */}
      <div
        key={key}
        style={{
          width: 320,
          height: 320,
          borderRadius: 24,
          background: NAVY,
          border: `2px solid rgba(212,175,55,0.3)`,
          overflow: "hidden",
          position: "relative",
          boxShadow: `0 0 60px rgba(212,175,55,0.15), 0 20px 60px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${GOLD}18 0%, transparent 60%)`,
          pointerEvents: "none",
        }} />

        {/* Scene */}
        <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={sceneIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ height: "100%" }}
            >
              <SceneComp />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Scene indicator dots */}
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 5, zIndex: 10,
        }}>
          {SCENES.map((_, i) => (
            <div key={i} style={{
              width: i === sceneIndex ? 16 : 5,
              height: 5,
              borderRadius: 3,
              background: i === sceneIndex ? GOLD : "rgba(255,255,255,0.25)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={restart}
          style={{
            background: GOLD,
            color: NAVY,
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontFamily: "sans-serif",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ↺ Replay
        </button>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "sans-serif", margin: 0, alignSelf: "center" }}>
          ~{Math.round(TOTAL / 1000)}s · Scene {sceneIndex + 1} of {SCENES.length}
        </p>
      </div>
    </div>
  );
}
