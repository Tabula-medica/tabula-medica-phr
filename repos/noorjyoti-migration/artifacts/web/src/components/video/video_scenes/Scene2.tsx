import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const traditions = ['Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Judaism', 'Bahá\'í', 'Jainism', 'Taoism'];

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
      <motion.p
        className="text-[2.5vw] italic text-white/90 max-w-4xl text-center mb-16 leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1.5 }}
        style={{ fontFamily: '"Cormorant Garamond", serif' }}
      >
        "Truth is one — the sages call it by many names."
      </motion.p>
      <div className="flex flex-wrap justify-center gap-6 max-w-5xl">
        {traditions.map((t, i) => (
          <motion.span
            key={t}
            className="text-[1.2vw] text-[#D4AF37] uppercase tracking-widest border border-[#D4AF37]/30 px-6 py-2 rounded-full backdrop-blur-sm bg-black/20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, delay: phase >= 2 ? i * 0.1 : 0 }}
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            {t}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}