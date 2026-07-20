import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';

const SCENE_DURATIONS = {
  open: 6000,
  traditions: 5500,
  paths: 6000,
  close: 5500
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0A0B1A] font-sans">
      {/* Persistent Background Video */}
      <div className="absolute inset-0 opacity-40 mix-blend-screen">
        <video
          src={`${import.meta.env.BASE_URL}videos/golden-particles.mp4`}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
      </div>

      {/* Persistent Midground Assets */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"
        animate={{
          scale: [1, 1.1, 1.2, 1.3][currentScene] || 1,
          rotate: [0, 15, 30, 45][currentScene] || 0,
          opacity: [0, 0.3, 0.1, 0][currentScene] !== undefined ? [0, 0.3, 0.1, 0][currentScene] : 0,
        }}
        transition={{ duration: 5, ease: 'linear' }}
      >
        <img src={`${import.meta.env.BASE_URL}images/mandala.png`} className="w-[80vw] h-auto object-contain mix-blend-screen" alt="" />
      </motion.div>

      <motion.div
        className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
        animate={{
          opacity: currentScene === 2 ? 0.4 : 0,
          scale: currentScene === 2 ? 1.1 : 1,
        }}
        transition={{ duration: 2 }}
      >
        <img src={`${import.meta.env.BASE_URL}images/nebula.png`} className="w-full h-full object-cover" alt="" />
      </motion.div>

      {/* Ambient Glows */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none"
        animate={{
          background: currentScene % 2 === 0
            ? 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(30, 26, 60, 0.4) 0%, transparent 70%)',
        }}
        transition={{ duration: 2 }}
      />

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="traditions" />}
        {currentScene === 2 && <Scene3 key="paths" />}
        {currentScene === 3 && <Scene4 key="close" />}
      </AnimatePresence>
    </div>
  );
}