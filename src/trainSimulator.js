/**
 * trainSimulator.js
 * High-performance realistic subway train physics & traffic simulation.
 */

export class TrainSimulator {
  constructor(dataLoader) {
    this.loader = dataLoader;
    this.trains = [];
    this.trainsById = new Map();
    this.speedMultiplier = 1.0;
    this.isPaused = false;
    this.activeLineFilters = new Set(); // Lines that are enabled to display
  }

  initialize() {
    const { network, routesPrepared, linesById } = this.loader;

    // Enable all lines by default
    for (const line of network.lines) {
      this.activeLineFilters.add(line.id);
    }

    let trainCounter = 1000;

    // Generate realistic train fleets for each route
    for (const [routeId, route] of routesPrepared.entries()) {
      const lineId = route.line || routeId.split('-')[0] || '1';
      const lineInfo = linesById.get(lineId) || {
        name: `${lineId}호선`,
        color: '#00A84D',
        headway: 5,
        cars: 8,
      };

      const totalDist = route.totalDistance;
      if (totalDist < 1000 || !route.stations || route.stations.length < 2) continue;

      // Determine number of trains based on line length and headway
      // Average 3~8 trains per direction per route
      const headwayMeters = Math.max(3000, Math.min(8000, (lineInfo.headway || 5) * 1100));
      const trainCount = Math.max(2, Math.min(10, Math.floor(totalDist / headwayMeters)));

      const firstStation = route.stations[0]?.name || '시점';
      const lastStation = route.stations[route.stations.length - 1]?.name || '종점';

      // Forward direction trains
      for (let i = 0; i < trainCount; i++) {
        const offsetDist = (totalDist / trainCount) * i + (Math.random() * 500);
        trainCounter += 7;
        const train = this.createTrain({
          id: `T${trainCounter}`,
          lineId,
          lineInfo,
          routeId,
          direction: 1,
          startDistance: offsetDist % totalDist,
          destination: lastStation,
          route,
        });
        this.trains.push(train);
        this.trainsById.set(train.id, train);
      }

      // Backward direction trains (for non-loop lines or dual tracks)
      if (!lineInfo.loop) {
        for (let i = 0; i < trainCount; i++) {
          const offsetDist = (totalDist / trainCount) * i + (Math.random() * 500);
          trainCounter += 9;
          const train = this.createTrain({
            id: `T${trainCounter}`,
            lineId,
            lineInfo,
            routeId,
            direction: -1,
            startDistance: (totalDist - offsetDist) % totalDist,
            destination: firstStation,
            route,
          });
          this.trains.push(train);
          this.trainsById.set(train.id, train);
        }
      }
    }

    console.log(`[Simulator] Initialized ${this.trains.length} trains across ${routesPrepared.size} routes.`);
  }

  createTrain({ id, lineId, lineInfo, routeId, direction, startDistance, destination, route }) {
    const pos = this.loader.getInterpolatedPosition(routeId, startDistance);
    const stations = route.stations || [];

    return {
      id,
      lineId,
      lineName: lineInfo.name,
      lineColor: lineInfo.color,
      routeId,
      direction, // 1: forward along route, -1: reverse
      distance: startDistance,
      totalDistance: route.totalDistance,
      speedKmh: 65, // current speed in km/h
      maxSpeedKmh: 75 + Math.random() * 10,
      state: 'RUNNING', // 'RUNNING' | 'STOPPED' | 'DECEL' | 'ACCEL'
      dwellTimer: 0,
      destination,
      cars: lineInfo.cars || 10,
      lng: pos ? pos.lng : 127.0,
      lat: pos ? pos.lat : 37.5,
      bearing: pos ? (direction === 1 ? pos.bearing : (pos.bearing + 180) % 360) : 0,
      prevStation: stations[0]?.name || '',
      nextStation: stations[1]?.name || destination,
      remainDistanceToStation: 1000,
      stationsList: stations,
    };
  }

