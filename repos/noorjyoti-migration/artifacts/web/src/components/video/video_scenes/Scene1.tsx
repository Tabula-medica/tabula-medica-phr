import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center text-center px-12 z-10"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.5 }}>
      <div className="flex flex-col items-center">
        <motion.h1
          className="text-[8vw] font-serif text-[#D4AF37] leading-none tracking-widest uppercase"
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={phase >= 1 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
        >
          NoorJyoti
        </motion.h1>
        <motion.div
          className="mt-6 w-[2px] h-12 bg-[#D4AF37]/50 mx-auto"
          initial={{ scaleY: 0 }}
          animate={phase >= 2 ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
        <motion.p
          className="mt-6 text-[2vw] text-white/80 font-light tracking-[0.3em] uppercase"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1.2, delay: 0.5 }}
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          One Light
        </motion.p>
      </div>
    </motion.div>
  );
}