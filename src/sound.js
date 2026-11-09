export class SoundKit {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.context = null;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (this.enabled) this.#wake();
  }

  #wake() {
    if (!this.enabled) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!this.context) this.context = new AudioContextClass();
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  }

  #tone(frequency, duration, { wave = "square", volume = 0.035, slide = 0, delay = 0 } = {}) {
    const context = this.#wake();
    if (!context) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.015);
  }

  play(kind) {
    if (!this.enabled) return;
    if (kind === "click") this.#tone(470, 0.055, { volume: 0.018, wave: "square", slide: 110 });
    else if (kind === "count") this.#tone(520, 0.12, { volume: 0.035, wave: "square" });
    else if (kind === "go") {
      this.#tone(540, 0.14, { volume: 0.04, wave: "square", delay: 0 });
      this.#tone(790, 0.22, { volume: 0.04, wave: "square", delay: 0.10 });
    } else if (kind === "hit") this.#tone(160, 0.075, { volume: 0.032, wave: "triangle", slide: -90 });
    else if (kind === "pickup") this.#tone(760, 0.1, { volume: 0.025, wave: "sine", slide: 280 });
    else if (kind === "goal") {
      this.#tone(390, 0.34, { volume: 0.045, wave: "triangle", slide: 180 });
      this.#tone(590, 0.34, { volume: 0.035, wave: "square", slide: 190, delay: 0.13 });
      this.#tone(880, 0.46, { volume: 0.035, wave: "triangle", slide: 180, delay: 0.26 });
    } else if (kind === "whistle") {
      this.#tone(870, 0.32, { volume: 0.03, wave: "sine" });
      this.#tone(740, 0.36, { volume: 0.024, wave: "sine", delay: 0.28 });
    }
  }
}
