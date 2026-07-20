import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.5 }}>
      <motion.h2
        className="text-[4vw] text-white mb-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 1.5 }}
        style={{ fontFamily: '"Cormorant Garamond", serif' }}
      >
        Enter the Sanctuary
      </motion.h2>
      <motion.div
        className="flex gap-8"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1 }}
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        <span className="text-[1.2vw] text-[#D4AF37] tracking-[0.2em] uppercase">Mobile App</span>
        <span className="text-[1.2vw] text-white/50 tracking-[0.2em] uppercase">•</span>
        <span className="text-[1.2vw] text-[#D4AF37] tracking-[0.2em] uppercase">Web Platform</span>
      </motion.div>
    </motion.div>
  );
}