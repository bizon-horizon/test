let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, type = 'square', duration = 0.1, volume = 0.3, slide = 0 }) {
  const c = ac();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + duration);
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

function noise({ duration = 0.15, volume = 0.25, lowpass = 2000 }) {
  const c = ac();
  const buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
}

export const sounds = {
  shoot() { noise({ duration: 0.08, volume: 0.2, lowpass: 4000 }); tone({ freq: 220, type: 'sawtooth', duration: 0.08, volume: 0.15, slide: -160 }); },
  knife() { tone({ freq: 900, type: 'triangle', duration: 0.12, volume: 0.2, slide: -600 }); },
  hit() { tone({ freq: 300, type: 'square', duration: 0.07, volume: 0.2, slide: 120 }); },
  fridgeDie() { noise({ duration: 0.4, volume: 0.35, lowpass: 1200 }); tone({ freq: 120, type: 'sawtooth', duration: 0.4, volume: 0.3, slide: -80 }); },
  hurt() { tone({ freq: 160, type: 'sawtooth', duration: 0.2, volume: 0.3, slide: -100 }); },
  swap() { tone({ freq: 500, type: 'triangle', duration: 0.06, volume: 0.15, slide: 200 }); },
  respawn() { tone({ freq: 330, type: 'sine', duration: 0.3, volume: 0.2, slide: 220 }); },
  chat() { tone({ freq: 800, type: 'sine', duration: 0.05, volume: 0.1 }); },
};
