import { useState, useEffect } from 'react';

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  const sceneKeys = Object.keys(durations);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).startRecording) {
      (window as any).startRecording();
    }

    let isCancelled = false;
    let timeout: NodeJS.Timeout;

    const playScenes = async () => {
      for (let i = 0; i < sceneKeys.length; i++) {
        if (isCancelled) return;
        setCurrentScene(i);
        await new Promise(r => { timeout = setTimeout(r, durations[sceneKeys[i]]); });
      }
      if (typeof window !== 'undefined' && (window as any).stopRecording) {
        (window as any).stopRecording();
      }
      if (!isCancelled) {
        setCurrentScene(0);
        playScenes();
      }
    };

    playScenes();

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [JSON.stringify(durations)]);

  return { currentScene, sceneKeys };
}