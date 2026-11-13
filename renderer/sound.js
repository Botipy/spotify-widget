// Dźwięki Pomodoro (syntezowane Web Audio, bez plików). Używane przez widget (przy zmianie bloku) i panel ustawień (odsłuch).
//   'work'  = zaczyna się praca (trzy dźwięki w górę)
//   'break' = zaczyna się przerwa (trzy dźwięki w dół)
function playPomoSound(kind) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime + 0.03;
    const notes = kind === 'work'
      ? [[523.25, 0], [659.25, 0.17], [783.99, 0.34]]
      : [[783.99, 0], [659.25, 0.2], [523.25, 0.4]];
    const master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);
    for (const [freq, at] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(1, t0 + at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.7);
      o.connect(g); g.connect(master);
      o.start(t0 + at); o.stop(t0 + at + 0.75);
    }
    setTimeout(() => { try { ctx.close(); } catch {} }, 2000);
  } catch {}
}
