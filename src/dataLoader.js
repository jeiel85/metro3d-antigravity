/**
 * dataLoader.js
 * Handles fetching, parsing, and caching of subway network data.
 */

export class DataLoader {
  constructor() {
    this.network = null;
    this.timetable = null;
    this.congestion = null;
    this.ridership = null;

    this.stationsById = new Map();
    this.stationsByName = new Map();
    this.linesById = new Map();
    this.routesPrepared = new Map();
  }

  async loadAll(onProgress = () => {}) {
    onProgress(10, '지하철 노선 및 역 지오메트리 로드 중...');
    const [netRes, timeRes, congRes, riderRes] = await Promise.all([
      fetch('./data/network.json'),
      fetch('./data/timetable.json'),
      fetch('./data/congestion.json'),
      fetch('./data/ridership.json'),
    ]);

    onProgress(40, '데이터 파싱 및 공간 인덱스 생성 중...');
    this.network = await netRes.json();
    this.timetable = await timeRes.json();
    this.congestion = await congRes.json();
    this.ridership = await riderRes.json();

    // Index Stations
    for (const station of this.network.stations) {
      this.stationsById.set(station.id, station);
      if (!this.stationsByName.has(station.name)) {
        this.stationsByName.set(station.name, []);
      }
      this.stationsByName.get(station.name).push(station);
    }

    // Index Lines
    for (const line of this.network.lines) {
      this.linesById.set(line.id, line);
    }

    onProgress(70, '선로 궤도 거리 및 보간 데이터 전처리 중...');
    // Precompute route segment distances for fast train interpolation
    for (const [routeId, route] of Object.entries(this.network.routes)) {
      const coords = route.coordinates;
      const cumDistances = [0];
      let total = 0;

      for (let i = 1; i < coords.length; i++) {
        const d = this.haversineDistance(coords[i - 1], coords[i]);
        total += d;
        cumDistances.push(total);
      }

      this.routesPrepared.set(routeId, {
        ...route,
        coordinates: coords,
        cumDistances,
        totalDistance: total,
      });
    }

    onProgress(100, '모든 노선 준비 완료!');
    return {
      network: this.network,
      stationsById: this.stationsById,
      linesById: this.linesById,
      routesPrepared: this.routesPrepared,
    };
  }

  haversineDistance([lng1, lat1], [lng2, lat2]) {
    const R = 6371000; // Earth radius in meters
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLng = (lng2 - lng1) * toRad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Find coordinate and bearing at a specific distance (in meters) along a route.
   */
  getInterpolatedPosition(routeId, distanceMeters) {
    const route = this.routesPrepared.get(routeId);
    if (!route || route.coordinates.length < 2) return null;

    const { coordinates, cumDistances, totalDistance } = route;
    // Clamping / looping distance
    let dist = distanceMeters;
    if (dist < 0) dist = 0;
    if (dist > totalDistance) dist = totalDistance;

    // Binary search for the current segment
    let low = 0;
    let high = cumDistances.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (cumDistances[mid] <= dist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(0, Math.min(coordinates.length - 2, high));
    const p1 = coordinates[idx];
    const p2 = coordinates[idx + 1];

    const segStart = cumDistances[idx];
    const segEnd = cumDistances[idx + 1];
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? (dist - segStart) / segLen : 0;

    const lng = p1[0] + (p2[0] - p1[0]) * t;
    const lat = p1[1] + (p2[1] - p1[1]) * t;

    // Calculate bearing (heading angle in degrees)
    const y = Math.sin((p2[0] - p1[0]) * (Math.PI / 180)) * Math.cos(p2[1] * (Math.PI / 180));
    const x =
      Math.cos(p1[1] * (Math.PI / 180)) * Math.sin(p2[1] * (Math.PI / 180)) -
      Math.sin(p1[1] * (Math.PI / 180)) * Math.cos(p2[1] * (Math.PI / 180)) * Math.cos((p2[0] - p1[0]) * (Math.PI / 180));
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

    return { lng, lat, bearing, index: idx };
  }
}
