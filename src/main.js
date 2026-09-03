/**
 * main.js
 * Application Entry Point for METRO 3D SEOUL.
 */
import { MapController } from './map.js';
import { DataLoader } from './dataLoader.js';
import { TrainSimulator } from './trainSimulator.js';
import { TrainRenderer } from './trainRenderer.js';
import { UIController } from './ui.js';
import { MetroAudioEngine } from './audio.js';

class MetroApp {
  constructor() {
    this.loader = new DataLoader();
    this.mapCtrl = new MapController('map');
    this.simulator = null;
    this.renderer = null;
    this.ui = null;
    this.audio = new MetroAudioEngine();

    this.lastTimestamp = performance.now();
  }

  async start() {
    const progressEl = document.getElementById('loader-progress');
    const subtitleEl = document.querySelector('.loader-subtitle');

    try {
      // 1. Load subway datasets
      await this.loader.loadAll((percent, msg) => {
        if (progressEl) progressEl.style.width = `${percent * 0.5}%`;
        if (subtitleEl) subtitleEl.textContent = msg;
      });

      // 2. Initialize 3D Vector Map
      if (subtitleEl) subtitleEl.textContent = '서울 3D 빌딩과 지형을 생성하는 중...';
      await this.mapCtrl.init();
      if (progressEl) progressEl.style.width = '75%';

      // 3. Initialize Traffic Simulation Engine
      if (subtitleEl) subtitleEl.textContent = '실시간 열차 주행망을 배치하는 중...';
      this.simulator = new TrainSimulator(this.loader);
      this.simulator.initialize();

      // 4. Initialize 3D Train & Track Renderer
      this.renderer = new TrainRenderer(this.mapCtrl, this.loader, this.simulator);
      this.renderer.init();

      // 5. Initialize UI and Controls
      this.ui = new UIController({
        mapController: this.mapCtrl,
        dataLoader: this.loader,
        trainSimulator: this.simulator,
        trainRenderer: this.renderer,
        audioEngine: this.audio,
      });
      this.ui.init();

      if (progressEl) progressEl.style.width = '100%';
      if (subtitleEl) subtitleEl.textContent = '모든 시스템 준비 완료!';

      // Fade out loading screen
      setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
          loader.classList.add('hidden-fade');
          setTimeout(() => loader.remove(), 700);
        }
      }, 500);

      // 6. Start Main Animation Loop
      this.lastTimestamp = performance.now();
      requestAnimationFrame(this.loop.bind(this));

    } catch (err) {
      console.error('[MetroApp] Initialization error:', err);
      if (subtitleEl) {
        subtitleEl.textContent = `로드 중 오류 발생: ${err.message}`;
        subtitleEl.style.color = '#ef4444';
      }
    }
  }

  loop(currentTimestamp) {
    const deltaMs = currentTimestamp - this.lastTimestamp;
    this.lastTimestamp = currentTimestamp;

    // Cap delta at 100ms to prevent huge jumps when switching tabs
    const deltaSec = Math.min(deltaMs / 1000, 0.1);

    if (this.simulator && this.renderer) {
      // 1. Advance simulation
      this.simulator.update(deltaSec);

      // 2. Render frame
      this.renderer.updateFrame();

      // 3. Update active UI tracking
      if (this.ui) {
        this.ui.updateTrackingHUD();
      }
    }

    requestAnimationFrame(this.loop.bind(this));
  }
}

// Bootstrap application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new MetroApp();
  app.start();
});