  update(deltaSec) {
    if (this.isPaused || deltaSec <= 0) return;

    const scaledDelta = deltaSec * this.speedMultiplier;

    for (const train of this.trains) {
      if (!this.activeLineFilters.has(train.lineId)) continue;

      if (train.state === 'STOPPED') {
        train.dwellTimer -= scaledDelta;
        train.speedKmh = 0;
        if (train.dwellTimer <= 0) {
          train.state = 'RUNNING';
        }
        continue;
      }

      // Physics: Speed acceleration towards cruising speed
      const targetSpeed = train.maxSpeedKmh;
      if (train.speedKmh < targetSpeed) {
        train.speedKmh = Math.min(targetSpeed, train.speedKmh + 20 * scaledDelta);
      }

      // Check upcoming station proximity to slow down & stop
      const stationCheck = this.findNextStation(train);
      if (stationCheck) {
        train.prevStation = stationCheck.prevName;
        train.nextStation = stationCheck.nextName;
        train.remainDistanceToStation = stationCheck.distanceToNext;

        // If very close to next station (< 40 meters), stop train for dwell time!
        if (stationCheck.distanceToNext <= 45 && train.speedKmh > 10) {
          train.state = 'STOPPED';
          train.dwellTimer = 8 + Math.random() * 7; // Stop for 8~15 seconds
          train.speedKmh = 0;
          continue;
        } else if (stationCheck.distanceToNext <= 350) {
          // Decelerate smoothly on approach
          const decelSpeed = Math.max(25, (stationCheck.distanceToNext / 350) * train.maxSpeedKmh);
          train.speedKmh = Math.min(train.speedKmh, decelSpeed);
        }
      }

      // Move train along route
      const metersPerSec = (train.speedKmh * 1000) / 3600;
      const stepDist = metersPerSec * scaledDelta;

      if (train.direction === 1) {
        train.distance += stepDist;
        if (train.distance >= train.totalDistance) {
          // End of route -> turnaround or loop
          train.distance = train.totalDistance;
          train.direction = -1;
          const temp = train.destination;
          train.destination = train.prevStation || '반대 방향';
          train.state = 'STOPPED';
          train.dwellTimer = 15;
        }
      } else {
        train.distance -= stepDist;
        if (train.distance <= 0) {
          train.distance = 0;
          train.direction = 1;
          train.destination = train.nextStation || '종점';
          train.state = 'STOPPED';
          train.dwellTimer = 15;
        }
      }

      // Compute new spatial coordinate & heading
      const pos = this.loader.getInterpolatedPosition(train.routeId, train.distance);
      if (pos) {
        train.lng = pos.lng;
        train.lat = pos.lat;
        train.bearing = train.direction === 1 ? pos.bearing : (pos.bearing + 180) % 360;
      }
    }
  }

  findNextStation(train) {
    const stations = train.stationsList;
    if (!stations || stations.length === 0) return null;

    const currentDist = train.distance;
    let prev = stations[0];
    let next = stations[stations.length - 1];

    if (train.direction === 1) {
      for (let i = 0; i < stations.length; i++) {
        if (stations[i].along >= currentDist) {
          next = stations[i];
          prev = stations[Math.max(0, i - 1)];
          break;
        }
      }
      return {
        prevName: prev.name,
        nextName: next.name,
        distanceToNext: Math.max(0, next.along - currentDist),
      };
    } else {
      for (let i = stations.length - 1; i >= 0; i--) {
        if (stations[i].along <= currentDist) {
          next = stations[i];
          prev = stations[Math.min(stations.length - 1, i + 1)];
          break;
        }
      }
      return {
        prevName: prev.name,
        nextName: next.name,
        distanceToNext: Math.max(0, currentDist - next.along),
      };
    }
  }

  getVisibleTrains() {
    return this.trains.filter((t) => this.activeLineFilters.has(t.lineId));
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  setLineVisibility(lineId, visible) {
    if (visible) {
      this.activeLineFilters.add(lineId);
    } else {
      this.activeLineFilters.delete(lineId);
    }
  }

  setAllLines(visible) {
    if (visible) {
      for (const line of this.loader.network.lines) {
        this.activeLineFilters.add(line.id);
      }
    } else {
      this.activeLineFilters.clear();
    }
  }
}
