/**
 * map.js
 * MapLibre GL 3D Map Controller with OpenFreeMap 3D vector tiles.
 */
import maplibregl from 'maplibre-gl';

export class MapController {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.currentTheme = 'dark';
    this.is3D = true;
    this.trackingTrainId = null;

    this.styles = {
      dark: 'https://tiles.openfreemap.org/styles/dark',
      liberty: 'https://tiles.openfreemap.org/styles/liberty',
    };
  }

  init() {
    return new Promise((resolve, reject) => {
      try {
        this.map = new maplibregl.Map({
          container: this.containerId,
          style: this.styles[this.currentTheme],
          center: [126.978, 37.5665], // Seoul City Hall / Station
          zoom: 14.5,
          pitch: 58,
          bearing: -20,
          maxPitch: 85,
          antialias: true,
        });

        // Add navigation controls (zoom, rotate)
        this.map.addControl(
          new maplibregl.NavigationControl({
            visualizePitch: true,
            showCompass: true,
          }),
          'bottom-right'
        );

        this.map.on('load', () => {
          this.setup3DBuildings();
          resolve(this.map);
        });

        this.map.on('error', (e) => {
          console.warn('[MapController] Map event warning:', e);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  setup3DBuildings() {
    try {
      const style = this.map.getStyle();
      const layers = style?.layers || [];
      let labelLayerId;
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
          labelLayerId = layers[i].id;
          break;
        }
      }

      // Check if 3D building layer already exists in openfreemap style
      if (!this.map.getLayer('3d-buildings')) {
        const buildingSource = this.map.getSource('openmaptiles') ? 'openmaptiles' : undefined;
        if (buildingSource) {
          this.map.addLayer(
            {
              id: '3d-buildings',
              source: buildingSource,
              'source-layer': 'building',
              filter: ['!=', ['get', 'hide_3d'], true],
              type: 'fill-extrusion',
              minzoom: 13,
              paint: {
                'fill-extrusion-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'render_height'],
                  0, '#111827',
                  50, '#1e293b',
                  150, '#334155',
                  300, '#475569',
                ],
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  13, 0,
                  14.05, ['get', 'render_height'],
                ],
                'fill-extrusion-base': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  13, 0,
                  14.05, ['get', 'render_min_height'],
                ],
                'fill-extrusion-opacity': 0.82,
              },
            },
            labelLayerId
          );
        }
      }

      // Set ambient light for 3D perspective
      if (this.map.setLight) {
        this.map.setLight({
          anchor: 'viewport',
          color: '#ffffff',
          intensity: 0.35,
          position: [1.5, 90, 45],
        });
      }
    } catch (e) {
      console.warn('[MapController] 3D buildings setup notice:', e);
    }
  }

  toggle3D() {
    this.is3D = !this.is3D;
    this.map.easeTo({
      pitch: this.is3D ? 58 : 0,
      bearing: this.is3D ? -20 : 0,
      duration: 1000,
    });
    return this.is3D;
  }

  resetView() {
    this.map.flyTo({
      center: [126.978, 37.5665],
      zoom: 13,
      pitch: 58,
      bearing: -20,
      duration: 1800,
      essential: true,
    });
  }

  flyToStation(lng, lat) {
    this.map.flyTo({
      center: [lng, lat],
      zoom: 16,
      pitch: 62,
      duration: 1500,
      essential: true,
    });
  }

  setTheme(theme) {
    if (theme === this.currentTheme) return;
    this.currentTheme = theme;
    this.map.setStyle(this.styles[theme]);
    this.map.once('style.load', () => {
      this.setup3DBuildings();
    });
  }
}
