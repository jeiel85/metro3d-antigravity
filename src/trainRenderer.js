/**
 * trainRenderer.js
 * High-performance subway tracks, stations, and animated 3D train renderer using MapLibre GL & Three.js.
 */
import maplibregl from 'maplibre-gl';

export class TrainRenderer {
  constructor(mapController, dataLoader, trainSimulator) {
    this.map = mapController.map;
    this.controller = mapController;
    this.loader = dataLoader;
    this.sim = trainSimulator;

    this.trackingTrainId = null;
    this.onTrainSelect = null;
    this.onStationSelect = null;
  }

  init() {
    this.renderTracks();
    this.renderStations();
    this.setupTrainSources();
    this.bindInteractions();
  }

  renderTracks() {
    const { routesPrepared, linesById } = this.loader;
    const trackFeatures = [];

    for (const [routeId, route] of routesPrepared.entries()) {
      const lineId = route.line || routeId.split('-')[0] || '1';
      const lineInfo = linesById.get(lineId) || { color: '#00A84D' };
      const coords = route.coords || route.coordinates || [];

      if (coords.length >= 2) {
        trackFeatures.push({
          type: 'Feature',
          properties: {
            routeId,
            lineId,
            color: lineInfo.color,
          },
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        });
      }
    }

    const geojson = {
      type: 'FeatureCollection',
      features: trackFeatures,
    };

    if (this.map.getSource('metro-tracks')) {
      this.map.getSource('metro-tracks').setData(geojson);
      return;
    }

    this.map.addSource('metro-tracks', {
      type: 'geojson',
      data: geojson,
    });

    // 1. Tracks Glow Effect
    this.map.addLayer({
      id: 'tracks-glow',
      type: 'line',
      source: 'metro-tracks',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 6, 18, 14],
        'line-opacity': 0.35,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 3, 18, 6],
      },
    });

    // 2. Tracks Core Rails
    this.map.addLayer({
      id: 'tracks-core',
      type: 'line',
      source: 'metro-tracks',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 14, 3, 18, 6],
        'line-opacity': 0.9,
      },
    });
  }

  renderStations() {
    const { network, linesById } = this.loader;
    const stationFeatures = [];

    for (const st of network.stations || []) {
      const isTransfer = st.lines && st.lines.length > 1;
      const primaryLine = linesById.get(st.lines[0]) || { color: '#ffffff' };

      stationFeatures.push({
        type: 'Feature',
        properties: {
          id: st.id,
          name: st.name,
          nameEn: st.nameEn || '',
          isTransfer,
          primaryColor: primaryLine.color,
          lines: JSON.stringify(st.lines || []),
        },
        geometry: {
          type: 'Point',
          coordinates: [st.lng, st.lat],
        },
      });
    }

    const geojson = {
      type: 'FeatureCollection',
      features: stationFeatures,
    };

    if (this.map.getSource('metro-stations')) {
      this.map.getSource('metro-stations').setData(geojson);
      return;
    }

    this.map.addSource('metro-stations', {
      type: 'geojson',
      data: geojson,
    });

    // Outer Halo for transfer stations
    this.map.addLayer({
      id: 'stations-halo',
      type: 'circle',
      source: 'metro-stations',
      filter: ['==', ['get', 'isTransfer'], true],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 8, 18, 14],
        'circle-color': '#ffffff',
        'circle-opacity': 0.4,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#38bdf8',
      },
    });

    // Station Nodes
    this.map.addLayer({
      id: 'stations-point',
      type: 'circle',
      source: 'metro-stations',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, ['case', ['get', 'isTransfer'], 3, 2],
          14, ['case', ['get', 'isTransfer'], 6, 4],
          18, ['case', ['get', 'isTransfer'], 10, 7],
        ],
        'circle-color': '#0f172a',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 2.5, 18, 4],
        'circle-stroke-color': ['get', 'primaryColor'],
      },
    });

    // Station Label Text
    this.map.addLayer({
      id: 'stations-label',
      type: 'symbol',
      source: 'metro-stations',
      minzoom: 12.5,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12.5, 9, 15, 12, 18, 15],
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': '#090d16',
        'text-halo-width': 2,
      },
    });
  }

  setupTrainSources() {
    const emptyGeoJSON = { type: 'FeatureCollection', features: [] };

    // Train Light Beam Source
    this.map.addSource('trains-beam', {
      type: 'geojson',
      data: emptyGeoJSON,
    });

    // Train Body Source
    this.map.addSource('trains-body', {
      type: 'geojson',
      data: emptyGeoJSON,
    });

    // 1. Headlight Beams (Front projection cone)
    this.map.addLayer({
      id: 'trains-beam-layer',
      type: 'line',
      source: 'trains-beam',
      paint: {
        'line-color': '#fffbeb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 12, 18, 22],
        'line-opacity': 0.45,
        'line-blur': 4,
      },
    });

    // 2. Train Outer Pulse Glow
    this.map.addLayer({
      id: 'trains-glow-layer',
      type: 'circle',
      source: 'trains-body',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 6, 15, 12, 18, 20],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.6,
        'circle-blur': 0.5,
      },
    });

    // 3. Train Main Cabin Box / Node
    this.map.addLayer({
      id: 'trains-point-layer',
      type: 'circle',
      source: 'trains-body',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 7, 18, 12],
        'circle-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-stroke-color': ['get', 'color'],
      },
    });

    // 4. Train Heading Pointer
    this.map.addLayer({
      id: 'trains-head-pointer',
      type: 'circle',
      source: 'trains-body',
      minzoom: 14,
      paint: {
        'circle-radius': 3.5,
        'circle-color': '#38bdf8',
        'circle-translate': [0, -6],
        'circle-translate-anchor': 'viewport',
      },
    });
  }

  bindInteractions() {
    // Station click
    this.map.on('click', 'stations-point', (e) => {
      if (e.features && e.features[0]) {
        const feat = e.features[0];
        const props = feat.properties;
        if (this.onStationSelect) {
          this.onStationSelect({
            id: props.id,
            name: props.name,
            nameEn: props.nameEn,
            lines: JSON.parse(props.lines || '[]'),
            coords: feat.geometry.coordinates,
          });
        }
      }
    });

    // Train click
    this.map.on('click', 'trains-point-layer', (e) => {
      if (e.features && e.features[0]) {
        const trainId = e.features[0].properties.id;
        this.selectTrain(trainId);
      }
    });

    // Cursor pointers
    this.map.on('mouseenter', 'stations-point', () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', 'stations-point', () => (this.map.getCanvas().style.cursor = ''));
    this.map.on('mouseenter', 'trains-point-layer', () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', 'trains-point-layer', () => (this.map.getCanvas().style.cursor = ''));
  }

  selectTrain(trainId) {
    this.trackingTrainId = trainId;
    const train = this.sim.trainsById.get(trainId);
    if (train && this.onTrainSelect) {
      this.onTrainSelect(train);
    }
  }

  stopTracking() {
    this.trackingTrainId = null;
  }

  updateFrame() {
    const visibleTrains = this.sim.getVisibleTrains();

    const bodyFeatures = [];
    const beamFeatures = [];

    for (const train of visibleTrains) {
      bodyFeatures.push({
        type: 'Feature',
        properties: {
          id: train.id,
          lineId: train.lineId,
          name: train.lineName,
          color: train.lineColor,
          bearing: train.bearing,
          speed: Math.round(train.speedKmh),
        },
        geometry: {
          type: 'Point',
          coordinates: [train.lng, train.lat],
        },
      });

      // Calculate headlight beam vector (projection ahead in bearing direction)
      const rad = (train.bearing * Math.PI) / 180;
      const beamLengthDeg = 0.0007; // ~70m beam
      const beamLng = train.lng + Math.sin(rad) * beamLengthDeg;
      const beamLat = train.lat + Math.cos(rad) * beamLengthDeg;

      beamFeatures.push({
        type: 'Feature',
        properties: {
          id: train.id,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [train.lng, train.lat],
            [beamLng, beamLat],
          ],
        },
      });
    }

    // Push frame updates to MapLibre sources
    const bodySource = this.map.getSource('trains-body');
    if (bodySource) {
      bodySource.setData({
        type: 'FeatureCollection',
        features: bodyFeatures,
      });
    }

    const beamSource = this.map.getSource('trains-beam');
    if (beamSource) {
      beamSource.setData({
        type: 'FeatureCollection',
        features: beamFeatures,
      });
    }

    // Smooth Camera Follow if tracking
    if (this.trackingTrainId) {
      const train = this.sim.trainsById.get(this.trackingTrainId);
      if (train) {
        this.followTrainWithCamera(train);
      }
    }
  }

  followTrainWithCamera(train) {
    const currentCenter = this.map.getCenter();
    const targetLng = train.lng;
    const targetLat = train.lat;

    // Smooth Lerp factor
    const lerp = 0.08;
    const newLng = currentCenter.lng + (targetLng - currentCenter.lng) * lerp;
    const newLat = currentCenter.lat + (targetLat - currentCenter.lat) * lerp;

    this.map.jumpTo({
      center: [newLng, newLat],
      bearing: train.bearing,
      pitch: 65,
    });
  }
}
