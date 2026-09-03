// Short "victory" two-note beep, synthesized in the browser.
// No audio file to fetch, so it never fails to load.
export function playVictoryBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();

    const playTone = (freq: number, startAt: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + startAt + 0.02);
      gain.gain.linearRampToValueAtTime(
        0,
        ctx.currentTime + startAt + duration
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };

    playTone(587.33, 0, 0.12); // D5
    playTone(880, 0.12, 0.18); // A5

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio is a nice-to-have; never let it break the app.
  }
}
