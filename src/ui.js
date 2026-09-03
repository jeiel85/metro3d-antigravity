/**
 * ui.js
 * User Interface & Interaction Controller for Metro 3D Seoul.
 */

export class UIController {
  constructor({ mapController, dataLoader, trainSimulator, trainRenderer, audioEngine }) {
    this.map = mapController;
    this.loader = dataLoader;
    this.sim = trainSimulator;
    this.renderer = trainRenderer;
    this.audio = audioEngine;

    this.currentTrackedTrain = null;
    this.isChillMode = false;
    this.chillInterval = null;
  }

  init() {
    this.setupClock();
    this.setupSearch();
    this.setupLineFilters();
    this.setupToolbar();
    this.setupSpeedControls();
    this.setupAudioButton();
    this.setupTrackingHUD();
    this.setupStationCard();
    this.updateStats();

    // Bind renderer callbacks
    this.renderer.onTrainSelect = (train) => this.startTracking(train);
    this.renderer.onStationSelect = (station) => this.showStationCard(station);
  }

  setupClock() {
    const timeEl = document.getElementById('clock-time');
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      timeEl.textContent = `${h}:${m}:${s}`;
    };
    update();
    setInterval(update, 1000);
  }

  updateStats() {
    const activeTrains = this.sim.getVisibleTrains().length;
    document.getElementById('stat-active-trains').textContent = activeTrains;
    document.getElementById('stat-stations').textContent = this.loader.network.stations.length;
    document.getElementById('stat-lines').textContent = this.loader.network.lines.length;
  }

  setupSearch() {
    const input = document.getElementById('station-search');
    const dropdown = document.getElementById('search-results');

    input.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        dropdown.classList.add('hidden');
        return;
      }

      const matches = [];
      for (const st of this.loader.network.stations) {
        if (
          st.name.toLowerCase().includes(q) ||
          (st.nameEn && st.nameEn.toLowerCase().includes(q))
        ) {
          matches.push(st);
          if (matches.length >= 8) break;
        }
      }

      if (matches.length === 0) {
        dropdown.innerHTML = '<div class="search-item" style="color: #64748b;">일치하는 역이 없습니다.</div>';
        dropdown.classList.remove('hidden');
        return;
      }

      dropdown.innerHTML = matches
        .map((st) => {
          const lines = (st.lines || [])
            .map((lid) => {
              const l = this.loader.linesById.get(lid);
              return `<span class="line-chip" style="background:${l?.color || '#333'}; font-size: 0.65rem; padding: 1px 5px;">${l?.name || lid}</span>`;
            })
            .join(' ');
          return `
            <div class="search-item" data-id="${st.id}" data-lng="${st.lng}" data-lat="${st.lat}">
              <div>
                <span class="search-item-name">${st.name}</span>
                <span class="search-item-en">${st.nameEn || ''}</span>
              </div>
              <div class="search-lines-badge">${lines}</div>
            </div>
          `;
        })
        .join('');

      dropdown.classList.remove('hidden');
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.search-item');
      if (!item || !item.dataset.lng) return;

      const lng = parseFloat(item.dataset.lng);
      const lat = parseFloat(item.dataset.lat);
      const id = item.dataset.id;
      const st = this.loader.stationsById.get(id);

      this.map.flyToStation(lng, lat);
      if (st) {
        this.showStationCard(st);
      }

      dropdown.classList.add('hidden');
      input.value = '';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) {
        dropdown.classList.add('hidden');
      }
    });
  }

  setupLineFilters() {
    const listEl = document.getElementById('lines-list');
    const { network, linesById } = this.loader;

    listEl.innerHTML = network.lines
      .map((line) => {
        return `
          <div class="line-toggle-item" data-line-id="${line.id}">
            <div class="line-left">
              <span class="line-badge" style="background:${line.color}">${line.name}</span>
            </div>
            <span class="line-train-count" id="line-cnt-${line.id}">운행중</span>
          </div>
        `;
      })
      .join('');

    listEl.addEventListener('click', (e) => {
      const item = e.target.closest('.line-toggle-item');
      if (!item) return;

      const lineId = item.dataset.lineId;
      const isCurrentlyOff = item.classList.contains('is-off');

      if (isCurrentlyOff) {
        item.classList.remove('is-off');
        this.sim.setLineVisibility(lineId, true);
      } else {
        item.classList.add('is-off');
        this.sim.setLineVisibility(lineId, false);
      }

      this.updateActiveCount();
      this.updateStats();
    });

    document.getElementById('btn-select-all-lines').addEventListener('click', () => {
      listEl.querySelectorAll('.line-toggle-item').forEach((el) => el.classList.remove('is-off'));
      this.sim.setAllLines(true);
      this.updateActiveCount();
      this.updateStats();
    });

    document.getElementById('btn-clear-lines').addEventListener('click', () => {
      listEl.querySelectorAll('.line-toggle-item').forEach((el) => el.classList.add('is-off'));
      this.sim.setAllLines(false);
      this.updateActiveCount();
      this.updateStats();
    });
  }

  updateActiveCount() {
    const count = this.sim.activeLineFilters.size;
    document.getElementById('active-line-count').textContent = count;
  }

  setupToolbar() {
    // 3D Tilt Toggle
    const btn3D = document.getElementById('btn-3d-toggle');
    btn3D.addEventListener('click', () => {
      const is3D = this.map.toggle3D();
      btn3D.classList.toggle('active', is3D);
    });

    // Reset View
    document.getElementById('btn-reset-view').addEventListener('click', () => {
      this.stopTracking();
      this.map.resetView();
    });

    // Theme Toggle
    const btnTheme = document.getElementById('btn-theme');
    btnTheme.addEventListener('click', () => {
      const nextTheme = this.map.currentTheme === 'dark' ? 'liberty' : 'dark';
      this.map.setTheme(nextTheme);
    });

    // Chill Mode (멍때리기)
    const btnChill = document.getElementById('btn-chill-mode');
    btnChill.addEventListener('click', () => {
      this.isChillMode = !this.isChillMode;
      btnChill.classList.toggle('active', this.isChillMode);

      if (this.isChillMode) {
        this.startChillMode();
      } else {
        this.stopChillMode();
      }
    });
  }

  startChillMode() {
    const pickRandomTrain = () => {
      const visible = this.sim.getVisibleTrains();
      if (visible.length === 0) return;
      const rand = visible[Math.floor(Math.random() * visible.length)];
      this.startTracking(rand);
    };

    pickRandomTrain();
    this.chillInterval = setInterval(pickRandomTrain, 35000); // switch camera every 35s
  }

  stopChillMode() {
    if (this.chillInterval) {
      clearInterval(this.chillInterval);
      this.chillInterval = null;
    }
  }

  setupSpeedControls() {
    const buttons = document.querySelectorAll('.speed-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.dataset.speed);
        this.sim.setSpeed(speed);
      });
    });
  }

  setupAudioButton() {
    const btnSound = document.getElementById('btn-sound');
    const iconOff = document.getElementById('sound-icon-off');
    const iconOn = document.getElementById('sound-icon-on');

    btnSound.addEventListener('click', () => {
      const isPlaying = this.audio.toggle();
      if (isPlaying) {
        iconOff.classList.add('hidden');
        iconOn.classList.remove('hidden');
        btnSound.classList.add('active');
      } else {
        iconOff.classList.remove('hidden');
        iconOn.classList.add('hidden');
        btnSound.classList.remove('active');
      }
    });
  }

  setupTrackingHUD() {
    const hud = document.getElementById('tracking-hud');
    const btnStop = document.getElementById('btn-stop-tracking');

    btnStop.addEventListener('click', () => {
      this.stopTracking();
    });
  }

  startTracking(train) {
    this.currentTrackedTrain = train;
    this.renderer.selectTrain(train.id);

    const hud = document.getElementById('tracking-hud');
    const lineBadge = document.getElementById('hud-line-badge');
    const trainName = document.getElementById('hud-train-name');
    const trainDest = document.getElementById('hud-train-dest');

    lineBadge.textContent = train.lineName;
    lineBadge.style.backgroundColor = train.lineColor;
    trainName.textContent = `열차 #${train.id}`;
    trainDest.textContent = `${train.destination}행`;

    hud.classList.remove('hidden');
  }

  stopTracking() {
    this.currentTrackedTrain = null;
    this.renderer.stopTracking();
    this.stopChillMode();
    document.getElementById('btn-chill-mode').classList.remove('active');
    document.getElementById('tracking-hud').classList.add('hidden');
  }

  updateTrackingHUD() {
    if (!this.currentTrackedTrain) return;

    const t = this.currentTrackedTrain;
    document.getElementById('hud-speed-val').textContent = Math.round(t.speedKmh);
    document.getElementById('hud-prev-station').textContent = t.prevStation || '-';
    document.getElementById('hud-next-station').textContent = t.nextStation || t.destination;
    document.getElementById('hud-remain-dist').textContent = `${Math.round(t.remainDistanceToStation)}m 남음`;
  }

  setupStationCard() {
    const closeBtn = document.getElementById('btn-close-station');
    closeBtn.addEventListener('click', () => {
      document.getElementById('station-card').classList.add('hidden');
    });
  }

  showStationCard(station) {
    const card = document.getElementById('station-card');
    document.getElementById('card-station-name').textContent = station.name;
    document.getElementById('card-station-en').textContent = station.nameEn || '';

    // Line chips
    const chipsEl = document.getElementById('card-station-lines');
    chipsEl.innerHTML = (station.lines || [])
      .map((lid) => {
        const l = this.loader.linesById.get(lid);
        return `<span class="line-chip" style="background:${l?.color || '#00A84D'}">${l?.name || lid}</span>`;
      })
      .join('');

    // Arrivals Simulation
    const arrivalsEl = document.getElementById('card-arrivals-list');
    const nearbyTrains = this.sim.trains
      .filter((t) => t.nextStation === station.name || t.prevStation === station.name)
      .slice(0, 3);

    if (nearbyTrains.length > 0) {
      arrivalsEl.innerHTML = nearbyTrains
        .map((t) => {
          const etaMin = Math.max(1, Math.round(t.remainDistanceToStation / ((t.speedKmh || 50) * 16.6)));
          return `
            <div class="arrival-row" style="border-left-color: ${t.lineColor};">
              <span class="arrival-dest"><strong>${t.lineName}</strong> ${t.destination}행</span>
              <span class="arrival-meta">약 ${etaMin}분 후</span>
            </div>
          `;
        })
        .join('');
    } else {
      arrivalsEl.innerHTML = `
        <div class="arrival-row">
          <span class="arrival-dest">상행 / 내선순환</span>
          <span class="arrival-meta">약 3분 후</span>
        </div>
        <div class="arrival-row">
          <span class="arrival-dest">하행 / 외선순환</span>
          <span class="arrival-meta">약 5분 후</span>
        </div>
      `;
    }

    // Congestion info
    const congText = document.getElementById('card-congestion-text');
    const congBar = document.getElementById('card-congestion-bar');
    const randomCong = Math.floor(45 + Math.random() * 40);
    const congStatus = randomCong > 75 ? '혼잡' : randomCong > 55 ? '보통' : '여유';
    congText.textContent = `${congStatus} (${randomCong}%)`;
    congBar.style.width = `${randomCong}%`;

    card.classList.remove('hidden');
  }
}
