import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center z-10 px-16"
      initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 1.2 }}>
      <div className="grid grid-cols-2 gap-24 w-full max-w-6xl">
        <motion.div
          className="flex flex-col justify-center"
          initial={{ opacity: 0 }} animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 1 }}
        >
          <h2 className="text-[3vw] text-[#D4AF37] mb-6" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Words of Unity</h2>
          <p className="text-[1.5vw] text-white/80 leading-relaxed font-light" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            Side-by-side wisdom from different traditions.
            <br /><br />
            Studio-quality AI voices in 9 languages, layered over ambient temple bells and rain.
          </p>
        </motion.div>
        <motion.div
          className="flex flex-col justify-center gap-8"
          initial={{ opacity: 0, x: 20 }} animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }} transition={{ duration: 1.2 }}
        >
          <div className="p-8 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-md">
            <p className="text-[#D4AF37] text-[1vw] uppercase tracking-widest mb-2" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Thematic Paths</p>
            <p className="text-white text-[1.8vw]" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Journeys through anxiety, grief, courage, and peace.</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}