/**
 * audio.js
 * Generative Web Audio API synthesizer for subway ambient sound & rail acoustics.
 * Lightweight, zero-external-asset audio generator.
 */

export class MetroAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.gainNode = null;
    this.motorOsc = null;
    this.lfoNode = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);
    this.gainNode.connect(this.ctx.destination);
  }

  start() {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isPlaying) return;

    // 1. Motor Hum Synth (Low drone)
    this.motorOsc = this.ctx.createOscillator();
    this.motorOsc.type = 'sawtooth';
    this.motorOsc.frequency.setValueAtTime(65, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    // LFO for subtle train rumble oscillation
    this.lfoNode = this.ctx.createOscillator();
    this.lfoNode.frequency.setValueAtTime(1.8, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(25, this.ctx.currentTime);

    this.lfoNode.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    this.motorOsc.connect(filter);
    filter.connect(this.gainNode);

    this.motorOsc.start();
    this.lfoNode.start();

    // 2. White noise rail friction texture
    this.startRailNoise();

    this.isPlaying = true;
  }

  startRailNoise() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(2, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.gainNode);

    noise.start();
    this.railNoise = noise;
  }

  stop() {
    if (!this.isPlaying) return;
    try {
      if (this.motorOsc) this.motorOsc.stop();
      if (this.lfoNode) this.lfoNode.stop();
      if (this.railNoise) this.railNoise.stop();
    } catch (e) {
      // ignore
    }
    this.isPlaying = false;
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }
}
